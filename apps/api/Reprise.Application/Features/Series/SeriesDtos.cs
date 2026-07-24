namespace Reprise.Application.Features.Series;

public sealed record EpisodeRefDto(long Id, int SeasonNumber, int EpisodeNumber, string? Name);

public sealed record SeriesListItemDto(
    long Id,
    int? TvdbId,
    string Name,
    string? PosterPath,
    string Status,
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
    DateTimeOffset? LastWatchedAt);

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
    int EpisodesTotal,
    int EpisodesWatched,
    double CompletionRatio,
    IReadOnlyList<SeasonDto> Seasons);

public sealed record NextUpItemDto(
    long SeriesId,
    string SeriesName,
    string? PosterPath,
    EpisodeRefDto Episode,
    DateTimeOffset? LastActivityAt);

/// <summary>Estado de um episódio após uma marcação/desmarcação (o log é a fonte da verdade).</summary>
public sealed record WatchStateDto(long EpisodeId, int WatchCount, DateTimeOffset? LastWatchedAt);
