namespace Reprise.Domain.Entities;

/// <summary>Temporada de uma série. <c>SeasonNumber = 0</c> agrupa os especiais.</summary>
public class Season
{
    public long Id { get; set; }
    public long SeriesId { get; set; }
    public Series Series { get; set; } = null!;

    public int? TmdbId { get; set; }
    public int SeasonNumber { get; set; }
    public string? Name { get; set; }
    public int? EpisodeCount { get; set; }

    public ICollection<Episode> Episodes { get; set; } = new List<Episode>();
}
