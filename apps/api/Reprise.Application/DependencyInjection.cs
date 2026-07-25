using Microsoft.Extensions.DependencyInjection;
using Reprise.Application.Features.Profile;
using Reprise.Application.Features.Series;
using Reprise.Application.Features.Watching;
using Reprise.Application.Import;

namespace Reprise.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddRepriseApplication(this IServiceCollection services)
    {
        // Importação
        services.AddScoped<ImportPlanner>();
        services.AddScoped<ImportService>();

        // O SeriesEnrichmentService NÃO entra aqui: ele depende de ITmdbClient, que só existe
        // quando há chave configurada. Registrá-lo aqui derrubaria a API na validação de DI.
        // Ele é registrado por AddRepriseTmdb, junto do client de que precisa.

        // Leitura e marcação
        services.AddScoped<SeriesQueries>();
        services.AddScoped<WatchingService>();
        services.AddScoped<ProfileQueries>();

        return services;
    }
}
