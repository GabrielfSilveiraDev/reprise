namespace Reprise.Application.Abstractions;

/// <summary>
/// Cliente de metadados do TMDB. Serve a dois caminhos: o <b>enriquecimento</b> (opcional) do
/// acervo importado do TV Time, que casa a série pelo id do TheTVDB e preenche
/// nome/temporadas/episódios/runtime ausente; e a <b>busca</b>, por onde entram séries novas que
/// nunca estiveram no export. O núcleo do importador (log de eventos + stubs de catálogo) não
/// depende disto.
/// </summary>
public interface ITmdbClient
{
    /// <summary>Casa uma série pelo id do TheTVDB via <c>find/{id}?external_source=tvdb_id</c>.</summary>
    Task<TmdbShow?> FindShowByTvdbIdAsync(int tvdbId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Busca séries por texto livre — é o que alimenta a barra de pesquisa dos clientes.
    /// Devolve no máximo uma página do TMDB (20 resultados); paginar aqui seria dar corda para
    /// rolar até o fim de uma lista que ninguém lê depois do décimo item.
    /// </summary>
    Task<IReadOnlyList<TmdbSearchHit>> SearchShowsAsync(
        string query, CancellationToken cancellationToken = default);

    /// <summary>Busca a série direto pelo id do TMDB — caminho de um <c>SeriesMatchOverride</c> manual.</summary>
    Task<TmdbShow?> GetShowAsync(int tmdbId, CancellationToken cancellationToken = default);

    /// <summary>Episódios da série (todas as temporadas, incluindo especiais).</summary>
    Task<IReadOnlyList<TmdbEpisode>> GetEpisodesAsync(int tmdbId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Título em inglês. Chamada à parte porque só é necessária quando o título original não está
    /// em alfabeto latino — pagar essa requisição para as 100+ séries ocidentais seria desperdício.
    /// </summary>
    Task<string?> GetEnglishNameAsync(int tmdbId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Uma requisição barata ao TMDB cujo único propósito é manter viva a conexão do pool.
    ///
    /// <para>
    /// O <c>SocketsHttpHandler</c> fecha conexão ociosa em um minuto, e o aperto de mão TLS com o
    /// TMDB custa cerca de 300 ms — mais do que a resposta inteira. Na prática isso significa que a
    /// primeira busca depois de um tempo parado leva quase o triplo de uma busca com a conexão
    /// aberta: 0,44 s contra 0,17 s, medido contra a API real. Isto existe para que essa primeira
    /// busca não exista.
    /// </para>
    /// </summary>
    Task WarmUpAsync(CancellationToken cancellationToken = default);
}

public sealed record TmdbShow(
    int TmdbId,
    string Name,
    string? OriginalName,
    string? Overview,
    string? PosterPath,
    DateOnly? FirstAirDate,
    string? Status,
    int? AverageRuntimeSeconds,
    /// <summary>
    /// País de origem (ISO 3166-1 alfa-2), o primeiro que o TMDB lista. É o insumo do
    /// <c>ReleaseSchedule</c>: sem ele, a data de estreia não tem fuso a que se referir.
    /// </summary>
    string? OriginCountry);

/// <summary>
/// Um resultado da busca por texto. É deliberadamente mais magro que <see cref="TmdbShow"/>: a
/// lista de resultados não precisa de runtime médio nem de status de produção, e cada campo a mais
/// aqui é uma chamada a mais ao TMDB por item.
/// </summary>
/// <param name="Name">Título no idioma configurado (pt-BR) — só serve de último recurso.</param>
/// <param name="EnglishName">
/// Título em <c>en-US</c>. Vem junto porque a política de nome do Reprise precisa dele quando o
/// título original não é legível em alfabeto latino — ver <c>SeriesNamePolicy</c>. Buscá-lo depois,
/// por resultado, seria uma requisição por linha da lista.
/// </param>
public sealed record TmdbSearchHit(
    int TmdbId,
    string Name,
    string? EnglishName,
    string? OriginalName,
    string? Overview,
    string? PosterPath,
    DateOnly? FirstAirDate);

public sealed record TmdbEpisode(
    int? TmdbId,
    int SeasonNumber,
    int EpisodeNumber,
    string? Name,
    DateOnly? AirDate,
    int? RuntimeSeconds,
    string? StillPath = null,
    string? Overview = null);
