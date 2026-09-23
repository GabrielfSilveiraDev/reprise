using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Domain.Enums;
using Reprise.Domain.Scheduling;

namespace Reprise.Application.Features.Premieres;

/// <summary>Um episódio que ainda vai ao ar numa série que você acompanha.</summary>
public sealed record PremiereDto(
    long EpisodeId,
    long SeriesId,
    string SeriesName,
    string? PosterPath,
    int SeasonNumber,
    int EpisodeNumber,
    string? EpisodeName,
    string? StillPath,
    DateOnly AirDate,
    /// <summary>
    /// Instante em que o episódio passa a contar como lançado — ver <c>ReleaseSchedule</c>.
    /// É o que o cliente compara com o relógio dele para dizer "estreia amanhã".
    /// </summary>
    DateTimeOffset? ReleasesAt,
    /// <summary>Estreia de temporada — o episódio 1 de uma temporada é a notícia, não o 7.</summary>
    bool IsSeasonPremiere,
    /// <summary>
    /// Sinopse do episódio, quando o TMDB já a publicou. Para estreia distante quase nunca existe:
    /// ela costuma aparecer na semana em que o episódio sai.
    /// </summary>
    string? Overview,
    /// <summary>
    /// Sua exibição mais recente nesta série — a mesma medida do <c>NextUpItemDto</c>. É o que
    /// permite ao cliente distinguir a série que você está assistindo da que só acompanha: a
    /// estreia da primeira interessa a qualquer distância, a da segunda só quando está perto.
    /// </summary>
    DateTimeOffset? LastActivityAt);

/// <summary>
/// O que ainda vai estrear.
///
/// <para>
/// Só de séries com estado <see cref="SeriesStatus.Following"/>: uma série arquivada ou concluída
/// não deve voltar a aparecer porque ganhou temporada nova — a decisão de parar foi sua, e o
/// calendário não é lugar de discuti-la. Quem quiser de volta muda o estado.
/// </para>
///
/// <para>
/// A data vem do TMDB pelo enriquecimento, então o calendário só sabe o que o catálogo sabe. É
/// por isso que o catálogo das séries em produção se atualiza sozinho (<c>CatalogRefresh</c>):
/// antes dele, a volta de Silo em 2027 simplesmente não existia aqui.
/// </para>
///
/// <para>
/// <b>Todos os episódios, e não só o próximo de cada série.</b> Quem recorta é o cliente — no web,
/// a <c>PremiereAgenda</c> escolhe o que a tela inicial e a agenda mostram —, e um aviso de estreia
/// precisa de cada episódio: agendar só o próximo deixaria o seguinte sem aviso.
/// </para>
/// </summary>
public sealed class PremiereQueries
{
    private readonly IRepriseDbContext _db;

    public PremiereQueries(IRepriseDbContext db) => _db = db;

    /// <param name="withinDays">
    /// Horizonte opcional. <b>Sem ele não há limite</b>: o próximo episódio de uma série que você
    /// está assistindo interessa mesmo que só saia no ano que vem, e o conjunto é pequeno por
    /// natureza — episódios futuros de séries acompanhadas, dezenas e não milhares.
    /// </param>
    public async Task<IReadOnlyList<PremiereDto>> GetUpcomingAsync(
        DateTimeOffset now, int? withinDays = null, CancellationToken ct = default)
    {
        var hojeUtc = DateOnly.FromDateTime(now.UtcDateTime);
        var desde = hojeUtc.AddDays(-2);

        /*
         * O SQL traz um dia a MAIS do que o necessário, e o filtro fino acontece na memória.
         *
         * Quem decide se um episódio já saiu é o ReleaseSchedule, que depende do país de origem da
         * série — e "o dia da air_date terminou no fuso de origem" não é uma data fixa: para o
         * Japão isso acontece antes de virar o dia em UTC, para o Pacífico americano, oito horas
         * depois. Traduzir essa conta para SQL exigiria a tabela de fusos dentro da consulta.
         *
         * A folga é de DOIS dias: além das ±12h de fuso, a data do TVmaze pode ser um dia depois
         * da do TMDB (é o caso de toda a Apple TV), e é ela que decide. Pegar a partir de anteontem
         * em UTC é garantidamente um superconjunto do que interessa. O conjunto é pequeno — episódios
         * futuros de séries acompanhadas —, então filtrar depois custa nada e mantém a regra num
         * lugar só.
         */
        var episodios = _db.Episodes
            .AsNoTracking()
            .Where(e => e.AirDate != null && e.AirDate >= desde);

        if (withinDays is int dias)
        {
            var limite = hojeUtc.AddDays(dias);
            episodios = episodios.Where(e => e.AirDate <= limite);
        }

        var candidatos = await episodios
            .Where(e => _db.TrackedSeries.Any(t => t.SeriesId == e.SeriesId && t.Status == SeriesStatus.Following))
            .Select(e => new
            {
                e.Id,
                e.SeriesId,
                SeriesName = e.Series.Name,
                e.Series.PosterPath,
                e.Series.OriginCountry,
                e.TvmazeAirDate,
                e.TvmazeAirStamp,
                e.SeasonNumber,
                e.EpisodeNumber,
                e.Name,
                e.StillPath,
                e.Overview,
                AirDate = e.AirDate!.Value
            })
            .ToListAsync(ct);

        // "Ainda vai estrear" é o complemento exato de "já lançou". Antes isto era `AirDate >
        // today`, o que jogava fora o episódio de HOJE: ele não aparecia como próximo nem como
        // passado, simplesmente sumia da tela — o defeito que originou esta mudança.
        var upcoming = candidatos
            .Where(e => !ReleaseSchedule.HasReleased(
                new EpisodeRelease(e.AirDate, e.TvmazeAirDate, e.TvmazeAirStamp, e.OriginCountry), now))
            .ToList();

        var firstOfSeason = upcoming
            .GroupBy(e => new { e.SeriesId, e.SeasonNumber })
            .ToDictionary(g => g.Key, g => g.Min(e => e.EpisodeNumber));

        var ultima = await UltimaExibicaoAsync(upcoming.Select(e => e.SeriesId).Distinct().ToList(), ct);

        return upcoming
            .OrderBy(e => e.AirDate)
            .ThenBy(e => e.SeriesName)
            .ThenBy(e => e.EpisodeNumber)
            .Select(e => new PremiereDto(
                e.Id, e.SeriesId, e.SeriesName, e.PosterPath,
                e.SeasonNumber, e.EpisodeNumber, e.Name, e.StillPath, e.AirDate,
                ReleaseSchedule.ReleasesAt(
                    new EpisodeRelease(e.AirDate, e.TvmazeAirDate, e.TvmazeAirStamp, e.OriginCountry)),
                IsSeasonPremiere: e.EpisodeNumber == 1
                    || e.EpisodeNumber == firstOfSeason[new { e.SeriesId, e.SeasonNumber }],
                e.Overview,
                ultima.TryGetValue(e.SeriesId, out var last) ? last : null))
            .ToList();
    }

    /// <summary>
    /// Sua exibição mais recente em cada série da lista.
    ///
    /// <para>
    /// Mesmo critério do <c>NextUpItemDto.LastActivityAt</c>, contando as marcações em massa: é o
    /// par dele que decide, no cliente, o que é "estou assistindo" — e uma série não pode estar em
    /// andamento numa prateleira e em pausa na outra. O filtro global de tenant faz disto a SUA
    /// última exibição, nunca a de quem mais acompanhe a série.
    /// </para>
    /// </summary>
    private async Task<Dictionary<long, DateTimeOffset>> UltimaExibicaoAsync(
        IReadOnlyCollection<long> series, CancellationToken ct)
    {
        if (series.Count == 0) return [];

        var linhas = await _db.WatchEvents
            .Where(w => series.Contains(w.Episode.SeriesId))
            .GroupBy(w => w.Episode.SeriesId)
            .Select(g => new { SeriesId = g.Key, Last = g.Max(w => w.WatchedAt) })
            .ToListAsync(ct);

        return linhas.ToDictionary(x => x.SeriesId, x => x.Last);
    }
}
