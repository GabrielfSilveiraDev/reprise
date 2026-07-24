namespace Reprise.Application.Enrichment;

/// <summary>Série que o TMDB não resolveu — some do relatório só depois de um <c>SeriesMatchOverride</c>.</summary>
public sealed record UnmatchedSeries(long SeriesId, int? TvdbId, string ProvisionalName, string Reason);

/// <summary>
/// Série cujo catálogo foi alinhado pela <b>ordem de exibição</b> em vez do par (temporada, episódio),
/// porque TVDB e TMDB numeram as temporadas de formas incompatíveis (típico de anime longo).
/// Os episódios existentes foram reposicionados para as coordenadas do TMDB preservando sua identidade
/// — e portanto todo o histórico de exibições pendurado neles.
/// </summary>
public sealed record OrderAlignedSeries(
    long SeriesId, int? TvdbId, string Name, int LocalEpisodes, int EpisodesRenumbered, int EpisodesUnplaced);

/// <summary>
/// Resultado de uma execução do enriquecimento. Mesma filosofia da reconciliação do importador:
/// uma série que não casa é um fato a reportar, não um motivo para abortar o lote inteiro.
/// </summary>
public sealed record EnrichmentReport(
    int SeriesConsidered,
    int SeriesMatched,
    int SeasonsCreated,
    int EpisodesCreated,
    int EpisodesUpdated,
    int EpisodesRenumbered,
    int RuntimesFilled,
    int EpisodesNotFoundInTmdb,
    IReadOnlyList<UnmatchedSeries> Unmatched,
    IReadOnlyList<OrderAlignedSeries> OrderAligned)
{
    public int SeriesUnmatched => Unmatched.Count;

    /// <summary>Precisa de olho humano: séries que não casaram de jeito nenhum.</summary>
    public bool NeedsAttention => Unmatched.Count > 0;
}
