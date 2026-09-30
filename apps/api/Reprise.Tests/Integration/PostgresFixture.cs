using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Infrastructure.Persistence;
using Testcontainers.PostgreSql;

namespace Reprise.Tests.Integration;

/// <summary>
/// Um Postgres de verdade, descartável, para os testes que precisam de SQL de verdade.
///
/// <b>Por que não basta um fake em memória.</b> O que estes testes protegem é justamente o que só
/// existe no banco: se <c>GroupBy(...).First()</c> vira <c>DISTINCT ON</c> ou estoura em tempo de
/// execução, se <c>ORDER BY ... DESC</c> põe nulo na frente, e se o filtro global de tenant alcança
/// as subconsultas de navegação. Um provider em memória responde "sim" para tudo isso sem provar
/// nada — foi por não ter esta camada que a lista de séries pôde ser reescrita sem rede.
///
/// O container sobe uma vez por classe de teste e morre junto com ela.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    // Mesma imagem do docker-compose: testar contra outra versão testaria outro banco.
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        // `EnsureCreated` e não `Migrate`: o que se testa aqui é o comportamento das consultas
        // sobre o modelo atual, não o histórico de migrações.
        await using var db = CreateContext(Guid.NewGuid());
        await db.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync() => await _container.DisposeAsync();

    /// <summary>Para quem sobe a API inteira sobre este banco (ver ApiPipelineTests).</summary>
    public string ConnectionString => _container.GetConnectionString();

    /// <summary>Um contexto enxergando o banco como <paramref name="userId"/> — o tenant atual.</summary>
    public RepriseDbContext CreateContext(Guid userId)
    {
        var options = new DbContextOptionsBuilder<RepriseDbContext>()
            .UseNpgsql(_container.GetConnectionString())
            .UseSnakeCaseNamingConvention()
            .Options;

        return new RepriseDbContext(options, new FixedUser(userId));
    }

    /// <summary>O tenant, fixo. Público porque os serviços de escrita o recebem por construtor.</summary>
    public sealed record FixedUser(Guid UserId) : ICurrentUser;
}
