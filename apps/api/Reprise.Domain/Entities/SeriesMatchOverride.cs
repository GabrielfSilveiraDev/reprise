namespace Reprise.Domain.Entities;

/// <summary>
/// Resolução manual de casamento: força um <c>tvdb_id</c> a apontar para um <c>tmdb_id</c>
/// quando o TMDB não resolve automaticamente. Consultado pelo enriquecimento antes de dar a série como não-casada.
/// </summary>
public class SeriesMatchOverride
{
    public int TvdbId { get; set; }
    public int TmdbId { get; set; }
    public string? Note { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
