namespace Reprise.Application.Features.Stats;

/// <summary>
/// Consultas analíticas. Ao contrário do resto da camada de leitura, estas vivem em SQL na
/// Infrastructure: são agregações com <c>FILTER (WHERE)</c>, <c>date_trunc</c> e <c>GROUP BY</c>
/// sobre dezenas de milhares de eventos, exatamente o que o LINQ traduz mal e o Postgres faz bem.
/// A Application define o contrato e os DTOs; quem escreve o SQL é a Infrastructure.
/// </summary>
public interface IStatsQueries
{
    /// <param name="includeBackfill">
    /// As exibições de backfill (o "marcar temporada inteira" que o TV Time gravou tudo na mesma
    /// data) distorcem qualquer gráfico temporal. Por padrão ficam de fora; o painel oferece o toggle.
    /// </param>
    Task<StatsOverviewDto> GetOverviewAsync(bool includeBackfill, CancellationToken ct = default);

    Task<IReadOnlyList<CalendarDayDto>> GetCalendarAsync(int year, bool includeBackfill, CancellationToken ct = default);
}
