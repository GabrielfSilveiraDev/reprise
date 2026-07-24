using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Domain.Entities;
using Reprise.Domain.Enums;

namespace Reprise.Application.Import;

/// <summary>
/// Orquestra a importação: planeja (puro) e persiste de forma idempotente por fases.
/// A idempotência real é garantida pela chave natural <c>source_key</c> (índice único parcial):
/// reexecutar só cria eventos novos. Não toca no TMDB — o enriquecimento é um passo à parte.
/// </summary>
public sealed class ImportService
{
    private readonly IRepriseDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly ImportPlanner _planner;

    public ImportService(IRepriseDbContext db, ICurrentUser currentUser, ImportPlanner planner)
    {
        _db = db;
        _currentUser = currentUser;
        _planner = planner;
    }

    public async Task<ImportResult> ImportAsync(
        IReadOnlyList<TrackingRecord> records, string? sourceSha256, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var now = DateTimeOffset.UtcNow;
        var plan = _planner.Plan(records);

        var run = new ImportRun
        {
            UserId = userId,
            StartedAt = now,
            SourceFileSha256 = sourceSha256,
            RowsRead = plan.Reconciliation.Hard.RowsRead,
            Status = ImportStatus.Running
        };
        _db.ImportRuns.Add(run);

        // 1) Séries (catálogo global) — upsert por tvdb.
        var planTvdbs = plan.Series.Select(s => s.TvdbId).ToList();
        var seriesByTvdb = (await _db.Series
                .Where(s => s.TvdbId != null && planTvdbs.Contains(s.TvdbId.Value)).ToListAsync(ct))
            .ToDictionary(s => s.TvdbId!.Value);

        int seriesCreated = 0;
        foreach (var ps in plan.Series)
        {
            if (seriesByTvdb.ContainsKey(ps.TvdbId)) continue;
            var s = new Series { TvdbId = ps.TvdbId, Name = ps.ProvisionalName, CreatedAt = now, UpdatedAt = now };
            _db.Series.Add(s);
            seriesByTvdb[ps.TvdbId] = s;
            seriesCreated++;
        }
        await _db.SaveChangesAsync(ct); // materializa os ids das séries

        var seriesIds = seriesByTvdb.Values.Select(s => s.Id).ToList();

        // 2) Temporadas — uma por (série, número), inclusive a 0 dos especiais.
        var seasonByKey = (await _db.Seasons.Where(s => seriesIds.Contains(s.SeriesId)).ToListAsync(ct))
            .ToDictionary(s => (s.SeriesId, s.SeasonNumber));

        foreach (var (tvdb, sno) in plan.Episodes.Select(e => (e.Key.TvdbId, e.Key.SeasonNumber)).Distinct())
        {
            var sid = seriesByTvdb[tvdb].Id;
            if (seasonByKey.ContainsKey((sid, sno))) continue;
            var season = new Season { SeriesId = sid, SeasonNumber = sno };
            _db.Seasons.Add(season);
            seasonByKey[(sid, sno)] = season;
        }
        await _db.SaveChangesAsync(ct);

        // 3) Episódios — por (série, temporada, episódio).
        var epByKey = (await _db.Episodes.Where(e => seriesIds.Contains(e.SeriesId)).ToListAsync(ct))
            .ToDictionary(e => (e.SeriesId, e.SeasonNumber, e.EpisodeNumber));

        int episodesCreated = 0;
        foreach (var pe in plan.Episodes)
        {
            var sid = seriesByTvdb[pe.Key.TvdbId].Id;
            var k = (sid, pe.Key.SeasonNumber, pe.Key.EpisodeNumber);
            if (epByKey.ContainsKey(k)) continue;
            var ep = new Episode
            {
                SeriesId = sid,
                SeasonId = seasonByKey[(sid, pe.Key.SeasonNumber)].Id,
                SeasonNumber = pe.Key.SeasonNumber,
                EpisodeNumber = pe.Key.EpisodeNumber,
                RuntimeSeconds = pe.RuntimeSeconds,
                IsSpecial = pe.IsSpecial
            };
            _db.Episodes.Add(ep);
            epByKey[k] = ep;
            episodesCreated++;
        }
        await _db.SaveChangesAsync(ct);

        // 4) Eventos de exibição — idempotente por source_key.
        var plannedKeys = plan.Events.Select(e => e.SourceKey).ToList();
        var seen = (await _db.WatchEvents
                .Where(w => w.SourceKey != null && plannedKeys.Contains(w.SourceKey))
                .Select(w => w.SourceKey!).ToListAsync(ct))
            .ToHashSet(StringComparer.Ordinal);

        int eventsCreated = 0, eventsSkipped = 0;
        foreach (var pe in plan.Events)
        {
            if (!seen.Add(pe.SourceKey)) { eventsSkipped++; continue; } // já existe (ou duplicado no arquivo)
            var sid = seriesByTvdb[pe.Episode.TvdbId].Id;
            var epId = epByKey[(sid, pe.Episode.SeasonNumber, pe.Episode.EpisodeNumber)].Id;
            _db.WatchEvents.Add(WatchEvent.FromImport(userId, epId, pe.WatchedAt, pe.IsBackfill, pe.SourceKey));
            eventsCreated++;
        }
        await _db.SaveChangesAsync(ct);

        // 5) Estado das séries acompanhadas.
        var trackedBySeries = (await _db.TrackedSeries.Where(t => seriesIds.Contains(t.SeriesId)).ToListAsync(ct))
            .ToDictionary(t => t.SeriesId);

        int trackedUpserted = 0;
        foreach (var pt in plan.TrackedSeries.GroupBy(t => t.TvdbId).Select(g => g.Last()))
        {
            if (!seriesByTvdb.TryGetValue(pt.TvdbId, out var s)) continue;
            if (trackedBySeries.TryGetValue(s.Id, out var t))
            {
                t.Status = pt.Status;
                t.FollowedAt = pt.FollowedAt;
            }
            else
            {
                _db.TrackedSeries.Add(new TrackedSeries
                {
                    UserId = userId, SeriesId = s.Id, Status = pt.Status,
                    FollowedAt = pt.FollowedAt, AddedAt = now
                });
            }
            trackedUpserted++;
        }

        // 6) Finaliza a execução (o status reflete os invariantes duros).
        run.EventsCreated = eventsCreated;
        run.SeriesCreated = seriesCreated;
        run.SeriesUnmatched = plan.Series.Count; // enriquecimento TMDB (matching) é passo posterior
        run.SeriesTmdbMatched = 0;
        run.FinishedAt = DateTimeOffset.UtcNow;
        run.Status = plan.Reconciliation.HardInvariantsPassed ? ImportStatus.Completed : ImportStatus.Failed;
        run.ReconciliationJson = JsonSerializer.Serialize(plan.Reconciliation,
            new JsonSerializerOptions { WriteIndented = false });
        await _db.SaveChangesAsync(ct);

        return new ImportResult(
            run.Id, plan.Reconciliation.Hard.RowsRead, eventsCreated, eventsSkipped,
            seriesCreated, episodesCreated, trackedUpserted, plan.Series, plan);
    }
}
