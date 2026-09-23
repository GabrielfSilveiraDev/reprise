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
                    // O instante, e não a data em UTC. A data sozinha não basta: quem sabe se
                    // um episódio já saiu é o fuso de ORIGEM da série, e às 21h no Brasil o UTC já
                    // virou amanhã — era assim que a estreia de amanhã desaparecia da lista.
                    return TypedResults.Ok(await q.GetUpcomingAsync(clock.GetUtcNow(), withinDays ?? 180, ct));
                })
            .WithTags("Premieres")
            .WithSummary("Episódios ainda por estrear das séries acompanhadas, do mais próximo ao mais distante.");
    }
}
