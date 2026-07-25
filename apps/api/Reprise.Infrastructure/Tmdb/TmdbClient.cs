using Microsoft.Extensions.Options;
using Reprise.Application.Abstractions;
using TMDbLib.Client;
using TMDbLib.Objects.Find;

namespace Reprise.Infrastructure.Tmdb;

/// <summary>
/// Adaptador da TMDbLib para <see cref="ITmdbClient"/>. Existe para que a camada Application fale
/// o vocabulário do Reprise (segundos, <c>DateOnly</c>) e não o da biblioteca — trocar de provedor
/// de metadados depois toca só este arquivo.
/// </summary>
public sealed class TmdbClient : ITmdbClient, IDisposable
{
    private readonly TMDbClient _client;
    private readonly string _language;

    public TmdbClient(IOptions<TmdbOptions> options)
    {
        var o = options.Value;
        if (string.IsNullOrWhiteSpace(o.ApiKey))
            throw new InvalidOperationException(
                "Chave do TMDB ausente. Defina a variável de ambiente Tmdb__ApiKey (ou use dotnet user-secrets).");

        _language = o.Language;
        _client = new TMDbClient(o.ApiKey)
        {
            DefaultLanguage = o.Language,
            MaxRetryCount = o.MaxRetryCount,
            Timeout = TimeSpan.FromSeconds(o.TimeoutSeconds),
            ThrowApiExceptions = true
        };
    }

    public async Task<TmdbShow?> FindShowByTvdbIdAsync(int tvdbId, CancellationToken cancellationToken = default)
    {
        var found = await _client.FindAsync(FindExternalSource.TvDb, tvdbId.ToString(), cancellationToken);
        var hit = found?.TvResults?.FirstOrDefault();
        if (hit is null) return null;

        // O find devolve um resumo; os detalhes (runtime médio, status, nome original) exigem a segunda chamada.
        return await GetShowAsync(hit.Id, cancellationToken);
    }

    public async Task<TmdbShow?> GetShowAsync(int tmdbId, CancellationToken cancellationToken = default)
    {
        var show = await _client.GetTvShowAsync(tmdbId, language: _language, cancellationToken: cancellationToken);
        if (show is null) return null;

        // O TMDB já devolve o título original quando não há tradução no idioma pedido; o último
        // fallback só existe para a série sem título nenhum não virar string vazia na listagem.
        var name = Coalesce(show.Name, show.OriginalName) ?? $"TMDB {show.Id}";

        return new TmdbShow(
            show.Id,
            name,
            show.OriginalName,
            string.IsNullOrWhiteSpace(show.Overview) ? null : show.Overview,
            show.PosterPath,
            show.FirstAirDate is { } d ? DateOnly.FromDateTime(d) : null,
            show.Status,
            AverageRuntimeSeconds(show.EpisodeRunTime));
    }

    public async Task<string?> GetEnglishNameAsync(int tmdbId, CancellationToken cancellationToken = default)
    {
        var show = await _client.GetTvShowAsync(tmdbId, language: "en-US", cancellationToken: cancellationToken);
        return string.IsNullOrWhiteSpace(show?.Name) ? null : show.Name;
    }

    public async Task<IReadOnlyList<TmdbEpisode>> GetEpisodesAsync(
        int tmdbId, CancellationToken cancellationToken = default)
    {
        var show = await _client.GetTvShowAsync(tmdbId, language: _language, cancellationToken: cancellationToken);
        if (show?.Seasons is null) return [];

        var episodes = new List<TmdbEpisode>();
        foreach (var seasonRef in show.Seasons.OrderBy(x => x.SeasonNumber))
        {
            var season = await _client.GetTvSeasonAsync(
                tmdbId, seasonRef.SeasonNumber, language: _language, cancellationToken: cancellationToken);
            if (season?.Episodes is null) continue;

            episodes.AddRange(season.Episodes.Select(e => new TmdbEpisode(
                e.Id,
                season.SeasonNumber,
                (int)e.EpisodeNumber,
                string.IsNullOrWhiteSpace(e.Name) ? null : e.Name,
                e.AirDate is { } ad ? DateOnly.FromDateTime(ad) : null,
                e.Runtime is > 0 ? e.Runtime * 60 : null))); // TMDB dá minutos; o Reprise guarda segundos
        }

        return episodes;
    }

    private static string? Coalesce(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));

    /// <summary>Mediana dos runtimes declarados — mais resistente que a média a um piloto duplo ou final estendido.</summary>
    private static int? AverageRuntimeSeconds(IEnumerable<int>? runtimesInMinutes)
    {
        var values = runtimesInMinutes?.Where(v => v > 0).OrderBy(v => v).ToList();
        if (values is null || values.Count == 0) return null;
        return values[values.Count / 2] * 60;
    }

    public void Dispose() => _client.Dispose();
}
