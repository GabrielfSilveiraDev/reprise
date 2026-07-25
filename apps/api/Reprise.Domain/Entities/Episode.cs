namespace Reprise.Domain.Entities;

/// <summary>
/// Episódio no catálogo. <see cref="IsSpecial"/> é derivado de <c>SeasonNumber == 0</c>
/// (a coluna <c>is_special</c> do export é inconfiável — só 9 de 10.515 linhas a preenchem).
/// </summary>
public class Episode
{
    public long Id { get; set; }

    public long SeriesId { get; set; }
    public Series Series { get; set; } = null!;

    public long SeasonId { get; set; }
    public Season Season { get; set; } = null!;

    public int? TmdbId { get; set; }
    public int SeasonNumber { get; set; }
    public int EpisodeNumber { get; set; }
    public string? Name { get; set; }
    public DateOnly? AirDate { get; set; }

    /// <summary>
    /// Caminho da imagem de cena do episódio no TMDB (o "still"), no formato <c>/abc123.jpg</c>.
    /// Nulo é comum e esperado: episódio antigo, especial ou de série pequena costuma não ter.
    /// </summary>
    public string? StillPath { get; set; }

    /// <summary>Runtime em segundos (o export vem em segundos: 2700 = 45 min).</summary>
    public int? RuntimeSeconds { get; set; }

    /// <summary>True quando o runtime foi estimado pelo TMDB por o export vir vazio.</summary>
    public bool RuntimeEstimated { get; set; }

    /// <summary>Especial (temporada 0) — contabilizado à parte do progresso das temporadas regulares.</summary>
    public bool IsSpecial { get; set; }

    public ICollection<WatchEvent> WatchEvents { get; set; } = new List<WatchEvent>();
}
