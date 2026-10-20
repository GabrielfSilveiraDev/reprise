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

    /// <summary>
    /// Quando o estado mudou pela última vez — por você ou pela volta automática. É o "depois disto
    /// você já decidiu sobre a série": uma temporada que estreou antes não a traz de volta.
    ///
    /// <para>
    /// Nulo nas linhas anteriores a esta coluna (outubro de 2026), cuja data da decisão ninguém
    /// guardou. Para elas vale só a última exibição — ver <see cref="ShouldReturnFor"/>.
    /// </para>
    /// </summary>
    public DateTimeOffset? StatusChangedAt { get; set; }

    /// <summary>
    /// Quando a série voltou sozinha para Assistindo por causa de uma temporada nova — ver
    /// <see cref="ReturnForNewSeason"/>. Nulo quando o estado atual foi escolha sua: mudar o estado
    /// à mão apaga o marco, e a tela deixa de apresentar a série como "voltou".
    /// </summary>
    public DateTimeOffset? ReturnedAt { get; set; }

    /// <summary>
    /// Muda o estado por decisão sua. Falso se já estava assim — repetir não é mudança, e não pode
    /// mover o <see cref="StatusChangedAt"/>.
    /// </summary>
    public bool ChangeStatus(SeriesStatus status, DateTimeOffset now)
    {
        if (Status == status) return false;

        Status = status;
        StatusChangedAt = now;
        ReturnedAt = null;
        return true;
    }

    /// <summary>
    /// A estreia de temporada em <paramref name="premiere"/> traz esta série de volta para
    /// Assistindo?
    ///
    /// <para>
    /// <b>Só de Concluída ou Arquivada.</b> "Concluída" quer dizer "terminei o que havia", e
    /// "Arquivada", "parei de acompanhar" — nos dois casos a temporada nova é notícia que a pessoa
    /// não tem como ver, porque essas séries saem da fila e da agenda. "Para depois" já é uma
    /// promessa de voltar, e quem está assistindo já recebe o episódio na fila.
    /// </para>
    ///
    /// <para>
    /// <b>Só o que estreou depois da sua última palavra sobre a série</b> — a última exibição ou a
    /// última mudança de estado, a mais recente. Sem a mudança de estado, a volta seria um laço: você
    /// marca Concluída de novo porque não quer a temporada, e a passada seguinte a devolve. Sem a
    /// exibição, uma temporada que você deixou de lado de propósito (viu a T3 e parou, com a T2 sem
    /// ver) voltaria a ser oferecida. Sem nenhuma das duas, vale o dia em que a série entrou no acervo.
    /// </para>
    ///
    /// <para>
    /// <b>Por dia, em UTC</b>, como <see cref="Episode.Today"/>: a estreia é uma data sem hora, e a
    /// comparação estrita deixa de fora a temporada que estreou no próprio dia da sua decisão — que
    /// você provavelmente já sabia que existia.
    /// </para>
    /// </summary>
    public bool ShouldReturnFor(DateOnly premiere, DateTimeOffset? lastWatchedAt)
    {
        if (Status is not (SeriesStatus.Finished or SeriesStatus.Archived)) return false;

        var ultimaPalavra = (lastWatchedAt, StatusChangedAt) switch
        {
            ({ } exibicao, { } mudanca) => exibicao > mudanca ? exibicao : mudanca,
            ({ } exibicao, null) => exibicao,
            (null, { } mudanca) => mudanca,
            _ => AddedAt,
        };

        return premiere > DateOnly.FromDateTime(ultimaPalavra.UtcDateTime);
    }

    /// <summary>
    /// Volta para Assistindo porque estreou temporada nova. Não é escolha sua, e por isso fica
    /// marcada em <see cref="ReturnedAt"/>: é o que permite à tela contar o que aconteceu.
    /// </summary>
    public void ReturnForNewSeason(DateTimeOffset now)
    {
        Status = SeriesStatus.Following;
        StatusChangedAt = now;
        ReturnedAt = now;
    }
}
