using Microsoft.AspNetCore.Http.HttpResults;
using Reprise.Application.Features.Export;

namespace Reprise.Api.Endpoints;

public static class ExportEndpoints
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
}
