using Reprise.Domain.Enums;

namespace Reprise.Domain.Entities;

/// <summary>Auditoria de uma execução do importador — alimenta o relatório de conferência e a reexecução idempotente.</summary>
public class ImportRun
{
    public long Id { get; set; }
    public Guid UserId { get; set; }

    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }

    public string? SourceFileSha256 { get; set; }

    public int RowsRead { get; set; }
    public int EventsCreated { get; set; }
    public int SeriesCreated { get; set; }
    public int SeriesTmdbMatched { get; set; }
    public int SeriesUnmatched { get; set; }

    /// <summary>Relatório de reconciliação (invariantes duros + cross-check com o vendor) serializado em JSON.</summary>
    public string? ReconciliationJson { get; set; }

    public ImportStatus Status { get; set; } = ImportStatus.Running;
}
