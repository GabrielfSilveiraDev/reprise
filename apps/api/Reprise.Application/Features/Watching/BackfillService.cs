using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Domain.Entities;

namespace Reprise.Application.Features.Watching;

/// <summary>O que o preenchimento fez (ou faria, em ensaio).</summary>
public sealed record BackfillPlan(
    string SeriesName,
    IReadOnlyList<(long EpisodeId, int SeasonNumber, int EpisodeNumber, DateTimeOffset WatchedAt)> Events)
{
    public DateTimeOffset? From => Events.Count == 0 ? null : Events[0].WatchedAt;
    public DateTimeOffset? To => Events.Count == 0 ? null : Events[^1].WatchedAt;
}

/// <summary>
/// Recoloca exibições que aconteceram mas o export do TV Time perdeu.
///
/// Só toca em episódios <b>sem nenhuma exibição</b>: nunca cria um rewatch acidental por cima do
/// que já existe. A data vem do <see cref="BackfillPlanner"/>, interpolada entre a última exibição
/// anterior e a primeira posterior <i>da mesma série</i>.
/// </summary>
public sealed class BackfillService
{
    private readonly IRepriseDbContext _db;
    private readonly ICurrentUser _currentUser;

    public BackfillService(IRepriseDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    /// <summary>Monta o plano sem gravar. <paramref name="seasonNumber"/> nulo = a série inteira.</summary>
    public async Task<BackfillPlan?> PlanAsync(
        long seriesId, int? seasonNumber, IReadOnlyList<long>? onlyEpisodeIds, CancellationToken ct = default)
    {
        var series = await _db.Series.FirstOrDefaultAsync(s => s.Id == seriesId, ct);
        if (series is null) return null;

        var query = _db.Episodes.Where(e => e.SeriesId == seriesId && !e.WatchEvents.Any());
        if (seasonNumber is int sn) query = query.Where(e => e.SeasonNumber == sn);
        if (onlyEpisodeIds is { Count: > 0 }) query = query.Where(e => onlyEpisodeIds.Contains(e.Id));

        var targets = await query
            .OrderBy(e => e.SeasonNumber).ThenBy(e => e.EpisodeNumber)
            .Select(e => new { e.Id, e.SeasonNumber, e.EpisodeNumber })
            .ToListAsync(ct);

        if (targets.Count == 0) return new BackfillPlan(series.Name, []);

        var first = targets[0];
        var last = targets[^1];

        // Os vizinhos são procurados por posição na série, não por temporada: um buraco no meio
        // de uma temporada tem vizinhos dentro dela mesma.
        var after = await NeighbourAsync(seriesId, first.SeasonNumber, first.EpisodeNumber, before: true, ct);
        var before = await NeighbourAsync(seriesId, last.SeasonNumber, last.EpisodeNumber, before: false, ct);

        var dates = BackfillPlanner.Distribute(after, before, targets.Count, DateTimeOffset.UtcNow);

        return new BackfillPlan(
            series.Name,
            targets.Zip(dates, (t, d) => (t.Id, t.SeasonNumber, t.EpisodeNumber, d)).ToList());
    }

    /// <summary>Última exibição antes do ponto, ou primeira depois dele.</summary>
    private async Task<DateTimeOffset?> NeighbourAsync(
        long seriesId, int seasonNumber, int episodeNumber, bool before, CancellationToken ct)
    {
        var events = _db.WatchEvents.Where(w => w.Episode.SeriesId == seriesId);

        return before
            ? await events
                .Where(w => w.Episode.SeasonNumber < seasonNumber
                            || (w.Episode.SeasonNumber == seasonNumber && w.Episode.EpisodeNumber < episodeNumber))
                .MaxAsync(w => (DateTimeOffset?)w.WatchedAt, ct)
            : await events
                .Where(w => w.Episode.SeasonNumber > seasonNumber
                            || (w.Episode.SeasonNumber == seasonNumber && w.Episode.EpisodeNumber > episodeNumber))
                .MinAsync(w => (DateTimeOffset?)w.WatchedAt, ct);
    }

    public async Task<int> ApplyAsync(BackfillPlan plan, CancellationToken ct = default)
    {
        if (plan.Events.Count == 0) return 0;

        foreach (var (episodeId, _, _, watchedAt) in plan.Events)
            _db.WatchEvents.Add(WatchEvent.CreateBackfill(_currentUser.UserId, episodeId, watchedAt));

        await _db.SaveChangesAsync(ct);
        return plan.Events.Count;
    }
}
