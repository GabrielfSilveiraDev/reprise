using Microsoft.AspNetCore.Http.HttpResults;
using Reprise.Application.Features.Series;
using Reprise.Application.Features.Watching;

namespace Reprise.Api.Endpoints;

public static class WatchingEndpoints
{
    public sealed record MarkBody(DateTimeOffset? WatchedAt);
    public sealed record MarkUpToBody(int SeasonNumber, int EpisodeNumber, DateTimeOffset? WatchedAt);

    /// <summary>Quantos episódios uma marcação em massa efetivamente criou.</summary>
    public sealed record BulkMarkResult(int Marked);

    public static void MapWatchingEndpoints(this IEndpointRouteBuilder app)
    {
        // Marcar (append). Repetir no mesmo episódio é um rewatch.
        app.MapPost("/episodes/{id:long}/watch",
                async Task<Results<Ok<WatchStateDto>, NotFound>> (
                    long id, MarkBody? body, WatchingService s, CancellationToken ct) =>
                {
                    var state = await s.MarkAsync(id, body?.WatchedAt, ct);
                    return state is null ? TypedResults.NotFound() : TypedResults.Ok(state);
                })
            .WithTags("Watching")
            .WithSummary("Marca o episódio como visto (novo evento). Repetir = rewatch.");

        // Desmarcar (remove a exibição mais recente).
        app.MapDelete("/episodes/{id:long}/watch",
                async Task<Results<Ok<WatchStateDto>, NotFound>> (
                    long id, WatchingService s, CancellationToken ct) =>
                {
                    var state = await s.UnmarkAsync(id, ct);
                    return state is null ? TypedResults.NotFound() : TypedResults.Ok(state);
                })
            .WithTags("Watching")
            .WithSummary("Remove a exibição mais recente do episódio (decrementa o rewatch).");

        // Marcar temporada inteira (só o que falta).
        app.MapPost("/series/{id:long}/seasons/{seasonNumber:int}/watch",
                async (long id, int seasonNumber, MarkBody? body, WatchingService s, CancellationToken ct) =>
                    TypedResults.Ok(new BulkMarkResult(await s.MarkSeasonAsync(id, seasonNumber, body?.WatchedAt, ct))))
            .WithTags("Watching")
            .WithSummary("Marca todos os episódios ainda não vistos da temporada.");

        // Marcar até aqui (regulares até o ponto, só o que falta).
        app.MapPost("/series/{id:long}/watch-up-to",
                async (long id, MarkUpToBody body, WatchingService s, CancellationToken ct) =>
                    TypedResults.Ok(new BulkMarkResult(
                        await s.MarkUpToAsync(id, body.SeasonNumber, body.EpisodeNumber, body.WatchedAt, ct))))
            .WithTags("Watching")
            .WithSummary("Marca todos os episódios regulares até (temporada, episódio), ainda não vistos.");
    }
}
