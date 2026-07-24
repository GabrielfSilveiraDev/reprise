using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Reprise.Infrastructure.Persistence;

/// <summary>
/// Fábrica de design-time para o <c>dotnet ef</c> (migrations). Lê a connection string de
/// <c>ConnectionStrings__Default</c> ou cai no padrão do docker-compose local.
/// </summary>
public sealed class RepriseDbContextFactory : IDesignTimeDbContextFactory<RepriseDbContext>
{
    public RepriseDbContext CreateDbContext(string[] args)
    {
        var conn = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
                   ?? "Host=localhost;Port=5432;Database=reprise;Username=reprise;Password=reprise";

        var options = new DbContextOptionsBuilder<RepriseDbContext>()
            .UseNpgsql(conn)
            .UseSnakeCaseNamingConvention()
            .Options;

        return new RepriseDbContext(options, new SeedCurrentUser());
    }
}
