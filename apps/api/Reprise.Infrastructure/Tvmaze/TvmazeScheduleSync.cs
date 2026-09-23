using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Domain.Entities;
using Reprise.Infrastructure.Persistence;

namespace Reprise.Infrastructure.Tvmaze;

/// <summary>Uma série que o TVmaze não resolveu, e por quê — para o relatório.</summary>
public sealed record TvmazeMiss(string SeriesName, string Reason);

/// <summary>O que uma sincronização fez, para a CLI imprimir.</summary>
public sealed record TvmazeSyncReport(
    int SeriesConsidered,
    int SeriesMatched,
    int EpisodesDated,
    int EpisodesWithExactTime,
    int DatesDifferentFromTmdb,
    IReadOnlyList<TvmazeMiss> Misses,
    IReadOnlyList<string> Divergences);

/// <summary>
/// Traz do TVmaze a agenda das séries do catálogo: data por episódio e, em TV linear, o horário.
///
/// <para>
/// <b>Não toca no catálogo.</b> Nome, sinopse, pôster, temporadas e a própria <c>air_date</c> do
/// TMDB continuam como estão — esta classe só escreve <c>tvmaze_air_date</c> e
/// <c>tvmaze_air_stamp</c>. Guardar ao lado, e não por cima, é o que permite comparar as duas
/// fontes depois e é o que torna a sincronização segura de repetir: no pior caso ela reescreve os
/// mesmos dois campos com os mesmos valores.
/// </para>
///
/// <para>
/// <b>Episódio não casado fica intocado.</b> O TVmaze e o TMDB às vezes repartem uma série em
/// temporadas diferentes — é o mesmo problema que o enriquecimento já enfrenta com o TheTVDB. Aqui
/// a resposta é mais simples do que lá: episódio cujo <c>(temporada, número)</c> não existe do
/// outro lado simplesmente não recebe data do TVmaze e continua valendo pelo TMDB. Nada é apagado,
/// nada é reposicionado.
/// </para>
/// </summary>
public sealed class TvmazeScheduleSync
{
    private readonly RepriseDbContext _db;
    private readonly ITvmazeClient _tvmaze;

    public TvmazeScheduleSync(RepriseDbContext db, ITvmazeClient tvmaze)
    {
        _db = db;
        _tvmaze = tvmaze;
    }

    /// <param name="force">Reconsulta também as séries que já têm <c>tvmaze_id</c>.</param>
    /// <param name="onlyChanged">
    /// Usa o feed de alterações do TVmaze e só reconsulta as séries que mudaram na janela dada
    /// (<c>day</c>, <c>week</c>, <c>month</c>). É o modo de manutenção: uma requisição descobre o
    /// que mexeu no mundo todo, e a interseção com o catálogo costuma ser de meia dúzia de séries.
    /// </param>
    public async Task<TvmazeSyncReport> SyncAsync(
        bool force = false,
        string? onlyChanged = null,
        IProgress<string>? progress = null,
        CancellationToken ct = default)
    {
        var series = await _db.Series.OrderBy(s => s.Name).ToListAsync(ct);

        if (onlyChanged is { Length: > 0 } janela)
        {
            var alterados = await _tvmaze.GetUpdatedSinceAsync(janela, ct);
            series = series.Where(s => s.TvmazeId is { } id && alterados.ContainsKey(id)).ToList();
        }
        else if (!force)
        {
            // Sem --force, só quem ainda não foi casado. Séries já sincronizadas não mudam de id.
            series = series.Where(s => s.TvmazeId is null).ToList();
        }

        var considered = series.Count;
        var matched = 0;
        var datados = 0;
        var comHora = 0;
        var divergentes = 0;
        var misses = new List<TvmazeMiss>();
        var divergencias = new List<string>();

        foreach (var s in series)
        {
            ct.ThrowIfCancellationRequested();
            progress?.Report(s.Name);

            var r = await SincronizarAsync(s, ct);
            if (r.Show is not null) matched++;

            if (r.Falha is { } motivo)
            {
                misses.Add(new TvmazeMiss(s.Name, motivo));
                continue;
            }

            datados += r.Datados;
            comHora += r.ComHora;
            divergentes += r.Divergentes;
            if (r.Divergentes > 0)
                divergencias.Add($"{s.Name} ({r.Show!.Network ?? "?"}): {r.Divergentes} episódio(s) com data diferente do TMDB");
        }

        return new TvmazeSyncReport(considered, matched, datados, comHora, divergentes, misses, divergencias);
    }

    /// <summary>
    /// Sincroniza uma série só — o caminho da atualização automática do catálogo, que acabou de
    /// trazer episódios novos do TMDB e precisa da agenda deles agora, e não na próxima varredura.
    /// </summary>
    /// <returns>Por que a série não foi sincronizada, ou nulo quando foi.</returns>
    public async Task<string?> SyncSeriesAsync(Series s, CancellationToken ct = default) =>
        (await SincronizarAsync(s, ct)).Falha;

    /// <summary>O que aconteceu com uma série. <see cref="Show"/> preenchido e <see cref="Falha"/> também: casou, mas os episódios não vieram.</summary>
    private sealed record Resultado(TvmazeShow? Show, int Datados, int ComHora, int Divergentes, string? Falha);

    private async Task<Resultado> SincronizarAsync(Series s, CancellationToken ct)
    {
        TvmazeShow? show;
        try
        {
            show = await ResolveAsync(s, ct);
        }
        catch (Exception ex)
        {
            // Uma série que falha não pode interromper as outras: a sincronização é longa e
            // reexecutá-la do zero por causa de um erro de rede custaria todas as consultas já
            // feitas.
            return new Resultado(null, 0, 0, 0, $"erro ao consultar: {ex.GetType().Name}");
        }

        if (show is null) return new Resultado(null, 0, 0, 0, "não encontrada no TVmaze");

        s.TvmazeId = show.Id;

        IReadOnlyList<TvmazeEpisode> remotos;
        try
        {
            remotos = await _tvmaze.GetEpisodesAsync(show.Id, ct);
        }
        catch (Exception ex)
        {
            // O casamento vale mesmo sem os episódios: grava o id para a próxima vez não ter de
            // procurar de novo.
            await _db.SaveChangesAsync(ct);
            return new Resultado(show, 0, 0, 0, $"erro ao buscar episódios: {ex.GetType().Name}");
        }

        var porPosicao = remotos
            .Where(e => e.AirDate is not null)
            .GroupBy(e => (e.SeasonNumber, e.EpisodeNumber))
            .ToDictionary(g => g.Key, g => g.First());

        var locais = await _db.Episodes.Where(e => e.SeriesId == s.Id).ToListAsync(ct);

        int datados = 0, comHora = 0, divergentes = 0;
        foreach (var local in locais)
        {
            if (!porPosicao.TryGetValue((local.SeasonNumber, local.EpisodeNumber), out var remoto)) continue;

            local.TvmazeAirDate = remoto.AirDate;
            local.TvmazeAirStamp = remoto.AirStamp;

            datados++;
            if (remoto.HasDeclaredTime) comHora++;
            if (local.AirDate is { } tmdb && remoto.AirDate is { } tv && tmdb != tv) divergentes++;
        }

        // Grava por série, e não tudo no fim: numa sincronização de mais de cem séries, uma
        // falha no meio não deve devolver o trabalho todo para o começo.
        await _db.SaveChangesAsync(ct);
        return new Resultado(show, datados, comHora, divergentes, null);
    }

    /// <summary>
    /// Casa a série: por id do TheTVDB quando existe, por nome quando não.
    ///
    /// <para>
    /// A busca por nome só é aceita quando o <b>ano de estreia bate</b> (com um ano de folga, que
    /// as fontes discordam em série que estreou perto da virada). Sem essa trava, <i>Monster</i>
    /// e <i>Dark Matter</i> — nomes que várias séries diferentes carregam — casariam com a série
    /// errada e o app passaria a mostrar a agenda de outra coisa, que é pior do que não mostrar
    /// agenda nenhuma.
    /// </para>
    /// </summary>
    private async Task<TvmazeShow?> ResolveAsync(Series s, CancellationToken ct)
    {
        if (s.TvdbId is { } tvdb)
        {
            var porId = await _tvmaze.FindByTvdbIdAsync(tvdb, ct);
            if (porId is not null) return porId;
        }

        var porNome = await _tvmaze.SearchByNameAsync(s.Name, ct);
        if (porNome is null) return null;

        if (s.FirstAirDate is not { } estreia || porNome.PremieredYear is not { } ano) return null;

        return Math.Abs(ano - estreia.Year) <= 1 ? porNome : null;
    }
}
