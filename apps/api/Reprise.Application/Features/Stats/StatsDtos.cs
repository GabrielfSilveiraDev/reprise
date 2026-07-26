namespace Reprise.Application.Features.Stats;

/// <summary>
/// Números do topo do painel. Tudo derivado do log de eventos, nada mantido em sincronia.
///
/// <b>Este resumo conta o acervo inteiro, backfill incluído</b>, porque "quantos episódios assisti"
/// não é uma pergunta sobre datas. Só as visões com eixo de tempo (por ano, por mês, calendário,
/// sequências) descartam o backfill, e por isso mostram menos.
///
/// <paramref name="BackfillExhibitions"/> é quantas das <paramref name="Exhibitions"/> têm data de
/// lote em vez de data real. Não desconta nada: existe para a tela poder explicar a diferença
/// entre o total e o que aparece na linha do tempo, em vez de deixar o usuário achar que sumiu.
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
