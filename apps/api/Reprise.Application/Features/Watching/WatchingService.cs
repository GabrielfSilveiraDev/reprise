using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Application.Features.Series;
using Reprise.Domain.Entities;

namespace Reprise.Application.Features.Watching;

/// <summary>
/// Comandos de marcação. Coerente com o princípio central: marcar = <b>acrescentar</b> um evento ao log;
/// desmarcar = <b>remover</b> um evento. Marcar um episódio já visto é, por construção, um rewatch —
/// não há operação separada. Marcações em massa (temporada / "até aqui") só criam eventos para o que
/// ainda não foi visto (não geram rewatches acidentais).
/// </summary>
public sealed class WatchingService
{
    private readonly IRepriseDbContext _db;
    private readonly ICurrentUser _currentUser;

    public WatchingService(IRepriseDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    /// <summary>Marca um episódio como visto (append). Chamado de novo no mesmo episódio = rewatch.</summary>
    public async Task<WatchStateDto?> MarkAsync(long episodeId, DateTimeOffset? watchedAt, CancellationToken ct = default)
    {
        var exists = await _db.Episodes.AnyAsync(e => e.Id == episodeId, ct);
        if (!exists) return null;

        _db.WatchEvents.Add(WatchEvent.CreateManual(_currentUser.UserId, episodeId, watchedAt ?? DateTimeOffset.UtcNow));
        await _db.SaveChangesAsync(ct);
        return await StateAsync(episodeId, ct);
    }

    /// <summary>Desmarca: remove a exibição mais recente do episódio (decrementa o rewatch).</summary>
    public async Task<WatchStateDto?> UnmarkAsync(long episodeId, CancellationToken ct = default)
    {
        var exists = await _db.Episodes.AnyAsync(e => e.Id == episodeId, ct);
        if (!exists) return null;

        var latest = await _db.WatchEvents
            .Where(w => w.EpisodeId == episodeId)
            .OrderByDescending(w => w.WatchedAt)
            .FirstOrDefaultAsync(ct);

        if (latest is not null)
        {
            _db.WatchEvents.Remove(latest);
            await _db.SaveChangesAsync(ct);
        }
        return await StateAsync(episodeId, ct);
    }

    /// <summary>Marca a temporada inteira: cria eventos apenas para os episódios ainda não vistos.</summary>
    public async Task<int> MarkSeasonAsync(long seriesId, int seasonNumber, DateTimeOffset? watchedAt, CancellationToken ct = default)
    {
        var unseen = await _db.Episodes
            .Where(e => e.SeriesId == seriesId && e.SeasonNumber == seasonNumber && !e.WatchEvents.Any())
            .Select(e => e.Id)
            .ToListAsync(ct);

        return await MarkManyAsync(unseen, watchedAt, ct);
    }

    /// <summary>"Marcar até aqui": todos os episódios regulares até (temporada, episódio), ainda não vistos.</summary>
    public async Task<int> MarkUpToAsync(long seriesId, int seasonNumber, int episodeNumber, DateTimeOffset? watchedAt, CancellationToken ct = default)
    {
        var unseen = await _db.Episodes
            .Where(e => e.SeriesId == seriesId && e.SeasonNumber > 0 && !e.WatchEvents.Any()
                        && (e.SeasonNumber < seasonNumber
                            || (e.SeasonNumber == seasonNumber && e.EpisodeNumber <= episodeNumber)))
            .Select(e => e.Id)
            .ToListAsync(ct);

        return await MarkManyAsync(unseen, watchedAt, ct);
    }

    private async Task<int> MarkManyAsync(IReadOnlyList<long> episodeIds, DateTimeOffset? watchedAt, CancellationToken ct)
    {
        if (episodeIds.Count == 0) return 0;
        var when = watchedAt ?? DateTimeOffset.UtcNow;
        foreach (var id in episodeIds)
            _db.WatchEvents.Add(WatchEvent.CreateManual(_currentUser.UserId, id, when));
        await _db.SaveChangesAsync(ct);
        return episodeIds.Count;
    }

    private async Task<WatchStateDto> StateAsync(long episodeId, CancellationToken ct)
    {
        var agg = await _db.WatchEvents
            .Where(w => w.EpisodeId == episodeId)
            .GroupBy(w => w.EpisodeId)
            .Select(g => new { Count = g.Count(), Last = g.Max(w => (DateTimeOffset?)w.WatchedAt) })
            .FirstOrDefaultAsync(ct);

        return new WatchStateDto(episodeId, agg?.Count ?? 0, agg?.Last);
    }
}
