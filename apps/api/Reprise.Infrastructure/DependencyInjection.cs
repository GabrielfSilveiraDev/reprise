using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Reprise.Application.Abstractions;
using Reprise.Infrastructure.Persistence;

namespace Reprise.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddRepriseInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<RepriseDbContext>(options =>
            options.UseNpgsql(connectionString).UseSnakeCaseNamingConvention());

        services.AddScoped<IRepriseDbContext>(sp => sp.GetRequiredService<RepriseDbContext>());

        // Single-user por ora; na API isto passa a ler o sub do JWT.
        services.AddScoped<ICurrentUser, SeedCurrentUser>();

        return services;
    }
}
