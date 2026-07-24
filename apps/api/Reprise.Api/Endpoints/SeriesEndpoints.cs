using Reprise.Application.Features.Series;

namespace Reprise.Api.Endpoints;

public static class SeriesEndpoints
{
    public static void MapSeriesEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/series").WithTags("Series");

        g.MapGet("/", async (SeriesQueries q, CancellationToken ct) =>
                Results.Ok(await q.GetListAsync(ct)))
            .WithSummary("Lista as séries acompanhadas com progresso derivado do log de eventos.");

        g.MapGet("/{id:long}", async (long id, SeriesQueries q, CancellationToken ct) =>
            {
                var detail = await q.GetDetailAsync(id, ct);
                return detail is null ? Results.NotFound() : Results.Ok(detail);
            })
            .WithSummary("Detalhe da série: temporadas e episódios com contagem de exibições (trilha de rewatch).");

        app.MapGet("/next-up", async (SeriesQueries q, CancellationToken ct) =>
                Results.Ok(await q.GetNextUpAsync(ct)))
            .WithTags("Series")
            .WithSummary("Próximo episódio não visto de cada série acompanhada, por atividade recente.");
    }
}
