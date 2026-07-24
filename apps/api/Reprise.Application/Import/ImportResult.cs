namespace Reprise.Application.Import;

/// <summary>Resumo de uma execução do importador, para o relatório de conferência da CLI.</summary>
public sealed record ImportResult(
    long ImportRunId,
    int RowsRead,
    int EventsCreated,
    int EventsSkipped,
    int SeriesCreated,
    int EpisodesCreated,
    int TrackedUpserted,
    IReadOnlyList<PlannedSeries> CatalogSeries,
    ImportPlan Plan)
{
    public ReconciliationReport Reconciliation => Plan.Reconciliation;
}
