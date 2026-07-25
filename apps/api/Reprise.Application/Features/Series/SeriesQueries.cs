using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Domain.Enums;

namespace Reprise.Application.Features.Series;

/// <summary>
/// Consultas de leitura do lado das séries. Progresso e "próximo a assistir" são DERIVADOS do log
/// de eventos (nada de flag mantida em sincronia). As agregações pesadas de estatística (heatmap,
/// distribuição mensal, streaks) ficam para a Fase 4, em SQL. Aqui, EF + <see cref="ProgressCalculator"/>.
/// </summary>
public sealed class SeriesQueries
{
    private readonly IRepriseDbContext _db;

    public SeriesQueries(IRepriseDbContext db) => _db = db;

    public async Task<IReadOnlyList<SeriesListItemDto>> GetListAsync(CancellationToken ct = default)
    {
        var tracked = await _db.TrackedSeries.Include(t => t.Series).ToListAsync(ct);
        if (tracked.Count == 0) return Array.Empty<SeriesListItemDto>();

        var seriesIds = tracked.Select(t => t.SeriesId).ToList();

        var eps = await _db.Episodes
            .Where(e => e.SeasonNumber > 0 && seriesIds.Contains(e.SeriesId))
            .Select(e => new { e.Id, e.SeriesId, e.SeasonNumber, e.EpisodeNumber, e.Name })
            .ToListAsync(ct);
        var epsBySeries = eps.GroupBy(e => e.SeriesId).ToDictionary(g => g.Key, g => g.ToList());

        var watchedIds = (await _db.WatchEvents
            .Where(w => w.Episode.SeasonNumber > 0)
            .Select(w => w.EpisodeId).Distinct().ToListAsync(ct)).ToHashSet();

        var lastBySeries = (await _db.WatchEvents
            .GroupBy(w => w.Episode.SeriesId)
            .Select(g => new { SeriesId = g.Key, Last = g.Max(w => (DateTimeOffset?)w.WatchedAt) })
            .ToListAsync(ct)).ToDictionary(x => x.SeriesId, x => x.Last);

        var result = new List<SeriesListItemDto>(tracked.Count);
        foreach (var t in tracked)
        {
            var list = epsBySeries.TryGetValue(t.SeriesId, out var l) ? l : [];
            var progress = ProgressCalculator.Compute(
                list.Select(e => new EpisodeProgressInput(e.Id, e.SeasonNumber, e.EpisodeNumber)), watchedIds);

            EpisodeRefDto? next = null;
            if (progress.NextUp is EpisodeProgressInput nu)
            {
                var name = list.First(e => e.Id == nu.EpisodeId).Name;
                next = new EpisodeRefDto(nu.EpisodeId, nu.SeasonNumber, nu.EpisodeNumber, name);
            }

            lastBySeries.TryGetValue(t.SeriesId, out var last);
            result.Add(new SeriesListItemDto(
                t.SeriesId, t.Series.TvdbId, t.Series.Name, t.Series.PosterPath, t.Status.ToString(),
                t.Series.Status,
                progress.EpisodesTotal, progress.EpisodesWatched, progress.CompletionRatio, last, next));
        }

        return result
            .OrderByDescending(r => r.LastWatchedAt ?? DateTimeOffset.MinValue)
            .ThenBy(r => r.Name)
            .ToList();
    }

    public async Task<SeriesDetailDto?> GetDetailAsync(long seriesId, CancellationToken ct = default)
    {
        var series = await _db.Series.FirstOrDefaultAsync(s => s.Id == seriesId, ct);
        if (series is null) return null;

        var tracked = await _db.TrackedSeries.FirstOrDefaultAsync(t => t.SeriesId == seriesId, ct);
        var status = tracked?.Status.ToString() ?? "Untracked";

        var epRows = await _db.Episodes
            .Where(e => e.SeriesId == seriesId)
            .Select(e => new
            {
                e.Id, e.SeasonNumber, e.EpisodeNumber, e.Name, e.RuntimeSeconds, e.IsSpecial,
                e.StillPath, e.AirDate,
                WatchCount = e.WatchEvents.Count(),
                Last = e.WatchEvents.Max(w => (DateTimeOffset?)w.WatchedAt)
            })
            .ToListAsync(ct);

        var seasons = epRows
            .GroupBy(e => e.SeasonNumber)
            .OrderBy(g => g.Key)
            .Select(g => new SeasonDto(
                g.Key, Name: null, IsSpecials: g.Key == 0,
                g.OrderBy(e => e.EpisodeNumber)
                    .Select(e => new EpisodeDto(
                        e.Id, e.SeasonNumber, e.EpisodeNumber, e.Name, e.RuntimeSeconds, e.IsSpecial,
                        e.WatchCount, e.Last, e.StillPath, e.AirDate))
                    .ToList()))
            .ToList();

        var regular = epRows.Where(e => e.SeasonNumber > 0).ToList();
        var total = regular.Count;
        var watched = regular.Count(e => e.WatchCount > 0);
        var ratio = total == 0 ? 0d : (double)watched / total;

        return new SeriesDetailDto(
            series.Id, series.TvdbId, series.Name, series.OriginalName, series.Overview, series.PosterPath,
            status, series.Status, series.FirstAirDate, total, watched, ratio, seasons);
    }

    /// <summary>Próximo episódio não visto de cada série ACOMPANHADA, ordenado por atividade recente.</summary>
    public async Task<IReadOnlyList<NextUpItemDto>> GetNextUpAsync(CancellationToken ct = default)
    {
        var list = await GetListAsync(ct);
        return list
            .Where(s => s.Status == nameof(SeriesStatus.Following) && s.NextUp is not null)
            .Select(s => new NextUpItemDto(s.Id, s.Name, s.PosterPath, s.NextUp!, s.LastWatchedAt))
            .ToList();
    }
}
