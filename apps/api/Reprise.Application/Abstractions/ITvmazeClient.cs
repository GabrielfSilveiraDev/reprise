namespace Reprise.Application.Abstractions;

/// <summary>
/// O TVmaze, fonte de <b>quando</b> um episódio sai.
///
/// <para>
/// Entra ao lado do TMDB, não no lugar dele: o TMDB continua dono do catálogo (nomes, sinopses,
/// pôsteres, temporadas), e o TVmaze responde só à pergunta de agenda, que é onde o TMDB não tem
/// dado — a <c>air_date</c> dele não tem hora nem fuso.
/// </para>
///
/// <para>
/// <b>Sem chave de API.</b> É aberta, e é uma das razões da escolha: o TheTVDB, que também teria o
/// horário, exigiria mais um segredo para configurar e perder, e traz horário justamente onde ele
/// é menos útil (grade linear) e não em streaming.
/// </para>
/// </summary>
public interface ITvmazeClient
{
    /// <summary>
    /// Acha a série pelo id do TheTVDB — o casamento preferido, porque é identidade e não texto.
    /// Cobre 116 das 118 séries do acervo. Nulo quando o TVmaze não conhece o id.
    /// </summary>
    Task<TvmazeShow?> FindByTvdbIdAsync(int tvdbId, CancellationToken cancellationToken = default);

    /// <summary>
    /// O recurso das que não têm <c>tvdb_id</c> (as adicionadas pela busca do TMDB, e não pelo
    /// export). Casamento por texto é pior por natureza — <i>Monster</i> e <i>Dark Matter</i> são
    /// nomes que várias séries compartilham —, então quem chama confere o ano antes de aceitar.
    /// </summary>
    Task<TvmazeShow?> SearchByNameAsync(string name, CancellationToken cancellationToken = default);

    /// <summary>Os episódios da série, com data e — quando existe — horário.</summary>
    Task<IReadOnlyList<TvmazeEpisode>> GetEpisodesAsync(int tvmazeId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Ids do TVmaze alterados desde <paramref name="since"/> (<c>day</c>, <c>week</c> ou
    /// <c>month</c>), com o instante da alteração.
    ///
    /// É o que permite ressincronizar só o que mudou em vez de varrer o acervo: uma requisição
    /// devolve o feed inteiro (algumas centenas de séries por dia, no mundo todo), e a interseção
    /// com o catálogo local costuma ser de meia dúzia.
    /// </summary>
    Task<IReadOnlyDictionary<int, DateTimeOffset>> GetUpdatedSinceAsync(
        string since = "week", CancellationToken cancellationToken = default);
}

/// <param name="PremieredYear">
/// Ano de estreia da série, usado só para conferir um casamento feito por nome.
/// </param>
/// <param name="Network">
/// Nome do canal ou serviço, para relatório — é por ele que se vê que a divergência de datas é
/// por serviço (Apple TV sempre um dia à frente, Netflix nunca).
/// </param>
public sealed record TvmazeShow(int Id, string Name, int? PremieredYear, string? Network);

/// <param name="AirStamp">
/// O instante exato — <b>só quando <paramref name="HasDeclaredTime"/> é verdadeiro</b>. Em
/// streaming o TVmaze devolve meio-dia UTC de enchimento, e quem consome não pode confundir isso
/// com horário de estreia.
/// </param>
/// <param name="HasDeclaredTime">
/// O TVmaze declarou horário de exibição para este episódio? É o que separa TV linear (26 das 64
/// séries acompanhadas, com hora de verdade) de streaming (o resto, só data).
/// </param>
public sealed record TvmazeEpisode(
    int SeasonNumber,
    int EpisodeNumber,
    DateOnly? AirDate,
    DateTimeOffset? AirStamp,
    bool HasDeclaredTime);
