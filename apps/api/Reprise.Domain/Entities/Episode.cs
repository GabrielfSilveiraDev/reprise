using System.Linq.Expressions;

namespace Reprise.Domain.Entities;

/// <summary>
/// Episódio no catálogo. <see cref="IsSpecial"/> é derivado de <c>SeasonNumber == 0</c>
/// (a coluna <c>is_special</c> do export é inconfiável — só 9 de 10.515 linhas a preenchem).
/// </summary>
public class Episode
{
    public long Id { get; set; }

    public long SeriesId { get; set; }
    public Series Series { get; set; } = null!;

    public long SeasonId { get; set; }
    public Season Season { get; set; } = null!;

    public int? TmdbId { get; set; }
    public int SeasonNumber { get; set; }
    public int EpisodeNumber { get; set; }
    public string? Name { get; set; }
    public DateOnly? AirDate { get; set; }

    /// <summary>
    /// Caminho da imagem de cena do episódio no TMDB (o "still"), no formato <c>/abc123.jpg</c>.
    /// Nulo é comum e esperado: episódio antigo, especial ou de série pequena costuma não ter.
    /// </summary>
    public string? StillPath { get; set; }

    /// <summary>Runtime em segundos (o export vem em segundos: 2700 = 45 min).</summary>
    public int? RuntimeSeconds { get; set; }

    /// <summary>True quando o runtime foi estimado pelo TMDB por o export vir vazio.</summary>
    public bool RuntimeEstimated { get; set; }

    /// <summary>Especial (temporada 0) — contabilizado à parte do progresso das temporadas regulares.</summary>
    public bool IsSpecial { get; set; }

    public ICollection<WatchEvent> WatchEvents { get; set; } = new List<WatchEvent>();

    /// <summary>
    /// Já foi ao ar em <paramref name="today"/>?
    ///
    /// <para>
    /// <b>Data ausente conta como exibida.</b> São 391 episódios sem <c>air_date</c> — quase todos
    /// antigos ou especiais que o TMDB nunca datou. Bloqueá-los impediria alguém de registrar o
    /// que de fato assistiu, e o erro nessa direção é bem pior do que o oposto: o log de exibições
    /// é a fonte da verdade do app, então recusar um evento verdadeiro corrompe o dado, enquanto
    /// aceitar um evento duvidoso apenas o deixa lá para ser desmarcado.
    /// </para>
    ///
    /// <para>
    /// <b>Sobre o fuso.</b> Quem chama passa a data em UTC, que no Brasil vira o dia seguinte às
    /// 21h. O erro é sempre no sentido permissivo — a última hora do dia libera o episódio de
    /// amanhã —, e essa é a direção certa para um botão que a pessoa aperta assim que o episódio
    /// entra no ar.
    /// </para>
    /// </summary>
    public static bool HasAired(DateOnly? airDate, DateOnly today) => airDate is null || airDate.Value <= today;

    /// <summary>
    /// A MESMA regra de <see cref="HasAired"/>, numa forma que o EF traduz para SQL.
    ///
    /// Duas escritas da mesma condição é o preço de a regra valer nos dois lados: o comando
    /// verifica um episódio já carregado, e as consultas precisam contar milhares deles sem
    /// trazê-los. Mantê-las juntas no arquivo é o que impede de uma mudar sem a outra.
    /// </summary>
    public static Expression<Func<Episode, bool>> Aired(DateOnly today) =>
        e => e.AirDate == null || e.AirDate.Value <= today;

    /// <summary>Hoje, em UTC — o argumento de <see cref="HasAired"/> e <see cref="Aired"/>.</summary>
    public static DateOnly Today() => DateOnly.FromDateTime(DateTime.UtcNow);
}
