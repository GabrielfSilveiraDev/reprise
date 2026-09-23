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

    /// <summary>
    /// Id no TVmaze, fonte da data e do horário de estreia. Casado pelo <see cref="TvdbId"/>
    /// (o TVmaze aceita busca por id do TheTVDB) e, quando esse falta, pelo nome.
    /// Nulo quando a série não foi encontrada lá — e aí o cálculo cai no TMDB.
    /// </summary>
    public int? TvmazeId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? OriginalName { get; set; }
    public string? Overview { get; set; }
    public string? PosterPath { get; set; }
    public DateOnly? FirstAirDate { get; set; }
    public string? Status { get; set; }

    /// <summary>
    /// País de origem (ISO 3166-1 alfa-2), do TMDB. É o que permite saber <b>quando</b> um
    /// episódio sai: a <c>air_date</c> não tem hora nem fuso, então sem o país não dá para
    /// distinguir uma estreia japonesa de uma americana no mesmo dia do calendário.
    /// Ver <c>ReleaseSchedule</c>. Nulo enquanto a série não passou pelo enriquecimento.
    /// </summary>
    public string? OriginCountry { get; set; }

    /// <summary>Runtime médio da série (segundos), do TMDB — fallback para episódios sem runtime.</summary>
    public int? FallbackRuntimeSeconds { get; set; }

    /// <summary>True quando os metadados já vieram do TMDB (não é mais só stub do CSV).</summary>
    public bool MetadataEnriched { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<Season> Seasons { get; set; } = new List<Season>();
    public ICollection<Episode> Episodes { get; set; } = new List<Episode>();
}
