namespace Reprise.Application.Features.Series;

public sealed record EpisodeRefDto(long Id, int SeasonNumber, int EpisodeNumber, string? Name);

public sealed record SeriesListItemDto(
    long Id,
    int? TvdbId,
    string Name,
    string? PosterPath,
    string Status,
    /// <summary>
    /// Situação da PRODUÇÃO, vinda do TMDB ("Ended", "Canceled", "Returning Series"…), que é coisa
    /// diferente de <paramref name="Status"/> — este é a relação do usuário com a série. É a
    /// combinação dos dois que responde "já acabou e eu terminei?".
    /// </summary>
    string? ProductionStatus,
    int EpisodesTotal,
    int EpisodesWatched,
    double CompletionRatio,
    DateTimeOffset? LastWatchedAt,
    EpisodeRefDto? NextUp);

public sealed record EpisodeDto(
    long Id,
    int SeasonNumber,
    int EpisodeNumber,
    string? Name,
    int? RuntimeSeconds,
    bool IsSpecial,
    int WatchCount,
    DateTimeOffset? LastWatchedAt,
    /// <summary>Imagem de cena no TMDB. Nulo é comum em especiais (só 66% deles têm).</summary>
    string? StillPath,
    DateOnly? AirDate);

public sealed record SeasonDto(
    int SeasonNumber,
    string? Name,
    bool IsSpecials,
    IReadOnlyList<EpisodeDto> Episodes);

public sealed record SeriesDetailDto(
    long Id,
    int? TvdbId,
    string Name,
    string? OriginalName,
    string? Overview,
    string? PosterPath,
    string Status,
    /// <summary>Situação da produção no TMDB — ver <see cref="SeriesListItemDto.ProductionStatus"/>.</summary>
    string? ProductionStatus,
    DateOnly? FirstAirDate,
    int EpisodesTotal,
    int EpisodesWatched,
    double CompletionRatio,
    IReadOnlyList<SeasonDto> Seasons,
    /// <summary>
    /// Cada vez que você percorreu esta série, derivada do log por silêncio entre exibições.
    /// A contagem por episódio diz QUANTO; isto diz QUANDO — que é a pergunta do nome do app.
    ///
    /// <para>
    /// <b>Sem as marcações em massa.</b> Uma sessão é uma afirmação sobre <i>quando</i>, e o
    /// backfill do TV Time não tem quando: todas as exibições importadas carregam a data da
    /// importação. Incluí-las produziria uma sessão gigante e falsa — HIMYM apareceria como
    /// 2.851 exibições em 24 dias. Fora delas, o que sobra é curto mas verdadeiro.
    /// </para>
    /// </summary>
    IReadOnlyList<RewatchSessionDto> Sessions,
    /// <summary>Quantas exibições ficaram de fora das sessões por serem marcação em massa.</summary>
    int BackfillExhibitions);

public sealed record RewatchSessionDto(
    int Ordinal,
    DateTimeOffset StartedAt,
    DateTimeOffset EndedAt,
    int Exhibitions,
    int DistinctEpisodes,
    long TotalSeconds,
    int SpanDays);

public sealed record NextUpItemDto(
    long SeriesId,
    string SeriesName,
    string? PosterPath,
    EpisodeRefDto Episode,
    DateTimeOffset? LastActivityAt);

/// <summary>Estado de um episódio após uma marcação/desmarcação (o log é a fonte da verdade).</summary>
public sealed record WatchStateDto(long EpisodeId, int WatchCount, DateTimeOffset? LastWatchedAt);
