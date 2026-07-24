using Reprise.Api.Endpoints;
using Reprise.Application;
using Reprise.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

var conn = builder.Configuration.GetConnectionString("Default")
           ?? Environment.GetEnvironmentVariable("ConnectionStrings__Default")
           ?? "Host=localhost;Port=5432;Database=reprise;Username=reprise;Password=reprise";

builder.Services.AddRepriseInfrastructure(conn);
builder.Services.AddRepriseApplication();
builder.Services.AddOpenApi();

var app = builder.Build();

// OpenAPI em /openapi/v1.json — fonte do cliente TypeScript gerado (packages/shared).
app.MapOpenApi();

app.MapGet("/", () => Results.Ok(new { name = "Reprise API", openapi = "/openapi/v1.json" }));

app.MapSeriesEndpoints();
app.MapWatchingEndpoints();

// Auth (ASP.NET Identity + JWT) entra como fatia dedicada na Fase 3, quando o cliente web precisar de login.
// Por ora, ICurrentUser resolve para o usuário-semente (single-user local).

app.Run();
