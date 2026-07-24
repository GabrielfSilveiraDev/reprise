using Reprise.Domain.Enums;

namespace Reprise.Application.Import;

/// <summary>
/// Resultado puro do planejamento da importação (sem tocar banco ou TMDB): o que deve existir
/// no catálogo, quais eventos criar, e a reconciliação. É a peça central testável com fixtures reais.
/// </summary>
public sealed record ImportPlan(
    IReadOnlyList<PlannedSeries> Series,
    IReadOnlyList<PlannedEpisode> Episodes,
    IReadOnlyList<PlannedWatchEvent> Events,
    IReadOnlyList<PlannedTrackedSeries> TrackedSeries,
    IReadOnlyList<RejectedRow> Rejected,
    ReconciliationReport Reconciliation);

/// <summary>Chave natural de um episódio no export: (tvdb da série, temporada, episódio).</summary>
public readonly record struct EpisodeKey(int TvdbId, int SeasonNumber, int EpisodeNumber);

public sealed record PlannedSeries(int TvdbId, string ProvisionalName);

public sealed record PlannedEpisode(
    EpisodeKey Key,
    int? RuntimeSeconds,
    bool IsSpecial);

public sealed record PlannedWatchEvent(
    EpisodeKey Episode,
    DateTimeOffset WatchedAt,
    bool IsBackfill,
    string SourceKey);

public sealed record PlannedTrackedSeries(
    int TvdbId,
    SeriesStatus Status,
    DateTimeOffset? FollowedAt);

public sealed record RejectedRow(string Key, RecordType Type, string Reason);
