using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Reprise.Domain.Entities;

namespace Reprise.Tests.Integration;

/// <summary>
/// Sessão de ponta a ponta, pelo pipeline HTTP: a rotação do refresh e a validação de e-mail.
/// Cada teste começa sem nenhuma conta.
/// </summary>
public sealed class AuthFlowTests : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private readonly PostgresFixture _pg;
    private readonly WebApplicationFactory<Program> _api;

    public AuthFlowTests(PostgresFixture pg)
    {
        _pg = pg;
        _api = new WebApplicationFactory<Program>().WithWebHostBuilder(web =>
        {
            web.UseSetting("ConnectionStrings:Default", _pg.ConnectionString);
            web.UseSetting("Jwt:Secret", new string('s', 48));
        });
    }

    public async Task InitializeAsync()
    {
        await using var db = _pg.CreateContext(Guid.NewGuid());
        await db.Database.ExecuteSqlRawAsync("TRUNCATE users RESTART IDENTITY CASCADE");
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    private sealed record SessionBody(string AccessToken, string RefreshToken, string UserId);

    private async Task<User> CriarContaAsync(string email, bool confirmada = true)
    {
        using var scope = _api.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
        var user = new User
        {
            Id = Guid.CreateVersion7(),
            UserName = email,
            Email = email,
            EmailConfirmed = confirmada,
            DisplayName = email.Split('@')[0],
            CreatedAt = DateTimeOffset.UtcNow
        };
        var criada = await users.CreateAsync(user, "senha-de-teste-123");
        Assert.True(criada.Succeeded, string.Join(' ', criada.Errors.Select(e => e.Description)));
        return user;
    }

    private static async Task<SessionBody> EntrarAsync(HttpClient client, string email)
    {
        var resposta = await client.PostAsJsonAsync("/auth/login", new { identifier = email, password = "senha-de-teste-123" });
        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        return (await resposta.Content.ReadFromJsonAsync<SessionBody>())!;
    }

    [Fact]
    public async Task Renovacoes_simultaneas_com_o_mesmo_token_so_uma_ganha()
    {
        await CriarContaAsync("dono@exemplo.com");
        var client = _api.CreateClient();

        // Aquecida antes: na primeira renovação o EF ainda compila as consultas, e esse tempo
        // espalha as concorrentes o bastante para nenhuma chegar a disputar o mesmo token.
        var sessao = await EntrarAsync(client, "dono@exemplo.com");
        sessao = (await (await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = sessao.RefreshToken }))
            .Content.ReadFromJsonAsync<SessionBody>())!;

        var respostas = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ =>
            client.PostAsJsonAsync("/auth/refresh", new { refreshToken = sessao.RefreshToken })));

        Assert.Single(respostas, r => r.StatusCode == HttpStatusCode.OK);
        Assert.All(respostas.Where(r => r.StatusCode != HttpStatusCode.OK),
            r => Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode));
    }

    [Fact]
    public async Task Confirmar_nao_entrega_sessao_de_conta_ja_validada()
    {
        // Antes, conta já confirmada recebia sessão em /auth/confirm sem o código ser conferido:
        // bastava saber o e-mail de alguém para entrar como essa pessoa.
        var conta = await CriarContaAsync("dono@exemplo.com");
        var client = _api.CreateClient();

        var errado = await client.PostAsJsonAsync("/auth/confirm", new { email = "dono@exemplo.com", code = "000000" });
        // Nem com o código CERTO: seis dígitos valendo como senha para sempre seriam adivinháveis.
        var certo = await client.PostAsJsonAsync("/auth/confirm", new { email = "dono@exemplo.com", code = await CodigoAsync(conta) });

        Assert.Equal(HttpStatusCode.Unauthorized, errado.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, certo.StatusCode);
        await using var db = _pg.CreateContext(Guid.NewGuid());
        Assert.Equal(0, await db.RefreshTokens.CountAsync());
    }

    [Fact]
    public async Task Confirmar_com_o_codigo_certo_entra_e_o_codigo_morre()
    {
        var conta = await CriarContaAsync("nova@exemplo.com", confirmada: false);
        var codigo = await CodigoAsync(conta);

        var client = _api.CreateClient();
        var primeira = await client.PostAsJsonAsync("/auth/confirm", new { email = "nova@exemplo.com", code = codigo });
        var segunda = await client.PostAsJsonAsync("/auth/confirm", new { email = "nova@exemplo.com", code = codigo });

        Assert.Equal(HttpStatusCode.OK, primeira.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, segunda.StatusCode);
    }

    private async Task<string> CodigoAsync(User conta)
    {
        using var scope = _api.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
        var user = (await users.FindByIdAsync(conta.Id.ToString()))!;
        return await users.GenerateUserTokenAsync(user, TokenOptions.DefaultEmailProvider, "EmailConfirmation");
    }
}
