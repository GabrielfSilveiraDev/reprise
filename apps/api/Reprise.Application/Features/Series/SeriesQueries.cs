using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Application.Features.Watching;
using Reprise.Domain.Entities;
using Reprise.Domain.Scheduling;
using Reprise.Domain.Enums;

namespace Reprise.Application.Features.Series;

/// <summary>
/// Consultas de leitura do lado das séries. Progresso e "próximo a assistir" são DERIVADOS do log
/// de eventos (nada de flag mantida em sincronia).
///
/// <b>A agregação acontece no banco, não na memória do processo.</b> A primeira versão trazia
/// todos os episódios de todas as séries acompanhadas (9.263 linhas), mais os ids de tudo que já
/// foi visto (6.437), e cruzava os dois em C# — a cada abertura da tela inicial. Funciona com 115
/// séries e degrada linearmente com o acervo, que é exatamente o tipo de custo que não aparece em
/// desenvolvimento e aparece depois. Agora são três projeções que o Postgres resolve e devolve
/// uma linha por série acompanhada.
/// </summary>
public sealed class SeriesQueries
{
    private readonly IRepriseDbContext _db;

    public SeriesQueries(IRepriseDbContext db) => _db = db;

    /// <summary>
    /// Uma linha por série acompanhada, com progresso e próximo episódio calculados no servidor.
    ///
    /// <b>Sobre multi-tenancy:</b> isto é EF, não SQL cru, então o filtro global vale — e vale
    /// também dentro das subconsultas de navegação. <c>e.WatchEvents.Any()</c> significa "existe
    /// exibição DESTE usuário", nunca de qualquer um. É a diferença entre uma série aparecer
    /// assistida porque você a viu e aparecer assistida porque outra pessoa viu.
    /// </summary>
    public async Task<IReadOnlyList<SeriesListItemDto>> GetListAsync(CancellationToken ct = default)
    {
        var cabecalho = await _db.TrackedSeries
            .Select(t => new
            {
                t.SeriesId,
                t.Series.TvdbId,
                t.Series.Name,
                t.Series.PosterPath,
                Relacao = t.Status,
                Producao = t.Series.Status,
            })
            .ToListAsync(ct);

        if (cabecalho.Count == 0) return Array.Empty<SeriesListItemDto>();

        var progresso = await ProgressoPorSerieAsync(ct);
        var ultima = await UltimaExibicaoPorSerieAsync(ct);
        var proximo = await ProximoPorSerieAsync(ct);

        return cabecalho
            .Select(c =>
            {
                progresso.TryGetValue(c.SeriesId, out var p);
                ultima.TryGetValue(c.SeriesId, out var last);
                proximo.TryGetValue(c.SeriesId, out var next);

                return new SeriesListItemDto(
                    c.SeriesId, c.TvdbId, c.Name, c.PosterPath, c.Relacao.ToString(), c.Producao,
                    p.Total, p.Exibidos, p.Vistos,
                    p.Total == 0 ? 0d : (double)p.Vistos / p.Total,
                    last, next);
            })
            // A ordenação final é sobre ~100 itens já em memória, então não vale um ORDER BY que
            // obrigaria as quatro consultas a virar uma só.
            //
            // `?? MinValue` e não `OrderByDescending` puro: séries sem nenhuma exibição vão para o
            // FIM. Em SQL isso precisaria de NULLS LAST explícito, porque o Postgres assume NULLS
            // FIRST em ordem descendente — e a lista abriria pelo que você nunca assistiu.
            .OrderByDescending(r => r.LastWatchedAt ?? DateTimeOffset.MinValue)
            .ThenBy(r => r.Name)
            .ToList();
    }

    public async Task<SeriesDetailDto?> GetDetailAsync(long seriesId, CancellationToken ct = default)
    {
        var series = await _db.Series.FirstOrDefaultAsync(s => s.Id == seriesId, ct);
        if (series is null) return null;

        var tracked = await _db.TrackedSeries.FirstOrDefaultAsync(t => t.SeriesId == seriesId, ct);
        var status = tracked?.Status.ToString() ?? "Untracked";

        var epRows = await _db.Episodes
            .Where(e => e.SeriesId == seriesId)
            .Select(e => new
            {
                e.Id, e.SeasonNumber, e.EpisodeNumber, e.Name, e.RuntimeSeconds, e.IsSpecial,
                e.StillPath, e.Overview, e.AirDate, e.TvmazeAirDate, e.TvmazeAirStamp,
                WatchCount = e.WatchEvents.Count(),
                Last = e.WatchEvents.Max(w => (DateTimeOffset?)w.WatchedAt)
            })
            .ToListAsync(ct);

        var seasons = epRows
            .GroupBy(e => e.SeasonNumber)
            // Especiais por último. A temporada 0 é uma convenção de numeração, não uma ordem de
            // exibição: ninguém assiste os especiais antes do piloto. Ordenar aqui, e não em cada
            // cliente, faz web e app concordarem sem combinar.
            .OrderBy(g => g.Key == 0 ? int.MaxValue : g.Key)
            .Select(g => new SeasonDto(
                g.Key, Name: null, IsSpecials: g.Key == 0,
                g.OrderBy(e => e.EpisodeNumber)
                    .Select(e => new EpisodeDto(
                        e.Id, e.SeasonNumber, e.EpisodeNumber, e.Name, e.RuntimeSeconds, e.IsSpecial,
                        e.WatchCount, e.Last, e.StillPath, e.Overview, e.AirDate,
                        ReleaseSchedule.ReleasesAt(new EpisodeRelease(
                            e.AirDate, e.TvmazeAirDate, e.TvmazeAirStamp, series.OriginCountry))))
                    .ToList()))
            .ToList();

        var hoje = Episode.Today();
        var regular = epRows.Where(e => e.SeasonNumber > 0).ToList();
        var total = regular.Count;
        var aired = regular.Count(e => Episode.HasAired(e.AirDate, hoje));
        var watched = regular.Count(e => e.WatchCount > 0);
        var ratio = total == 0 ? 0d : (double)watched / total;

        // As sessões precisam do runtime junto da data — daí buscar os eventos, e não só contar.
        var sessionEvents = await _db.WatchEvents
            .Where(w => w.Episode.SeriesId == seriesId)
            .Select(w => new { w.WatchedAt, w.EpisodeId, w.Episode.RuntimeSeconds, w.IsBackfill })
            .ToListAsync(ct);

        var backfillCount = sessionEvents.Count(e => e.IsBackfill);

        var sessions = RewatchSessionCalculator
            .Compute(sessionEvents
                .Where(e => !e.IsBackfill)
                .Select(e => new SessionEvent(e.WatchedAt, e.EpisodeId, e.RuntimeSeconds)))
            .Select(s => new RewatchSessionDto(
                s.Ordinal, s.StartedAt, s.EndedAt, s.Exhibitions, s.DistinctEpisodes, s.TotalSeconds, s.SpanDays))
            .ToList();

        return new SeriesDetailDto(
            series.Id, series.TvdbId, series.Name, series.OriginalName, series.Overview, series.PosterPath,
            status, series.Status, series.FirstAirDate, total, aired, watched, ratio, seasons,
            sessions, backfillCount);
    }

    /// <summary>
    /// Total de episódios regulares, quantos já foram ao ar e quantos foram vistos, por série — um
    /// <c>GROUP BY</c> só.
    ///
    /// Especiais (temporada 0) ficam fora: ninguém considera uma série incompleta por não ter
    /// visto os extras.
    /// </summary>
    private async Task<Dictionary<long, (int Total, int Exibidos, int Vistos)>> ProgressoPorSerieAsync(CancellationToken ct)
    {
        var hoje = Episode.Today();

        var linhas = await _db.Episodes
            .Where(e => e.SeasonNumber > 0)
            .GroupBy(e => e.SeriesId)
            .Select(g => new
            {
                SeriesId = g.Key,
                Total = g.Count(),
                // A mesma regra de `Episode.Aired`, escrita inline porque um `Count` com predicado
                // não aceita a expressão pronta. Se uma mudar, a outra tem de mudar junto.
                Exibidos = g.Count(e => e.AirDate == null || e.AirDate.Value <= hoje),
                // `e.WatchEvents.Any()` respeita o filtro global: é "existe exibição DESTE
                // usuário", nunca de qualquer um.
                Vistos = g.Count(e => e.WatchEvents.Any()),
            })
            .ToListAsync(ct);

        return linhas.ToDictionary(x => x.SeriesId, x => (x.Total, x.Exibidos, x.Vistos));
    }

    /// <summary>Data da exibição mais recente de cada série, para ordenar a lista por atividade.</summary>
    private async Task<Dictionary<long, DateTimeOffset?>> UltimaExibicaoPorSerieAsync(CancellationToken ct)
    {
        var linhas = await _db.WatchEvents
            .GroupBy(w => w.Episode.SeriesId)
            .Select(g => new { SeriesId = g.Key, Last = g.Max(w => (DateTimeOffset?)w.WatchedAt) })
            .ToListAsync(ct);

        return linhas.ToDictionary(x => x.SeriesId, x => x.Last);
    }

    /// <summary>
    /// O primeiro episódio não visto de cada série, numa varredura só.
    ///
    /// <b>Esta é a consulta que decidiu o desenho todo.</b> A forma óbvia — uma subconsulta
    /// "primeiro não visto" dentro da projeção de cada série — o EF traduz para uma subconsulta
    /// correlacionada POR SÉRIE, e medi: fica mais lenta que o código ingênuo que ela veio
    /// substituir. Agrupar por série e pedir o primeiro de cada grupo vira um <c>DISTINCT ON</c>
    /// no Postgres: uma passada, e o custo deixa de crescer com o número de séries.
    ///
    /// A regra é a mesma de sempre: o primeiro não visto na ordem de exibição — inclusive no caso
    /// do buraco no meio, em que o próximo é o episódio pulado, e não o seguinte ao último visto.
    /// </summary>
    private async Task<Dictionary<long, EpisodeRefDto>> ProximoPorSerieAsync(CancellationToken ct)
    {
        var linhas = await _db.Episodes
            .Where(e => e.SeasonNumber > 0 && !e.WatchEvents.Any())
            // Só o que dá para assistir hoje. "Próximo a assistir" apontando para um episódio que
            // estreia em novembro é uma pendência que ninguém pode resolver — e era assim que a
            // tela inicial oferecia o botão de marcar num episódio inexistente.
            .Where(Episode.Aired(Episode.Today()))
            .GroupBy(e => e.SeriesId)
            .Select(g => g
                .OrderBy(e => e.SeasonNumber)
                .ThenBy(e => e.EpisodeNumber)
                .Select(e => new { e.SeriesId, e.Id, e.SeasonNumber, e.EpisodeNumber, e.Name })
                .First())
            .ToListAsync(ct);

        return linhas.ToDictionary(
            x => x.SeriesId,
            x => new EpisodeRefDto(x.Id, x.SeasonNumber, x.EpisodeNumber, x.Name));
    }

    /// <summary>
    /// Próximo episódio não visto de cada série ACOMPANHADA, ordenado por atividade recente.
    ///
    /// <b>Consulta própria, e não um filtro sobre a lista completa.</b> Antes chamava
    /// <see cref="GetListAsync"/> e descartava o que não servia: das 116 séries montadas, 49
    /// sobreviviam ao filtro — o resto era progresso calculado à toa para arquivadas e concluídas.
    /// Aqui o recorte por status vai para o WHERE, então o banco nem toca nas outras.
    /// </summary>
    public async Task<IReadOnlyList<NextUpItemDto>> GetNextUpAsync(CancellationToken ct = default)
    {
        var acompanhadas = await _db.TrackedSeries
            .Where(t => t.Status == SeriesStatus.Following)
            .Select(t => new { t.SeriesId, t.Series.Name, t.Series.PosterPath })
            .ToListAsync(ct);

        if (acompanhadas.Count == 0) return Array.Empty<NextUpItemDto>();

        var proximo = await ProximoPorSerieAsync(ct);
        var ultima = await UltimaExibicaoPorSerieAsync(ct);

        return acompanhadas
            // Sem "próximo", a série está em dia e não entra na fila.
            .Where(a => proximo.ContainsKey(a.SeriesId))
            .Select(a =>
            {
                ultima.TryGetValue(a.SeriesId, out var last);
                return new NextUpItemDto(a.SeriesId, a.Name, a.PosterPath, proximo[a.SeriesId], last);
            })
            .OrderByDescending(r => r.LastActivityAt ?? DateTimeOffset.MinValue)
            .ThenBy(r => r.SeriesName)
            .ToList();
    }
}
