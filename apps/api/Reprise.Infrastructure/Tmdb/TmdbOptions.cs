namespace Reprise.Infrastructure.Tmdb;

/// <summary>
/// Configuração do TMDB. A chave <b>nunca</b> mora no repositório: vem de variável de ambiente
/// (<c>Tmdb__ApiKey</c>) ou de <c>dotnet user-secrets</c> em desenvolvimento.
/// </summary>
public sealed class TmdbOptions
{
    public const string SectionName = "Tmdb";

    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Idioma dos metadados. pt-BR com fallback do próprio TMDB para o original.</summary>
    public string Language { get; set; } = "pt-BR";

    /// <summary>Repetições em falha transitória (a própria TMDbLib trata o 429 de rate limit).</summary>
    public int MaxRetryCount { get; set; } = 3;

    public int TimeoutSeconds { get; set; } = 30;
}
