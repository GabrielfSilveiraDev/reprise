using Microsoft.Extensions.DependencyInjection;
using Reprise.Application.Import;

namespace Reprise.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddRepriseApplication(this IServiceCollection services)
    {
        services.AddScoped<ImportPlanner>();
        services.AddScoped<ImportService>();
        return services;
    }
}
