using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Reprise.Application.Abstractions;
using TMDbLib.Client;
using TMDbLib.Objects.Find;
using TMDbLib.Objects.General;
using TMDbLib.Objects.TvShows;

namespace Reprise.Infrastructure.Tmdb;

/// <summary>
/// Adaptador da TMDbLib para <see cref="ITmdbClient"/>. Existe para que a camada Application fale
/// o vocabulário do Reprise (segundos, <c>DateOnly</c>) e não o da biblioteca — trocar de provedor
/// de metadados depois toca só este arquivo.
/// </summary>
public sealed class TmdbClient : ITmdbClient, IDisposable
{
    private const string EnglishLanguage = "en-US";
    private const string EnglishImageLanguage = "en";

    private readonly TMDbClient _client;
    private readonly IMemoryCache _cache;
    private readonly string _language;

    /// <summary>
    /// Prefixo do idioma configurado ("pt", de "pt-BR"). Os pôsteres do TMDB são marcados pelo
    /// código de duas letras, não pelo par com região.
    /// </summary>
    private readonly string _imageLanguage;

    /// <summary>
    /// O que pedir em <c>include_image_language</c>. O <c>null</c> no fim traz os pôsteres sem
    /// idioma — a arte original, sem texto —, que são a rede de segurança quando não há nem
    /// inglês nem português.
    /// </summary>
    private readonly string _includeImageLanguages;

    public TmdbClient(IOptions<TmdbOptions> options, IMemoryCache cache)
    {
        _cache = cache;
        var o = options.Value;
        if (string.IsNullOrWhiteSpace(o.ApiKey))
            throw new InvalidOperationException(
                "Chave do TMDB ausente. Defina a variável de ambiente Tmdb__ApiKey (ou use dotnet user-secrets).");

        _language = o.Language;
        _imageLanguage = TwoLetter(o.Language);
        _includeImageLanguages = _imageLanguage == EnglishImageLanguage
            ? $"{EnglishImageLanguage},null"
            : $"{EnglishImageLanguage},{_imageLanguage},null";

        // O TMDB entrega DUAS credenciais na mesma tela e é fácil copiar a errada: a chave v3
        // (32 hexadecimais, viaja na query como `api_key`) e o "API Read Access Token" v4 (um JWT,
        // viaja em `Authorization: Bearer`). A TMDbLib só conhece a primeira, e seu único construtor
        // público não aceita um handler onde se pudesse pôr o cabeçalho.
        //
        // Com um token v4 ela monta `api_key=eyJ...` e o TMDB responde 401 em TODA chamada — busca,
        // enriquecimento, tudo. Recusar aqui, dizendo qual é a credencial certa, é melhor do que
        // deixar a descoberta para o primeiro 401 sem explicação no meio de uma busca.
        if (IsReadAccessToken(o.ApiKey))
            throw new InvalidOperationException(
                "Tmdb__ApiKey contém o 'API Read Access Token' (v4) do TMDB, e o cliente usado aqui " +
                "exige a chave v3. As duas ficam na mesma página: themoviedb.org > Configurações > " +
                "API. A v3 tem 32 caracteres hexadecimais; a v4 é um JWT começando com 'eyJ'.");

        _client = new TMDbClient(o.ApiKey)
        {
            DefaultLanguage = o.Language,
            MaxRetryCount = o.MaxRetryCount,
            Timeout = TimeSpan.FromSeconds(o.TimeoutSeconds),
            ThrowApiExceptions = true
        };
    }

    /// <summary>
    /// Token v4 do TMDB: um JWT. A chave v3 é hexadecimal e nunca tem ponto, então o formato
    /// separa os dois sem ambiguidade.
    /// </summary>
    private static bool IsReadAccessToken(string key) =>
        key.StartsWith("eyJ", StringComparison.Ordinal) && key.Contains('.');

    /// <summary>
    /// A chave configurada dá para usar? Serve ao host decidir se registra o TMDB: registrar com
    /// uma chave que este cliente recusa transformaria a busca num 500, quando o certo é ela dizer
    /// que o recurso está indisponível e por quê.
    /// </summary>
    public static bool IsUsableApiKey(string? key) =>
        !string.IsNullOrWhiteSpace(key) && !IsReadAccessToken(key);

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
        // As imagens vêm na MESMA requisição (`append_to_response`), não numa segunda: é o que
        // permite escolher o pôster em inglês sem dobrar o número de chamadas do enriquecimento,
        // que percorre o acervo inteiro.
        var show = await _client.GetTvShowAsync(
            tmdbId,
            TvShowMethods.Images,
            language: _language,
            includeImageLanguage: _includeImageLanguages,
            cancellationToken: cancellationToken);
        if (show is null) return null;

        // O TMDB já devolve o título original quando não há tradução no idioma pedido; o último
        // fallback só existe para a série sem título nenhum não virar string vazia na listagem.
        var name = Coalesce(show.Name, show.OriginalName) ?? $"TMDB {show.Id}";

        return new TmdbShow(
            show.Id,
            name,
            show.OriginalName,
            string.IsNullOrWhiteSpace(show.Overview) ? null : show.Overview,
            PickPoster(show.Images?.Posters, show.PosterPath),
            show.FirstAirDate is { } d ? DateOnly.FromDateTime(d) : null,
            show.Status,
            AverageRuntimeSeconds(show.EpisodeRunTime));
    }

    /// <inheritdoc />
    /// <remarks>
    /// <para>
    /// <b>Duas requisições em paralelo, e não uma.</b> Uma busca dispara duas chamadas simultâneas
    /// — textos no idioma configurado, pôster em inglês. Em HTTP/1.1 cada requisição concorrente
    /// ocupa uma conexão própria, então aquecer só uma deixava a segunda pagando o aperto de mão:
    /// medido em 0,35 s na primeira busca depois de um tempo parado, contra 0,17 s na seguinte,
    /// quando as duas conexões já existiam. O aquecimento tem de espelhar a concorrência real de
    /// quem ele serve.
    /// </para>
    /// <para>
    /// <c>/configuration</c> é o endpoint mais barato do TMDB. O <c>GetConfigAsync</c> da TMDbLib
    /// não aceita token de cancelamento, então o <c>WaitAsync</c> entra para que o desligamento da
    /// API não fique esperando uma requisição de aquecimento terminar.
    /// </para>
    /// </remarks>
    public Task WarmUpAsync(CancellationToken cancellationToken = default)
        => Task.WhenAll(
            _client.GetConfigAsync().WaitAsync(cancellationToken),
            _client.GetConfigAsync().WaitAsync(cancellationToken));

    public async Task<IReadOnlyList<TmdbSearchHit>> SearchShowsAsync(
        string query, CancellationToken cancellationToken = default)
    {
        var termo = query.Trim();
        if (termo.Length == 0) return [];

        /*
            Cache do resultado do TMDB, e só dele.

            O que entra aqui é a resposta crua do TMDB — nada do usuário. É deliberado: o
            `SeriesCatalogService` cruza estes resultados com o acervo DE QUEM PERGUNTOU, e guardar
            o DTO já cruzado faria a resposta de uma pessoa aparecer para outra. O cruzamento é uma
            consulta local e barata; a chamada de rede é que custa.

            Meia hora de validade porque catálogo de série não muda em minutos, e a chave é o termo
            normalizado — quem digita "Dark" e "dark  " faz uma pergunta só.
        */
        var chave = $"tmdb:search:{_language}:{termo.ToLowerInvariant()}";
        if (_cache.TryGetValue(chave, out IReadOnlyList<TmdbSearchHit>? emCache) && emCache is not null)
            return emCache;

        var hits = await SearchNoTmdbAsync(termo, cancellationToken);
        _cache.Set(chave, hits, TimeSpan.FromMinutes(30));
        return hits;
    }

    private async Task<IReadOnlyList<TmdbSearchHit>> SearchNoTmdbAsync(
        string termo, CancellationToken cancellationToken)
    {
        // DUAS buscas, não uma consulta de imagens por resultado.
        //
        // O pôster deve vir em inglês, e o `poster_path` que a busca devolve é o do idioma pedido.
        // Pedir as imagens de cada linha custaria 20 requisições por tecla digitada. Duas buscas em
        // paralelo, casadas por id, dão o mesmo resultado a custo fixo: os textos saem da busca no
        // idioma configurado e o pôster, da busca em inglês.
        var localizadaTask = _client.SearchTvShowAsync(termo, _language, 1, false, 0, cancellationToken);
        var inglesTask = _client.SearchTvShowAsync(termo, EnglishLanguage, 1, false, 0, cancellationToken);
        await Task.WhenAll(localizadaTask, inglesTask);

        var localizada = (await localizadaTask)?.Results ?? [];
        var ingles = ((await inglesTask)?.Results ?? [])
            .GroupBy(r => r.Id)
            .ToDictionary(g => g.Key, g => g.First());

        var hits = new List<TmdbSearchHit>(localizada.Count);
        foreach (var r in localizada)
        {
            ingles.TryGetValue(r.Id, out var en);

            hits.Add(new TmdbSearchHit(
                r.Id,
                Coalesce(r.Name, r.OriginalName) ?? $"TMDB {r.Id}",
                string.IsNullOrWhiteSpace(en?.Name) ? null : en.Name,
                r.OriginalName,
                string.IsNullOrWhiteSpace(r.Overview) ? null : r.Overview,
                // Inglês primeiro; só então o do idioma configurado. Um dos dois costuma existir,
                // e quando nenhum existe o campo é nulo e o cliente desenha o espaço vazio.
                Coalesce(en?.PosterPath, r.PosterPath),
                r.FirstAirDate is { } d ? DateOnly.FromDateTime(d) : null));
        }

        return hits;
    }

    /// <summary>
    /// Escolhe o pôster: inglês, depois o idioma configurado, depois a arte sem idioma, e por fim
    /// o <c>poster_path</c> que o TMDB elegeu sozinho. Dentro de cada idioma vence o mais votado —
    /// a lista vem por ordem de upload, e a primeira nem sempre é a boa.
    /// </summary>
    private string? PickPoster(IReadOnlyList<ImageData>? posters, string? fallback)
    {
        if (posters is null || posters.Count == 0) return fallback;

        return BestIn(posters, EnglishImageLanguage)
               ?? BestIn(posters, _imageLanguage)
               ?? BestIn(posters, null)
               ?? fallback;
    }

    private static string? BestIn(IReadOnlyList<ImageData> posters, string? iso) =>
        posters
            .Where(p => !string.IsNullOrWhiteSpace(p.FilePath) && MatchesLanguage(p.Iso_639_1, iso))
            .OrderByDescending(p => p.VoteAverage)
            .FirstOrDefault()
            ?.FilePath;

    /// <summary>O TMDB manda o pôster sem idioma ora como <c>null</c>, ora como string vazia.</summary>
    private static bool MatchesLanguage(string? actual, string? wanted) =>
        string.IsNullOrWhiteSpace(wanted)
            ? string.IsNullOrWhiteSpace(actual)
            : string.Equals(actual, wanted, StringComparison.OrdinalIgnoreCase);

    private static string TwoLetter(string language)
    {
        var dash = language.IndexOf('-');
        return (dash > 0 ? language[..dash] : language).ToLowerInvariant();
    }

    public async Task<string?> GetEnglishNameAsync(int tmdbId, CancellationToken cancellationToken = default)
    {
        var show = await _client.GetTvShowAsync(tmdbId, language: "en-US", cancellationToken: cancellationToken);
        return string.IsNullOrWhiteSpace(show?.Name) ? null : show.Name;
    }

    /// <summary>
    /// Episódios no idioma configurado — <b>título de episódio fica em português</b>, ao contrário
    /// do pôster. São decisões separadas de propósito: nome de episódio é texto que se lê, e ler em
    /// português é o que se quer; pôster é arte, e a arte em inglês é a que circula.
    /// </summary>
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
                e.Runtime is > 0 ? e.Runtime * 60 : null, // TMDB dá minutos; o Reprise guarda segundos
                string.IsNullOrWhiteSpace(e.StillPath) ? null : e.StillPath)));
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
