using Reprise.Domain.Enums;

namespace Reprise.Domain.Entities;

/// <summary>
/// Relação do usuário com uma série (o "eu acompanho isto"), separada do catálogo <see cref="Series"/>.
/// Tem <see cref="UserId"/> — é uma das entidades sujeitas ao filtro global de tenant.
/// </summary>
public class TrackedSeries
{
    public long Id { get; set; }

    public Guid UserId { get; set; }

    public long SeriesId { get; set; }
    public Series Series { get; set; } = null!;

    public SeriesStatus Status { get; set; } = SeriesStatus.Following;

    public DateTimeOffset? FollowedAt { get; set; }
    public DateTimeOffset AddedAt { get; set; }
    public string? Notes { get; set; }
}
