using Microsoft.AspNetCore.Http.HttpResults;
using Reprise.Application.Features.Profile;

namespace Reprise.Api.Endpoints;

public static class ProfileEndpoints
{
    public static void MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/me",
                async Task<Results<Ok<ProfileDto>, NotFound>> (ProfileQueries q, CancellationToken ct) =>
                {
                    var profile = await q.GetAsync(ct);
                    return profile is null ? TypedResults.NotFound() : TypedResults.Ok(profile);
                })
            .WithTags("Profile")
            .WithSummary("Perfil do dono dos dados e o tamanho do acervo dele.");
    }
}
