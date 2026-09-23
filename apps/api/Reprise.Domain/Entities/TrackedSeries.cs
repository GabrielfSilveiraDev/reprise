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

    /// <summary>
    /// Quando o usuário tirou a revisão desta série da fila de próximos. A revisão só volta se
    /// houver uma exibição repetida DEPOIS deste instante — tirar da fila é "não estou mais
    /// revendo", e remarcar é o próprio usuário dizendo o contrário.
    ///
    /// <para>
    /// Um instante, e não um booleano: com um sinalizador, a revisão do ano que vem nasceria
    /// escondida, e alguém teria de lembrar de desligá-lo.
    /// </para>
    /// </summary>
    public DateTimeOffset? RewatchDismissedAt { get; set; }
}
