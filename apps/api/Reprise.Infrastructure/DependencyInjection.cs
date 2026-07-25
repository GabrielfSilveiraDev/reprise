using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Reprise.Application.Abstractions;
using Reprise.Application.Enrichment;
using Reprise.Application.Features.Stats;
using Reprise.Infrastructure.Persistence;
using Reprise.Infrastructure.Tmdb;

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

        // Estatística é SQL cru sobre o DbContext — por isso mora na Infrastructure.
        services.AddScoped<IStatsQueries, StatsQueries>();

        return services;
    }

    /// <summary>
    /// Registra o cliente do TMDB. Fica separado de <see cref="AddRepriseInfrastructure"/> de propósito:
    /// a API e o importador funcionam sem chave nenhuma — só o enriquecimento precisa dela, e falhar
    /// na inicialização por causa de um passo opcional seria um mau negócio.
    /// </summary>
    public static IServiceCollection AddRepriseTmdb(
        this IServiceCollection services, Action<TmdbOptions>? configure = null)
    {
        services.Configure<TmdbOptions>(o =>
        {
            o.ApiKey = Environment.GetEnvironmentVariable("Tmdb__ApiKey") ?? o.ApiKey;
            if (Environment.GetEnvironmentVariable("Tmdb__Language") is { Length: > 0 } lang) o.Language = lang;
            configure?.Invoke(o);
        });

        services.AddSingleton<ITmdbClient, TmdbClient>();
        services.AddScoped<SeriesEnrichmentService>();
        return services;
    }
}
