using Reprise.Api;
using Reprise.Api.Endpoints;
using Reprise.Api.Security;
using Reprise.Application;
using Reprise.Infrastructure;
using Reprise.Infrastructure.Persistence;
using Reprise.Infrastructure.Tmdb;

var builder = WebApplication.CreateBuilder(args);

var conn = builder.Configuration.GetConnectionString("Default")
           ?? Environment.GetEnvironmentVariable("ConnectionStrings__Default")
           ?? "Host=localhost;Port=5432;Database=reprise;Username=reprise;Password=reprise";

builder.Services.AddRepriseInfrastructure(conn);
builder.Services.AddRepriseApplication();

// O TMDB entra só quando há chave.
//
// É ele que alimenta a barra de pesquisa (séries novas, que nunca estiveram no export). Sem chave,
// o construtor do TmdbClient estoura — então em vez de registrá-lo e derrubar a API na primeira
// requisição, não registramos nada e as duas rotas que dependem dele respondem 503 dizendo o que
// falta. O resto do app (acervo, marcações, estatísticas) não toca no TMDB e continua inteiro.
var tmdbApiKey = builder.Configuration["Tmdb:ApiKey"] ?? Environment.GetEnvironmentVariable("Tmdb__ApiKey");
if (TmdbClient.IsUsableApiKey(tmdbApiKey))
{
    builder.Services.AddRepriseTmdb();

    // Só no host web: a CLI de importação roda e termina, então não tem pool de conexões para
    // manter vivo. Ver TmdbConnectionWarmer para o porquê dos 45 segundos.
    builder.Services.AddHostedService<TmdbConnectionWarmer>();

    // O catálogo das séries em produção se atualiza sozinho — sem isso a tela inicial não fica
    // sabendo de temporada nova nem do resumo do próximo episódio. Depende do TMDB, daí morar
    // dentro deste `if`; o TVmaze, que não tem chave, completa a agenda. Ver CatalogRefresh.
    builder.Services.AddRepriseTvmaze();
    builder.Services.AddRepriseCatalogRefresh();
    builder.Services.AddHostedService<CatalogRefreshWorker>();
}

// Depois da Infrastructure de propósito: substitui o ICurrentUser semente pelo que lê o JWT.
builder.Services.AddRepriseAuth(builder.Configuration);
builder.Services.AddOpenApi();
builder.Services.AddRepriseAuthRateLimit(builder.Configuration);

// Responde se a API alcança o banco. É o que um orquestrador (Compose, Kubernetes, um balanceador)
// pergunta antes de mandar tráfego — "o processo está de pé" não basta quando o Postgres caiu.
builder.Services.AddHealthChecks().AddDbContextCheck<RepriseDbContext>();

var app = builder.Build();

// Primeiro de tudo: quando `Api:AccessToken` está configurado, nada responde sem o token.
// Desligado por padrão. Continua existindo depois da autenticação porque resolve outra coisa:
// ele fecha a porta do prédio (nem a tela de login fica exposta num túnel público), enquanto o
// JWT diz quem é a pessoa lá dentro.
app.UseAccessTokenGate();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// OpenAPI em /openapi/v1.json — fonte dos tipos do cliente web (apps/web, `pnpm api:sync`).
app.MapOpenApi();

app.MapGet("/", () => Results.Ok(new { name = "Reprise API", openapi = "/openapi/v1.json" }));
app.MapHealthChecks("/health");

app.MapAuthEndpoints();

// Tudo o que toca dado de alguém exige token. O agrupamento existe para que acrescentar uma rota
// nova não dependa de lembrar de protegê-la: ela nasce dentro do grupo protegido.
var secured = app.MapGroup(string.Empty).RequireAuthorization();
secured.MapSeriesEndpoints();
secured.MapWatchingEndpoints();
secured.MapStatsEndpoints();
secured.MapProfileEndpoints();
secured.MapExportEndpoints();
secured.MapPremiereEndpoints();

app.Run();
