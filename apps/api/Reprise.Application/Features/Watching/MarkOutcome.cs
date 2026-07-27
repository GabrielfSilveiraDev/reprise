using Reprise.Application.Features.Series;

namespace Reprise.Application.Features.Watching;

/// <summary>Por que uma marcação não virou evento.</summary>
public enum MarkRefusal
{
    /// <summary>Virou: não houve recusa.</summary>
    None,

    /// <summary>O episódio não existe no catálogo.</summary>
    EpisodeNotFound,

    /// <summary>O episódio ainda não foi ao ar.</summary>
    NotAiredYet,

    /// <summary>A data da exibição está no futuro.</summary>
    WatchedInTheFuture,
}

/// <summary>
/// Resultado de uma marcação.
///
/// <para>
/// Existe porque <c>null</c> deixou de bastar. Enquanto a única falha possível era "episódio
/// inexistente", devolver <c>WatchStateDto?</c> dizia tudo; agora há duas falhas com respostas
/// HTTP e mensagens diferentes, e distingui-las por ausência de valor obrigaria a camada da API a
/// adivinhar qual das duas aconteceu.
/// </para>
/// </summary>
public sealed record MarkOutcome(WatchStateDto? State, MarkRefusal Refusal)
{
    public static MarkOutcome Ok(WatchStateDto state) => new(state, MarkRefusal.None);

    public static MarkOutcome NotFound { get; } = new(null, MarkRefusal.EpisodeNotFound);

    public static MarkOutcome NotAired { get; } = new(null, MarkRefusal.NotAiredYet);

    public static MarkOutcome FutureDate { get; } = new(null, MarkRefusal.WatchedInTheFuture);
}
