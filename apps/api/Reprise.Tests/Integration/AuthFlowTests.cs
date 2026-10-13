using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Reprise.Domain.Entities;
using Reprise.Infrastructure.Auth;
using Reprise.Infrastructure.Persistence;

namespace Reprise.Tests.Integration;

/// <summary>
/// Sessão de ponta a ponta, pelo pipeline HTTP: o passe do launcher, a rotação do refresh e a
/// validação de e-mail. Cada teste começa sem nenhuma conta, porque "a única conta confirmada" é
/// justamente uma das regras em teste.
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

    private async Task<LauncherTicket> EmitirPasseAsync(string? email = null)
    {
        using var scope = _api.Services.CreateScope();
        var issuer = new LauncherTicketIssuer(
            scope.ServiceProvider.GetRequiredService<RepriseDbContext>(),
            scope.ServiceProvider.GetRequiredService<UserManager<User>>(),
            TimeProvider.System);
        return await issuer.IssueAsync(email);
    }

    [Fact]
    public async Task Passe_do_launcher_vira_sessao_uma_vez_so()
    {
        var dono = await CriarContaAsync("dono@exemplo.com");
        var passe = await EmitirPasseAsync();
        Assert.True(passe.Issued, passe.Problem);

        var client = _api.CreateClient();
        var troca = await client.PostAsJsonAsync("/auth/launcher", new { ticket = passe.Token });
        Assert.Equal(HttpStatusCode.OK, troca.StatusCode);
        var sessao = await troca.Content.ReadFromJsonAsync<SessionBody>();
        Assert.Equal(dono.Id.ToString(), sessao!.UserId);

        // A sessão trocada é de verdade: abre uma rota protegida.
        using var me = new HttpRequestMessage(HttpMethod.Get, "/me");
        me.Headers.Authorization = new("Bearer", sessao.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(me)).StatusCode);

        // E o passe já foi: quem o copiar da linha de comando ou do histórico não entra.
        var repetida = await client.PostAsJsonAsync("/auth/launcher", new { ticket = passe.Token });
        Assert.Equal(HttpStatusCode.Unauthorized, repetida.StatusCode);
    }

    [Fact]
    public async Task Rota_do_passe_recusa_refresh_token_comum()
    {
        // Sem esta recusa, quem tem conta na instância mandaria um link #entrar=<o refresh dela>
        // e jogaria quem o abrisse dentro da conta dela.
        await CriarContaAsync("outra@exemplo.com");
        var client = _api.CreateClient();
        var sessao = await EntrarAsync(client, "outra@exemplo.com");

        var troca = await client.PostAsJsonAsync("/auth/launcher", new { ticket = sessao.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, troca.StatusCode);

        // E a recusa não gasta o token: a sessão dela segue valendo.
        var renovada = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = sessao.RefreshToken });
        Assert.Equal(HttpStatusCode.OK, renovada.StatusCode);
    }

    [Fact]
    public async Task Refresh_recusa_o_passe()
    {
        await CriarContaAsync("dono@exemplo.com");
        var passe = await EmitirPasseAsync();
        var client = _api.CreateClient();

        var troca = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = passe.Token });
        Assert.Equal(HttpStatusCode.Unauthorized, troca.StatusCode);

        // Recusado por lá, o passe continua inteiro para a rota dele.
        var certa = await client.PostAsJsonAsync("/auth/launcher", new { ticket = passe.Token });
        Assert.Equal(HttpStatusCode.OK, certa.StatusCode);
    }

    [Fact]
    public async Task Passe_vale_cinco_minutos()
    {
        await CriarContaAsync("dono@exemplo.com");
        var passe = await EmitirPasseAsync();

        await using var db = _pg.CreateContext(Guid.NewGuid());
        var guardado = await db.RefreshTokens.SingleAsync();
        Assert.Equal(LauncherTicketIssuer.Lifetime, guardado.ExpiresAt - guardado.CreatedAt);
        Assert.Equal(LauncherTicketIssuer.DeviceLabel, guardado.Device);
        // Só o hash fica no banco, como em toda sessão.
        Assert.Equal(RefreshToken.Hash(passe.Token!), guardado.TokenHash);
    }

    [Fact]
    public async Task Passe_sem_email_vai_para_a_unica_conta_confirmada()
    {
        var dono = await CriarContaAsync("dono@exemplo.com");
        await CriarContaAsync("pendente@exemplo.com", confirmada: false);

        var passe = await EmitirPasseAsync();
        Assert.True(passe.Issued, passe.Problem);

        await using var db = _pg.CreateContext(Guid.NewGuid());
        Assert.Equal(dono.Id, (await db.RefreshTokens.SingleAsync()).UserId);
    }

    [Fact]
    public async Task Passe_recusa_adivinhar_entre_duas_contas()
    {
        await CriarContaAsync("ana@exemplo.com");
        var bia = await CriarContaAsync("bia@exemplo.com");

        var semEmail = await EmitirPasseAsync();
        Assert.False(semEmail.Issued);
        Assert.Contains("--email", semEmail.Problem);

        var comEmail = await EmitirPasseAsync("bia@exemplo.com");
        Assert.True(comEmail.Issued, comEmail.Problem);
        await using var db = _pg.CreateContext(Guid.NewGuid());
        Assert.Equal(bia.Id, (await db.RefreshTokens.SingleAsync()).UserId);
    }

    [Fact]
    public async Task Passe_recusa_conta_inexistente_nao_validada_ou_banco_vazio()
    {
        Assert.False((await EmitirPasseAsync()).Issued);

        await CriarContaAsync("pendente@exemplo.com", confirmada: false);
        Assert.False((await EmitirPasseAsync("pendente@exemplo.com")).Issued);
        Assert.False((await EmitirPasseAsync("ninguem@exemplo.com")).Issued);

        await using var db = _pg.CreateContext(Guid.NewGuid());
        Assert.Equal(0, await db.RefreshTokens.CountAsync());
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
