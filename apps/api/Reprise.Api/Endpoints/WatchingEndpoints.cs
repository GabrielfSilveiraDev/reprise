using Microsoft.AspNetCore.Http.HttpResults;
using Reprise.Application.Features.Series;
using Reprise.Application.Features.Watching;

namespace Reprise.Api.Endpoints;

public static class WatchingEndpoints
{
    // `ClientKey` é a chave de idempotência gerada no dispositivo. O app offline reenvia a MESMA
    // chave em toda retentativa, e é ela que impede que uma resposta perdida vire um rewatch fantasma.
    // Opcional: o cliente web marca online e omite.
    public sealed record MarkBody(DateTimeOffset? WatchedAt, string? ClientKey);
    public sealed record MarkUpToBody(int SeasonNumber, int EpisodeNumber, DateTimeOffset? WatchedAt, string? ClientKey);

    /// <summary>Quantos episódios uma marcação em massa efetivamente criou.</summary>
    public sealed record BulkMarkResult(int Marked);

    public static void MapWatchingEndpoints(this IEndpointRouteBuilder app)
    {
        // Marcar (append). Repetir no mesmo episódio é um rewatch — repetir a mesma CHAVE não é.
        app.MapPost("/episodes/{id:long}/watch",
                async Task<Results<Ok<WatchStateDto>, NotFound>> (
                    long id, MarkBody? body, WatchingService s, CancellationToken ct) =>
                {
                    var state = await s.MarkAsync(id, body?.WatchedAt, body?.ClientKey, ct);
                    return state is null ? TypedResults.NotFound() : TypedResults.Ok(state);
                })
            .WithTags("Watching")
            .WithSummary("Marca o episódio como visto (novo evento). Repetir = rewatch.");

        // Desmarcar (remove a exibição mais recente). A chave vai na query porque DELETE com corpo
        // é mal suportado pela pilha HTTP; um UUID aleatório não é dado sensível em URL.
        app.MapDelete("/episodes/{id:long}/watch",
                async Task<Results<Ok<WatchStateDto>, NotFound>> (
                    long id, string? clientKey, WatchingService s, CancellationToken ct) =>
                {
                    var state = await s.UnmarkAsync(id, clientKey, ct);
                    return state is null ? TypedResults.NotFound() : TypedResults.Ok(state);
                })
            .WithTags("Watching")
            .WithSummary("Remove a exibição mais recente do episódio (decrementa o rewatch).");

        // Marcar temporada inteira (só o que falta).
        app.MapPost("/series/{id:long}/seasons/{seasonNumber:int}/watch",
                async (long id, int seasonNumber, MarkBody? body, WatchingService s, CancellationToken ct) =>
                    TypedResults.Ok(new BulkMarkResult(
                        await s.MarkSeasonAsync(id, seasonNumber, body?.WatchedAt, body?.ClientKey, ct))))
            .WithTags("Watching")
            .WithSummary("Marca todos os episódios ainda não vistos da temporada.");

        // Marcar até aqui (regulares até o ponto, só o que falta).
        app.MapPost("/series/{id:long}/watch-up-to",
                async (long id, MarkUpToBody body, WatchingService s, CancellationToken ct) =>
                    TypedResults.Ok(new BulkMarkResult(
                        await s.MarkUpToAsync(id, body.SeasonNumber, body.EpisodeNumber, body.WatchedAt, body.ClientKey, ct))))
            .WithTags("Watching")
            .WithSummary("Marca todos os episódios regulares até (temporada, episódio), ainda não vistos.");
    }
}
