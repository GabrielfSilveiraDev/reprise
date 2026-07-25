namespace Reprise.Application.Abstractions;

/// <summary>
/// Cliente de metadados do TMDB, usado apenas no passo de <b>enriquecimento</b> (opcional):
/// casa a série pelo id do TheTVDB e preenche nome/temporadas/episódios/runtime ausente.
/// O núcleo do importador (log de eventos + stubs de catálogo) não depende disto.
/// </summary>
public interface ITmdbClient
{
    /// <summary>Casa uma série pelo id do TheTVDB via <c>find/{id}?external_source=tvdb_id</c>.</summary>
    Task<TmdbShow?> FindShowByTvdbIdAsync(int tvdbId, CancellationToken cancellationToken = default);

    /// <summary>Busca a série direto pelo id do TMDB — caminho de um <c>SeriesMatchOverride</c> manual.</summary>
    Task<TmdbShow?> GetShowAsync(int tmdbId, CancellationToken cancellationToken = default);

    /// <summary>Episódios da série (todas as temporadas, incluindo especiais).</summary>
    Task<IReadOnlyList<TmdbEpisode>> GetEpisodesAsync(int tmdbId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Título em inglês. Chamada à parte porque só é necessária quando o título original não está
    /// em alfabeto latino — pagar essa requisição para as 100+ séries ocidentais seria desperdício.
    /// </summary>
    Task<string?> GetEnglishNameAsync(int tmdbId, CancellationToken cancellationToken = default);
}

public sealed record TmdbShow(
    int TmdbId,
    string Name,
    string? OriginalName,
    string? Overview,
    string? PosterPath,
    DateOnly? FirstAirDate,
    string? Status,
    int? AverageRuntimeSeconds);

public sealed record TmdbEpisode(
    int? TmdbId,
    int SeasonNumber,
    int EpisodeNumber,
    string? Name,
    DateOnly? AirDate,
    int? RuntimeSeconds,
    string? StillPath = null);
