namespace Reprise.Domain.Enums;

/// <summary>Origem de um evento de exibição (proveniência), independente de <c>IsBackfill</c>.</summary>
public enum WatchEventSource
{
    /// <summary>Criado pela importação do export do TV Time.</summary>
    TvTimeImport = 0,
    /// <summary>Criado manualmente pelo usuário no app.</summary>
    Manual = 1
}
