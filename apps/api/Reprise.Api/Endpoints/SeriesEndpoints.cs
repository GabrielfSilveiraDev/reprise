using Microsoft.AspNetCore.Http.HttpResults;
using Reprise.Application.Features.Series;

namespace Reprise.Api.Endpoints;

public static class SeriesEndpoints
{
    public sealed record StatusBody(string Status);

    public static void MapSeriesEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/series").WithTags("Series");

        // Resultados TIPADOS (não IResult): é deles que o OpenAPI extrai os schemas de resposta,
        // e é do OpenAPI que sai o cliente TypeScript de packages/shared.
        g.MapGet("/", async (SeriesQueries q, CancellationToken ct) =>
                TypedResults.Ok(await q.GetListAsync(ct)))
            .WithSummary("Lista as séries acompanhadas com progresso derivado do log de eventos.");

        g.MapGet("/{id:long}", async Task<Results<Ok<SeriesDetailDto>, NotFound>> (
                long id, SeriesQueries q, CancellationToken ct) =>
            {
                var detail = await q.GetDetailAsync(id, ct);
                return detail is null ? TypedResults.NotFound() : TypedResults.Ok(detail);
            })
            .WithSummary("Detalhe da série: temporadas e episódios com contagem de exibições (trilha de rewatch).");

        // Mudança de estado de acompanhamento. Não toca no log de exibições: arquivar uma série
        // não apaga nem cria um evento.
        g.MapPatch("/{id:long}/status", async (long id, StatusBody body, TrackingService s, CancellationToken ct) =>
                TypedResults.Ok(await s.SetAsync(id, body.Status, ct)))
            .WithSummary("Muda o estado da série: Following, Archived, ForLater ou Finished.");

        // Em lote, porque a regra de "isto acabou e eu terminei" mora no cliente (SeriesCompletion,
        // compartilhado e testado) — reimplementá-la no servidor criaria duas versões dela.
        g.MapPatch("/status", async (TrackingChange[] changes, TrackingService s, CancellationToken ct) =>
                TypedResults.Ok(await s.ApplyAsync(changes, ct)))
            .WithSummary("Muda o estado de várias séries de uma vez. Definir um valor é idempotente.");

        app.MapGet("/next-up", async (SeriesQueries q, CancellationToken ct) =>
                TypedResults.Ok(await q.GetNextUpAsync(ct)))
            .WithTags("Series")
            .WithSummary("Próximo episódio não visto de cada série acompanhada, por atividade recente.");
    }
}
