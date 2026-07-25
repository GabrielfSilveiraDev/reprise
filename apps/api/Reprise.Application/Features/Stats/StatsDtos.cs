namespace Reprise.Application.Features.Stats;

/// <summary>
/// Números do topo do painel. Tudo derivado do log de eventos, nada mantido em sincronia.
/// <paramref name="BackfillExhibitions"/> conta o backfill do usuário inteiro e NÃO respeita o
/// recorte — é justamente o número que a tela mostra como "oculto" quando o filtro está desligado.
/// </summary>
public sealed record StatsSummaryDto(
    int Exhibitions,
    int DistinctEpisodes,
    int SeriesCount,
    long TotalSeconds,
    int BackfillExhibitions,
    double RewatchRate,
    DateTimeOffset? FirstWatchedAt,
    DateTimeOffset? LastWatchedAt);

/// <summary>Um balde temporal (mês ou ano) com o que foi assistido nele.</summary>
public sealed record TimeBucketDto(string Label, int Exhibitions, long Seconds);

public sealed record TopSeriesDto(long SeriesId, string Name, int Exhibitions, int DistinctEpisodes, long Seconds);

/// <summary>Um dia do heatmap. Só dias com atividade voltam — o cliente preenche os vazios.</summary>
public sealed record CalendarDayDto(DateOnly Date, int Exhibitions, long Seconds);

public sealed record StreaksDto(int LongestDays, int CurrentDays, DateOnly? LongestStartedAt, DateOnly? LongestEndedAt);

public sealed record StatsOverviewDto(
    StatsSummaryDto Summary,
    IReadOnlyList<TimeBucketDto> ByYear,
    IReadOnlyList<TimeBucketDto> ByMonth,
    IReadOnlyList<TopSeriesDto> TopSeries,
    StreaksDto Streaks,
    IReadOnlyList<int> AvailableYears);
