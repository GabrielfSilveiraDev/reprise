using Reprise.Application.Features.Premieres;

namespace Reprise.Api.Endpoints;

public static class PremiereEndpoints
{
    public static void MapPremiereEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/premieres",
                async (int? withinDays, PremiereQueries q, TimeProvider clock, CancellationToken ct) =>
                {
                    // O instante, e não a data em UTC. A data sozinha não basta: quem sabe se
                    // um episódio já saiu é o fuso de ORIGEM da série, e às 21h no Brasil o UTC já
                    // virou amanhã — era assim que a estreia de amanhã desaparecia da lista.
                    return TypedResults.Ok(await q.GetUpcomingAsync(clock.GetUtcNow(), withinDays, ct));
                })
            .WithTags("Premieres")
            .WithSummary("Episódios ainda por estrear das séries acompanhadas, do mais próximo ao mais distante. Sem withinDays, sem limite de distância.");
    }
}
