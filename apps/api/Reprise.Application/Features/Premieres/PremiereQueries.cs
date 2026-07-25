using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Domain.Enums;

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
        DateOnly today, int withinDays = 180, CancellationToken ct = default)
    {
        var limit = today.AddDays(withinDays);

        // Quais temporadas têm o número mínimo — usado para marcar estreia de temporada sem
        // supor que o primeiro episódio é sempre o de número 1.
        var upcoming = await _db.Episodes
            .AsNoTracking()
            .Where(e => e.AirDate != null && e.AirDate > today && e.AirDate <= limit)
            .Where(e => _db.TrackedSeries.Any(t => t.SeriesId == e.SeriesId && t.Status == SeriesStatus.Following))
            .Select(e => new
            {
                e.Id,
                e.SeriesId,
                SeriesName = e.Series.Name,
                e.Series.PosterPath,
                e.SeasonNumber,
                e.EpisodeNumber,
                e.Name,
                e.StillPath,
                AirDate = e.AirDate!.Value
            })
            .ToListAsync(ct);

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
                IsSeasonPremiere: e.EpisodeNumber == 1
                    || e.EpisodeNumber == firstOfSeason[new { e.SeriesId, e.SeasonNumber }]))
            .ToList();
    }
}
