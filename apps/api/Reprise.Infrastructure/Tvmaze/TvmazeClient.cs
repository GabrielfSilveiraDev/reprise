using System.Net;
using System.Text.Json;
using Reprise.Application.Abstractions;

namespace Reprise.Infrastructure.Tvmaze;

/// <summary>
/// Cliente do TVmaze sobre <see cref="HttpClient"/> e <c>System.Text.Json</c>, sem SDK.
///
/// <para>
/// São quatro rotas e um punhado de campos: um pacote de terceiro traria um grafo de objetos
/// inteiro para ler <c>airdate</c>, <c>airtime</c> e <c>airstamp</c>, e mais uma dependência para
/// acompanhar. O TMDB tem SDK porque lá se usa meia API; aqui não se justifica.
/// </para>
///
/// <para>
/// <b>404 é resposta, não falha.</b> O <c>lookup</c> devolve 404 — e às vezes o literal
/// <c>null</c> com 200 — para série que ele não conhece, e isso é informação normal: parte do
/// acervo não está lá. Só erro de rede e status inesperado sobem como exceção.
/// </para>
/// </summary>
public sealed class TvmazeClient : ITvmazeClient
{
    private readonly HttpClient _http;

    public TvmazeClient(HttpClient http) => _http = http;

    public Task<TvmazeShow?> FindByTvdbIdAsync(int tvdbId, CancellationToken cancellationToken = default) =>
        ShowAsync($"lookup/shows?thetvdb={tvdbId}", cancellationToken);

    public Task<TvmazeShow?> SearchByNameAsync(string name, CancellationToken cancellationToken = default) =>
        ShowAsync($"singlesearch/shows?q={Uri.EscapeDataString(name)}", cancellationToken);

    private async Task<TvmazeShow?> ShowAsync(string caminho, CancellationToken ct)
    {
        var raiz = await GetJsonAsync(caminho, ct);
        if (raiz is not { ValueKind: JsonValueKind.Object } show) return null;

        var id = show.TryGetProperty("id", out var idProp) ? idProp.GetInt32() : 0;
        if (id == 0) return null;

        var nome = show.TryGetProperty("name", out var n) ? n.GetString() ?? string.Empty : string.Empty;

        int? ano = null;
        if (show.TryGetProperty("premiered", out var p) && p.GetString() is { Length: >= 4 } estreia
            && int.TryParse(estreia.AsSpan(0, 4), out var parsed))
            ano = parsed;

        // Streaming vem em `webChannel`, TV linear em `network`. Só o nome interessa aqui.
        var canal = Texto(show, "webChannel", "name") ?? Texto(show, "network", "name");

        return new TvmazeShow(id, nome, ano, canal);
    }

    public async Task<IReadOnlyList<TvmazeEpisode>> GetEpisodesAsync(
        int tvmazeId, CancellationToken cancellationToken = default)
    {
        var raiz = await GetJsonAsync($"shows/{tvmazeId}/episodes", cancellationToken);
        if (raiz is not { ValueKind: JsonValueKind.Array } lista) return [];

        var episodios = new List<TvmazeEpisode>();
        foreach (var e in lista.EnumerateArray())
        {
            if (!e.TryGetProperty("season", out var t) || t.ValueKind != JsonValueKind.Number) continue;
            if (!e.TryGetProperty("number", out var n) || n.ValueKind != JsonValueKind.Number) continue;

            DateOnly? data = e.TryGetProperty("airdate", out var d) && DateOnly.TryParse(d.GetString(), out var dd)
                ? dd
                : null;

            /*
             * O horário é o que separa dado de enchimento.
             *
             * Em TV linear o TVmaze traz `airtime` ("20:00") e o `airstamp` correspondente é o
             * instante real. Em streaming o `airtime` vem vazio e o `airstamp` é meio-dia UTC fixo
             * — um valor que existe para o campo não ser nulo, não para dizer a hora. Gravá-lo
             * como horário faria o app anunciar estreia às 9h da manhã, que é exatamente a
             * precisão falsa que esta integração existe para evitar.
             */
            var temHora = e.TryGetProperty("airtime", out var h) && !string.IsNullOrWhiteSpace(h.GetString());

            DateTimeOffset? instante = null;
            if (temHora && e.TryGetProperty("airstamp", out var s)
                && DateTimeOffset.TryParse(s.GetString(), out var quando))
                instante = quando;

            episodios.Add(new TvmazeEpisode(t.GetInt32(), n.GetInt32(), data, instante, temHora));
        }

        return episodios;
    }

    public async Task<IReadOnlyDictionary<int, DateTimeOffset>> GetUpdatedSinceAsync(
        string since = "week", CancellationToken cancellationToken = default)
    {
        var raiz = await GetJsonAsync($"updates/shows?since={Uri.EscapeDataString(since)}", cancellationToken);
        if (raiz is not { ValueKind: JsonValueKind.Object } mapa) return new Dictionary<int, DateTimeOffset>();

        var resultado = new Dictionary<int, DateTimeOffset>();
        foreach (var item in mapa.EnumerateObject())
        {
            if (int.TryParse(item.Name, out var id) && item.Value.ValueKind == JsonValueKind.Number)
                resultado[id] = DateTimeOffset.FromUnixTimeSeconds(item.Value.GetInt64());
        }

        return resultado;
    }

    private static string? Texto(JsonElement pai, params string[] caminho)
    {
        var atual = pai;
        foreach (var parte in caminho)
        {
            if (atual.ValueKind != JsonValueKind.Object || !atual.TryGetProperty(parte, out var prox)) return null;
            atual = prox;
        }
        return atual.ValueKind == JsonValueKind.String ? atual.GetString() : null;
    }

    private async Task<JsonElement?> GetJsonAsync(string caminho, CancellationToken ct)
    {
        using var resposta = await _http.GetAsync(caminho, ct);

        // Série que o TVmaze não conhece. Normal: nem todo o acervo está lá.
        if (resposta.StatusCode == HttpStatusCode.NotFound) return null;
        resposta.EnsureSuccessStatusCode();

        await using var fluxo = await resposta.Content.ReadAsStreamAsync(ct);
        using var documento = await JsonDocument.ParseAsync(fluxo, cancellationToken: ct);

        // O `lookup` responde 200 com o literal `null` em vez de 404 em alguns casos.
        return documento.RootElement.ValueKind == JsonValueKind.Null
            ? null
            : documento.RootElement.Clone();
    }
}
