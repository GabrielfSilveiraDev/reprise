namespace Reprise.Domain.Entities;

/// <summary>
/// Série no catálogo canônico (espelho do TMDB), global e compartilhada entre usuários.
/// Durante a importação nasce como "stub" a partir do CSV (nome provisório + <see cref="TvdbId"/>)
/// e é enriquecida depois pelo TMDB. A relação do usuário com ela vive em <see cref="TrackedSeries"/>.
/// </summary>
public class Series
{
    public long Id { get; set; }

    /// <summary>Id no TMDB (preenchido no enriquecimento). Nulo enquanto não casado.</summary>
    public int? TmdbId { get; set; }

    /// <summary>Id no TheTVDB — é o <c>s_id</c> do export do TV Time e a chave de casamento.</summary>
    public int? TvdbId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? OriginalName { get; set; }
    public string? Overview { get; set; }
    public string? PosterPath { get; set; }
    public DateOnly? FirstAirDate { get; set; }
    public string? Status { get; set; }

    /// <summary>Runtime médio da série (segundos), do TMDB — fallback para episódios sem runtime.</summary>
    public int? FallbackRuntimeSeconds { get; set; }

    /// <summary>True quando os metadados já vieram do TMDB (não é mais só stub do CSV).</summary>
    public bool MetadataEnriched { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<Season> Seasons { get; set; } = new List<Season>();
    public ICollection<Episode> Episodes { get; set; } = new List<Episode>();
}
