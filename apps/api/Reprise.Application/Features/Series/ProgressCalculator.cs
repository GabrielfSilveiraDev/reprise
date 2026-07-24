namespace Reprise.Application.Features.Series;

/// <summary>Episódio regular (temporada &gt; 0) reduzido ao necessário para calcular progresso.</summary>
public readonly record struct EpisodeProgressInput(long EpisodeId, int SeasonNumber, int EpisodeNumber);

public sealed record SeriesProgress(
    int EpisodesTotal,
    int EpisodesWatched,
    double CompletionRatio,
    EpisodeProgressInput? NextUp);

/// <summary>
/// Cálculo puro de progresso de uma série a partir do log de eventos: total de episódios regulares,
/// quantos foram vistos ao menos uma vez, e qual o "próximo a assistir" (primeiro não visto em ordem).
/// Especiais (temporada 0) NÃO entram aqui — são contabilizados à parte. É a peça testável do lado de leitura.
/// </summary>
public static class ProgressCalculator
{
    public static SeriesProgress Compute(IEnumerable<EpisodeProgressInput> regularEpisodes, IReadOnlySet<long> watchedEpisodeIds)
    {
        var ordered = regularEpisodes
            .OrderBy(e => e.SeasonNumber)
            .ThenBy(e => e.EpisodeNumber)
            .ToList();

        var total = ordered.Count;
        var watched = ordered.Count(e => watchedEpisodeIds.Contains(e.EpisodeId));

        EpisodeProgressInput? next = null;
        foreach (var e in ordered)
        {
            if (!watchedEpisodeIds.Contains(e.EpisodeId)) { next = e; break; }
        }

        var ratio = total == 0 ? 0d : (double)watched / total;
        return new SeriesProgress(total, watched, ratio, next);
    }
}
