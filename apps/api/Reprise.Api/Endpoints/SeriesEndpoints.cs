using Microsoft.AspNetCore.Http.HttpResults;
using Reprise.Application.Features.Series;

namespace Reprise.Api.Endpoints;

public static class SeriesEndpoints
{
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

        app.MapGet("/next-up", async (SeriesQueries q, CancellationToken ct) =>
                TypedResults.Ok(await q.GetNextUpAsync(ct)))
            .WithTags("Series")
            .WithSummary("Próximo episódio não visto de cada série acompanhada, por atividade recente.");
    }
}
