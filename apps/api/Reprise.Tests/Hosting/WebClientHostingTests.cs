using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Reprise.Tests.Hosting;

/// <summary>
/// A imagem do Reprise: a API servindo o build do cliente (wwwroot) e respondendo sob <c>/api</c>.
/// Nenhum destes testes toca no banco — a conexão configurada nunca é aberta.
/// </summary>
public sealed class WebClientHostingTests : IDisposable
{
    private readonly string _wwwroot = Path.Combine(Path.GetTempPath(), "reprise-wwwroot-" + Guid.NewGuid().ToString("N"));

    public WebClientHostingTests()
    {
        Directory.CreateDirectory(Path.Combine(_wwwroot, "assets"));
        File.WriteAllText(Path.Combine(_wwwroot, "index.html"), "<!doctype html><title>Reprise</title>");
        File.WriteAllText(Path.Combine(_wwwroot, "assets", "index-abc123.js"), "console.log(1)");
        File.WriteAllText(Path.Combine(_wwwroot, "sw.js"), "self.addEventListener('fetch', () => {})");
        File.WriteAllText(Path.Combine(_wwwroot, "manifest.webmanifest"), "{}");
    }

    public void Dispose() => Directory.Delete(_wwwroot, recursive: true);

    private WebApplicationFactory<Program> CreateApp(params (string Key, string Value)[] settings) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(web =>
        {
            web.UseSetting(WebHostDefaults.WebRootKey, _wwwroot);
            web.UseSetting("ConnectionStrings:Default", "Host=nao-usado;Database=nao-usado");
            web.UseSetting("Jwt:Secret", new string('s', 48));
            foreach (var (key, value) in settings) web.UseSetting(key, value);
        });

    [Fact]
    public async Task Raiz_entrega_o_cliente_sem_cache_e_com_os_cabecalhos_de_seguranca()
    {
        await using var app = CreateApp();
        var response = await app.CreateClient().GetAsync("/");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Contains("<title>Reprise</title>", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Rota_da_SPA_com_o_mesmo_nome_de_um_endpoint_e_do_cliente()
    {
        // /series/42 é rota do cliente E endpoint da API. Fora de /api, é sempre do cliente — se
        // vazasse para a API, recarregar a página da série daria 401 em vez da página.
        await using var app = CreateApp();
        var response = await app.CreateClient().GetAsync("/series/42");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task API_responde_sob_o_prefixo_sem_ele_chegar_aos_endpoints()
    {
        await using var app = CreateApp();
        var client = app.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/series")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/openapi/v1.json")).StatusCode);
    }

    [Fact]
    public async Task Arquivo_com_hash_tem_cache_longo_e_o_que_sumiu_e_404()
    {
        await using var app = CreateApp();
        var client = app.CreateClient();

        var asset = await client.GetAsync("/assets/index-abc123.js");
        Assert.Equal(HttpStatusCode.OK, asset.StatusCode);
        Assert.Contains("immutable", asset.Headers.CacheControl?.ToString());

        // O .js de uma versão anterior: 404, e não o index.html com cara de JavaScript.
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/assets/index-velho.js")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/nao-existe.png")).StatusCode);
    }

    [Fact]
    public async Task Service_worker_e_manifesto_sao_conferidos_a_cada_visita()
    {
        await using var app = CreateApp();
        var client = app.CreateClient();

        var sw = await client.GetAsync("/sw.js");
        Assert.Equal("no-cache", sw.Headers.CacheControl?.ToString());

        var manifest = await client.GetAsync("/manifest.webmanifest");
        Assert.Equal(HttpStatusCode.OK, manifest.StatusCode);
        Assert.Equal("application/manifest+json", manifest.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Cadeado_tranca_a_API_mas_nao_o_cliente_que_pede_a_chave()
    {
        await using var app = CreateApp(("Api:AccessToken", "chave-do-servidor"));
        var client = app.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/openapi/v1.json")).StatusCode);
    }

    [Fact]
    public async Task Asset_links_so_existem_com_a_impressao_do_certificado_configurada()
    {
        await using (var semImpressao = CreateApp())
        {
            var response = await semImpressao.CreateClient().GetAsync("/.well-known/assetlinks.json");
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        await using var app = CreateApp(("Android:CertFingerprints", "aa:bb:cc, DD:EE:FF"));
        var json = await app.CreateClient().GetStringAsync("/.well-known/assetlinks.json");

        var target = JsonDocument.Parse(json).RootElement[0].GetProperty("target");
        Assert.Equal("android_app", target.GetProperty("namespace").GetString());
        Assert.Equal("io.github.gabrielfsilveiradev.reprise", target.GetProperty("package_name").GetString());
        Assert.Equal(["AA:BB:CC", "DD:EE:FF"],
            target.GetProperty("sha256_cert_fingerprints").EnumerateArray().Select(e => e.GetString()));
    }
}
