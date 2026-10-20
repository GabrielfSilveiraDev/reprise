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
        var conn = PostgresConnectionString.FromEnvironment();

        var options = new DbContextOptionsBuilder<RepriseDbContext>()
            .UseNpgsql(conn)
            .UseSnakeCaseNamingConvention()
            .Options;

        return new RepriseDbContext(options, new SeedCurrentUser());
    }
}
