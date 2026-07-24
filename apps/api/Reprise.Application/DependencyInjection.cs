using Microsoft.Extensions.DependencyInjection;
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

        // Leitura e marcação
        services.AddScoped<SeriesQueries>();
        services.AddScoped<WatchingService>();

        return services;
    }
}
