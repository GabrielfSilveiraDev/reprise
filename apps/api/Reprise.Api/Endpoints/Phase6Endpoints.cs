using Microsoft.AspNetCore.Http.HttpResults;
using Reprise.Application.Features.Export;
using Reprise.Application.Features.Premieres;

namespace Reprise.Api.Endpoints;

public static class Phase6Endpoints
{
    public static void MapExportEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/export",
                async Task<Results<Ok<ExportDocument>, NotFound>> (
                    ExportQueries q, HttpContext http, CancellationToken ct) =>
                {
                    var document = await q.BuildAsync(ct);
                    if (document is null) return TypedResults.NotFound();

                    // `Content-Disposition` com data no nome: quem baixa dois exports em semanas
                    // diferentes não quer descobrir depois qual é qual.
                    var nome = $"reprise-{DateTimeOffset.UtcNow:yyyy-MM-dd}.json";
                    http.Response.Headers.ContentDisposition = $"attachment; filename=\"{nome}\"";
                    return TypedResults.Ok(document);
                })
            .WithTags("Export")
            .WithSummary("Export completo e reconstruível: perfil, séries e todas as exibições.");
    }

    public static void MapPremiereEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/premieres",
                async (int? withinDays, PremiereQueries q, TimeProvider clock, CancellationToken ct) =>
                {
                    var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
                    return TypedResults.Ok(await q.GetUpcomingAsync(today, withinDays ?? 180, ct));
                })
            .WithTags("Premieres")
            .WithSummary("Episódios ainda por estrear das séries acompanhadas, do mais próximo ao mais distante.");
    }
}
