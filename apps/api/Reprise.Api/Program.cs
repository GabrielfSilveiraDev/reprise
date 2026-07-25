using Reprise.Api.Endpoints;
using Reprise.Api.Security;
using Reprise.Application;
using Reprise.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

var conn = builder.Configuration.GetConnectionString("Default")
           ?? Environment.GetEnvironmentVariable("ConnectionStrings__Default")
           ?? "Host=localhost;Port=5432;Database=reprise;Username=reprise;Password=reprise";

builder.Services.AddRepriseInfrastructure(conn);
builder.Services.AddRepriseApplication();
// Depois da Infrastructure de propósito: substitui o ICurrentUser semente pelo que lê o JWT.
builder.Services.AddRepriseAuth(builder.Configuration);
builder.Services.AddOpenApi();

var app = builder.Build();

// Primeiro de tudo: quando `Api:AccessToken` está configurado, nada responde sem o token.
// Desligado por padrão. Continua existindo depois da autenticação porque resolve outra coisa:
// ele fecha a porta do prédio (nem a tela de login fica exposta num túnel público), enquanto o
// JWT diz quem é a pessoa lá dentro.
app.UseAccessTokenGate();

app.UseAuthentication();
app.UseAuthorization();

// OpenAPI em /openapi/v1.json — fonte do cliente TypeScript gerado (packages/shared).
app.MapOpenApi();

app.MapGet("/", () => Results.Ok(new { name = "Reprise API", openapi = "/openapi/v1.json" }));

app.MapAuthEndpoints();

// Tudo o que toca dado de alguém exige token. O agrupamento existe para que acrescentar uma rota
// nova não dependa de lembrar de protegê-la: ela nasce dentro do grupo protegido.
var secured = app.MapGroup(string.Empty).RequireAuthorization();
secured.MapSeriesEndpoints();
secured.MapWatchingEndpoints();
secured.MapStatsEndpoints();
secured.MapProfileEndpoints();

app.Run();
