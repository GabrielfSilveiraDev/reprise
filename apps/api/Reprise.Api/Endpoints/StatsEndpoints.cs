using Reprise.Application.Features.Stats;

namespace Reprise.Api.Endpoints;

public static class StatsEndpoints
{
    public static void MapStatsEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/stats").WithTags("Stats");

        g.MapGet("/overview", async (bool? includeBackfill, IStatsQueries q, CancellationToken ct) =>
                TypedResults.Ok(await q.GetOverviewAsync(includeBackfill ?? false, ct)))
            .WithSummary("Resumo, distribuição por ano/mês, top séries e sequências. Backfill fora por padrão.");

        g.MapGet("/calendar", async (int year, bool? includeBackfill, IStatsQueries q, CancellationToken ct) =>
                TypedResults.Ok(await q.GetCalendarAsync(year, includeBackfill ?? false, ct)))
            .WithSummary("Exibições por dia de um ano, para o heatmap. Só dias com atividade.");
    }
}
