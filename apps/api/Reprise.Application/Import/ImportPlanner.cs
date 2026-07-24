using Reprise.Domain.Enums;

namespace Reprise.Application.Import;

/// <summary>
/// Transforma as linhas cruas do export num <see cref="ImportPlan"/> — puro, determinístico,
/// sem banco nem TMDB. Encapsula todas as regras que "mordem" (rewatch, especiais, backfill,
/// runtime ausente, reconciliação). É a peça que os testes exercitam com fixtures reais.
/// </summary>
public sealed class ImportPlanner
{
    // Bandas de tolerância do cross-check com o vendor. Nunca abortam — só classificam o delta.
    private const double EpWatchTolerancePct = 5.0;
    private const double RuntimeTolerancePct = 15.0;

    public ImportPlan Plan(IReadOnlyList<TrackingRecord> records)
    {
        var rejected = new List<RejectedRow>();
        var events = new List<PlannedWatchEvent>();
        var trackedList = new List<PlannedTrackedSeries>();

        var episodeRuntime = new Dictionary<EpisodeKey, int?>();
        var episodeSpecial = new Dictionary<EpisodeKey, bool>();
        var seriesNames = new Dictionary<int, string>();
        var uuidToTvdb = new Dictionary<string, int>(StringComparer.Ordinal);

        int exhibitionRows = 0, userSeriesRows = 0, statsRows = 0, unknownRows = 0;
        TrackingRecord? statsRow = null;

        // Passo prévio: mapa uuid-da-série -> tvdb, a partir das exibições (que trazem o s_id).
        foreach (var r in records)
        {
            if (r.IsExhibition && r.TvdbId is int tv && r.SeriesUuid is string u)
                uuidToTvdb.TryAdd(u, tv);
        }

        foreach (var r in records)
        {
            switch (r.Type)
            {
                case RecordType.Watch:
                case RecordType.Rewatch:
                    exhibitionRows++;
                    PlanExhibition(r, events, episodeRuntime, episodeSpecial, seriesNames, rejected);
                    break;

                case RecordType.UserSeries:
                    userSeriesRows++;
                    PlanUserSeries(r, uuidToTvdb, trackedList, seriesNames, rejected);
                    break;

                case RecordType.Stats:
                    statsRows++;
                    statsRow = r;
                    break;

                default:
                    unknownRows++;
                    rejected.Add(new RejectedRow(r.Key, RecordType.Unknown, "formato de key não reconhecido"));
                    break;
            }
        }

        var series = seriesNames
            .Select(kv => new PlannedSeries(kv.Key, kv.Value))
            .OrderBy(s => s.TvdbId)
            .ToList();

        var episodes = episodeRuntime
            .Select(kv => new PlannedEpisode(kv.Key, kv.Value, episodeSpecial[kv.Key]))
            .ToList();

        var hard = new HardInvariants(
            RowsRead: records.Count,
            ExhibitionRows: exhibitionRows,
            UserSeriesRows: userSeriesRows,
            StatsRows: statsRows,
            UnknownRows: unknownRows,
            EventsPlanned: events.Count,
            RejectedExhibitionRows: rejected.Count(x => x.Type is RecordType.Watch or RecordType.Rewatch));

        var vendor = BuildVendorMetrics(statsRow, episodes, trackedList);

        return new ImportPlan(series, episodes, events, trackedList, rejected, new ReconciliationReport(hard, vendor));
    }

    private static void PlanExhibition(
        TrackingRecord r,
        List<PlannedWatchEvent> events,
        Dictionary<EpisodeKey, int?> episodeRuntime,
        Dictionary<EpisodeKey, bool> episodeSpecial,
        Dictionary<int, string> seriesNames,
        List<RejectedRow> rejected)
    {
        if (string.IsNullOrEmpty(r.Key)) { rejected.Add(new(r.Key, r.Type, "key vazia")); return; }
        if (r.TvdbId is not int tvdb) { rejected.Add(new(r.Key, r.Type, "s_id (tvdb) ausente")); return; }
        if (r.SeasonNo is not int sno || r.EpisodeNo is not int eno) { rejected.Add(new(r.Key, r.Type, "s_no/ep_no ausente")); return; }
        if (r.WatchedAt is not DateTimeOffset watchedAt) { rejected.Add(new(r.Key, r.Type, "created_at inválido")); return; }

        var key = new EpisodeKey(tvdb, sno, eno);
        events.Add(new PlannedWatchEvent(key, watchedAt, r.IsBackfill, r.Key));

        // Runtime do episódio: primeira ocorrência não-nula entre as várias exibições do mesmo episódio.
        if (!episodeRuntime.TryGetValue(key, out var existing) || existing is null)
            episodeRuntime[key] = r.RuntimeSeconds ?? existing;

        episodeSpecial[key] = r.IsSpecial;

        if (!seriesNames.ContainsKey(tvdb))
            seriesNames[tvdb] = string.IsNullOrWhiteSpace(r.SeriesName) ? $"TVDB {tvdb}" : r.SeriesName!;
    }

    private static void PlanUserSeries(
        TrackingRecord r,
        Dictionary<string, int> uuidToTvdb,
        List<PlannedTrackedSeries> trackedList,
        Dictionary<int, string> seriesNames,
        List<RejectedRow> rejected)
    {
        int? tvdb = r.TvdbId
            ?? (r.SeriesUuid is string u && uuidToTvdb.TryGetValue(u, out var t) ? t : null);

        if (tvdb is not int tv) { rejected.Add(new(r.Key, RecordType.UserSeries, "não foi possível resolver o tvdb da série")); return; }

        var status = r.AsBool(r.IsArchived) ? SeriesStatus.Archived
            : r.AsBool(r.IsForLater) ? SeriesStatus.ForLater
            : SeriesStatus.Following; // Finished é derivado do progresso, não do export.

        trackedList.Add(new PlannedTrackedSeries(tv, status, r.FollowedAtUtc));

        if (!seriesNames.ContainsKey(tv))
            seriesNames[tv] = string.IsNullOrWhiteSpace(r.SeriesName) ? $"TVDB {tv}" : r.SeriesName!;
    }

    private static IReadOnlyList<VendorMetric> BuildVendorMetrics(
        TrackingRecord? statsRow,
        IReadOnlyList<PlannedEpisode> episodes,
        IReadOnlyList<PlannedTrackedSeries> trackedList)
    {
        if (statsRow is null) return Array.Empty<VendorMetric>();

        long distinctFollowed = trackedList.Select(t => t.TvdbId).Distinct().Count();
        long distinctWatchedEpisodes = episodes.Count; // cada chave já é um episódio distinto assistido
        long runtimeSum = episodes.Where(e => e.RuntimeSeconds is not null).Sum(e => (long)e.RuntimeSeconds!.Value);

        return new List<VendorMetric>
        {
            new("series_follow_count", statsRow.StatSeriesFollowCount, distinctFollowed,
                TolerancePct: 0, ExactExpected: true,
                Note: "Deriva limpo de uma contagem — deve bater exato."),

            new("ep_watch_count", statsRow.StatEpWatchCount, distinctWatchedEpisodes,
                TolerancePct: EpWatchTolerancePct, ExactExpected: false,
                Note: "Episódios distintos com exibição. O agregado do vendor tende a ser um cache defasado."),

            new("total_series_runtime", statsRow.StatTotalSeriesRuntime, runtimeSum,
                TolerancePct: RuntimeTolerancePct, ExactExpected: false,
                Note: "Soma dos runtimes gravados por linha. O vendor soma o runtime 'cheio' do metadado; recalculamos via TMDB.")
        };
    }
}
