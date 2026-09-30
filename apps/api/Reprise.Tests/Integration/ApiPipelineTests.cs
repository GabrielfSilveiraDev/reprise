using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Reprise.Application.Abstractions;

namespace Reprise.Tests.Integration;

/// <summary>
/// A API inteira, pelo pipeline HTTP, sobre um Postgres de verdade.
///
/// <para>
/// Os outros testes de integração exercitam os serviços direto. Estes cobrem o que só existe na
/// montagem da aplicação: a ordem dos middlewares, qual rota exige token, qual tem limite de
/// tentativas. E sobem em ambiente de Desenvolvimento, onde o .NET valida todo o contêiner de DI
/// na partida — uma dependência que não resolve derruba o teste, e não a primeira requisição.
/// </para>
/// </summary>
public sealed class ApiPipelineTests : IClassFixture<PostgresFixture>
{
    private readonly PostgresFixture _pg;

    public ApiPipelineTests(PostgresFixture pg) => _pg = pg;

    private WebApplicationFactory<Program> CreateApi(int authAttemptsPerMinute = 10, string? tmdbApiKey = null) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(web =>
        {
            web.UseSetting("ConnectionStrings:Default", _pg.ConnectionString);
            web.UseSetting("Jwt:Secret", new string('s', 48));
            web.UseSetting("Api:AuthAttemptsPerMinute", authAttemptsPerMinute.ToString(CultureInfo.InvariantCulture));
            if (tmdbApiKey is not null) web.UseSetting("Tmdb:ApiKey", tmdbApiKey);
        });

    [Fact]
    public async Task Health_responde_saudavel_com_o_banco_de_pe()
    {
        await using var api = CreateApi();
        var response = await api.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Contrato_OpenApi_e_publico()
    {
        await using var api = CreateApi();
        var response = await api.CreateClient().GetAsync("/openapi/v1.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Chave_do_TMDB_vinda_da_configuracao_chega_ao_cliente()
    {
        // É o caminho do `dotnet user-secrets`: a chave está na configuração, não numa variável de
        // ambiente. Antes, ela ligava o TMDB mas não chegava às opções, e o cliente estourava ao ser
        // criado — a busca de séries virava 500.
        await using var api = CreateApi(tmdbApiKey: "0123456789abcdef0123456789abcdef");

        Assert.NotNull(api.Services.GetRequiredService<ITmdbClient>());
    }

    [Fact]
    public async Task Rota_com_dados_de_alguem_exige_token()
    {
        await using var api = CreateApi();
        var response = await api.CreateClient().GetAsync("/series");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_para_de_aceitar_tentativas_ao_passar_do_limite()
    {
        await using var api = CreateApi(authAttemptsPerMinute: 3);
        var client = api.CreateClient();
        var body = new { identifier = "ninguem@exemplo.com", password = "senha-errada-123" };

        for (var i = 0; i < 3; i++)
        {
            var attempt = await client.PostAsJsonAsync("/auth/login", body);
            Assert.Equal(HttpStatusCode.Unauthorized, attempt.StatusCode);
        }

        var blocked = await client.PostAsJsonAsync("/auth/login", body);
        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);
        Assert.True(blocked.Headers.RetryAfter is not null, "429 sem Retry-After deixa o cliente tentando às cegas.");
    }

    [Fact]
    public async Task Refresh_fica_fora_do_limite_de_tentativas()
    {
        await using var api = CreateApi(authAttemptsPerMinute: 1);
        var client = api.CreateClient();

        await client.PostAsJsonAsync("/auth/login", new { identifier = "x@exemplo.com", password = "senha-errada-123" });
        var blocked = await client.PostAsJsonAsync("/auth/login", new { identifier = "x@exemplo.com", password = "senha-errada-123" });
        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);

        // Com a cota do login esgotada, a renovação de sessão continua respondendo normalmente.
        var refresh = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = "nao-existe" });
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
    }
}
