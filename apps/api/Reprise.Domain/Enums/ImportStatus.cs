namespace Reprise.Domain.Enums;

public enum ImportStatus
{
    Running = 0,
    /// <summary>Concluído; os invariantes duros passaram (o cross-check com o vendor pode ter divergências toleradas).</summary>
    Completed = 1,
    /// <summary>Abortado por violação de invariante duro (perda de linha, etc.).</summary>
    Failed = 2
}
