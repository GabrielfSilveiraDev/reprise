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
    bool IsSeasonPremiere);

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
/// A data vem do TMDB pelo enriquecimento, então o calendário só sabe o que o catálogo sabe: uma
/// série ainda não reprocessada não aparece aqui, e isso é uma limitação da fonte, não um bug.
/// </para>
/// </summary>
public sealed class PremiereQueries
{
    private readonly IRepriseDbContext _db;

    public PremiereQueries(IRepriseDbContext db) => _db = db;

    public async Task<IReadOnlyList<PremiereDto>> GetUpcomingAsync(
        DateTimeOffset now, int withinDays = 180, CancellationToken ct = default)
    {
        var hojeUtc = DateOnly.FromDateTime(now.UtcDateTime);
        var limit = hojeUtc.AddDays(withinDays);

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
        var candidatos = await _db.Episodes
            .AsNoTracking()
            .Where(e => e.AirDate != null && e.AirDate >= hojeUtc.AddDays(-2) && e.AirDate <= limit)
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
                    || e.EpisodeNumber == firstOfSeason[new { e.SeriesId, e.SeasonNumber }]))
            .ToList();
    }
}
