using Reprise.Domain.Enums;

namespace Reprise.Domain.Entities;

/// <summary>
/// ⭐ A fonte da verdade. Cada exibição é uma linha imutável e append-only.
/// Progresso, contagem de rewatch, streaks e estatísticas são todos derivados deste log.
/// Desmarcar um episódio é remover o evento correspondente, não inverter um booleano.
/// </summary>
public class WatchEvent
{
    public long Id { get; set; }

    public Guid UserId { get; set; }

    public long EpisodeId { get; set; }
    public Episode Episode { get; set; } = null!;

    public DateTimeOffset WatchedAt { get; set; }

    public WatchEventSource Source { get; set; }

    /// <summary>
    /// Marcação em massa (herdou a data da importação, não da exibição real).
    /// Excluído por padrão dos gráficos temporais, com toggle para incluir.
    /// </summary>
    public bool IsBackfill { get; set; }

    /// <summary>
    /// Chave natural de idempotência: o <c>key</c> original do export
    /// (<c>watch-episode-…</c> / <c>rewatch-episode-…-n</c>). UNIQUE.
    /// Nulo para eventos criados manualmente no app.
    /// </summary>
    public string? SourceKey { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    private WatchEvent() { }

    /// <summary>Cria um evento vindo da importação (a data da exibição é o <c>created_at</c> do export).</summary>
    public static WatchEvent FromImport(Guid userId, long episodeId, DateTimeOffset watchedAt, bool isBackfill, string sourceKey)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sourceKey);
        return new WatchEvent
        {
            UserId = userId,
            EpisodeId = episodeId,
            WatchedAt = watchedAt,
            Source = WatchEventSource.TvTimeImport,
            IsBackfill = isBackfill,
            SourceKey = sourceKey,
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    /// <summary>
    /// Exibição que aconteceu mas o export perdeu, recolocada com data <b>inferida</b> dos
    /// vizinhos. Nasce como <see cref="IsBackfill"/> justamente por isso: a data é uma estimativa
    /// honesta, e as estatísticas temporais devem poder deixá-la de fora.
    /// </summary>
    public static WatchEvent CreateBackfill(Guid userId, long episodeId, DateTimeOffset watchedAt)
        => new()
        {
            UserId = userId,
            EpisodeId = episodeId,
            WatchedAt = watchedAt,
            Source = WatchEventSource.Manual,
            IsBackfill = true,
            SourceKey = null,
            CreatedAt = DateTimeOffset.UtcNow
        };

    /// <summary>Cria um evento marcado manualmente pelo usuário no app (nunca é backfill).</summary>
    public static WatchEvent CreateManual(Guid userId, long episodeId, DateTimeOffset watchedAt)
        => new()
        {
            UserId = userId,
            EpisodeId = episodeId,
            WatchedAt = watchedAt,
            Source = WatchEventSource.Manual,
            IsBackfill = false,
            SourceKey = null,
            CreatedAt = DateTimeOffset.UtcNow
        };
}
