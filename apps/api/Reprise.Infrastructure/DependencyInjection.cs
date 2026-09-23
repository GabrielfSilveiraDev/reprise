using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Reprise.Domain.Entities;
using Reprise.Application.Abstractions;
using Reprise.Application.Enrichment;
using Reprise.Application.Features.Series;
using Reprise.Application.Features.Stats;
using Reprise.Infrastructure.Persistence;
using Reprise.Infrastructure.Tmdb;
using Reprise.Infrastructure.Tvmaze;

namespace Reprise.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddRepriseInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<RepriseDbContext>(options =>
            options.UseNpgsql(connectionString).UseSnakeCaseNamingConvention());

        services.AddScoped<IRepriseDbContext>(sp => sp.GetRequiredService<RepriseDbContext>());

        // Padrão para quem não tem HTTP: a CLI de importação e o design-time do EF.
        // A API sobrescreve isto por AddRepriseAuth, que lê o sub do JWT.
        services.AddScoped<ICurrentUser, SeedCurrentUser>();

        // Estatística é SQL cru sobre o DbContext — por isso mora na Infrastructure.
        services.AddScoped<IStatsQueries, StatsQueries>();

        return services;
    }

    /// <summary>
    /// Só o núcleo do Identity: <see cref="UserManager{TUser}"/> e o hash de senha, sem nada de
    /// HTTP. Existe para a CLI poder criar conta e definir senha sem levantar um servidor —
    /// a API usa <c>AddRepriseAuth</c>, que acrescenta JWT e o tenant vindo do token.
    /// </summary>
    public static IdentityBuilder AddRepriseIdentityCore(this IServiceCollection services)
        => services.AddIdentityCore<User>(o =>
            {
                o.User.RequireUniqueEmail = true;
                // Comprimento faz mais pelo custo de quebra do que exigir símbolo, e exigir
                // símbolo empurra as pessoas para senhas curtas e decoradas. 10 caracteres.
                //
                // Esta política vive AQUI e em nenhum outro lugar: a CLI e a API a compartilham,
                // porque duas cópias de uma regra de senha divergem no primeiro ajuste — e aí a
                // CLI aceita o que a API recusa, ou pior, o contrário.
                o.Password.RequiredLength = 10;
                o.Password.RequireNonAlphanumeric = false;
                o.Password.RequireUppercase = false;
                o.Password.RequireDigit = false;
            })
            // Sem AddDefaultTokenProviders: eles vivem no pacote de Identity do ASP.NET, que esta
            // camada não referencia — e a CLI não gera código de validação. Ela roda na máquina do
            // dono e cria contas já confirmadas; quem valida e-mail é a API.
            .AddEntityFrameworkStores<RepriseDbContext>();

    /// <summary>
    /// Registra o cliente do TMDB. Fica separado de <see cref="AddRepriseInfrastructure"/> de propósito:
    /// a API e o importador funcionam sem chave nenhuma — só o enriquecimento precisa dela, e falhar
    /// na inicialização por causa de um passo opcional seria um mau negócio.
    /// </summary>
    public static IServiceCollection AddRepriseTmdb(
        this IServiceCollection services, Action<TmdbOptions>? configure = null)
    {
        services.Configure<TmdbOptions>(o =>
        {
            o.ApiKey = Environment.GetEnvironmentVariable("Tmdb__ApiKey") ?? o.ApiKey;
            if (Environment.GetEnvironmentVariable("Tmdb__Language") is { Length: > 0 } lang) o.Language = lang;
            configure?.Invoke(o);
        });

        // O TmdbClient guarda as respostas de busca aqui. `AddMemoryCache` é idempotente.
        services.AddMemoryCache();
        services.AddSingleton<ITmdbClient, TmdbClient>();
        services.AddScoped<SeriesEnrichmentService>();
        // A busca de séries novas também depende do TMDB, então segue a mesma sorte: existe quando
        // há chave configurada, e não existe quando não há.
        services.AddScoped<SeriesCatalogService>();
        return services;
    }

    /// <summary>
    /// Registra o cliente do TVmaze e a sincronização de agenda.
    ///
    /// <para>
    /// Separado do TMDB de propósito: são fontes independentes, e o TVmaze <b>não exige chave</b>.
    /// Prendê-lo ao <c>AddRepriseTmdb</c> faria a agenda depender de um segredo que ela não usa —
    /// quem não configurou o TMDB continuaria sem datas corretas sem motivo nenhum.
    /// </para>
    /// </summary>
    public static IServiceCollection AddRepriseTvmaze(this IServiceCollection services)
    {
        services.AddHttpClient<ITvmazeClient, TvmazeClient>(http =>
        {
            http.BaseAddress = new Uri("https://api.tvmaze.com/");
            http.Timeout = TimeSpan.FromSeconds(30);
            // A API é pública e pede identificação de quem chama.
            http.DefaultRequestHeaders.UserAgent.ParseAdd("Reprise/0.1 (rastreador pessoal de series)");
        });

        services.AddScoped<TvmazeScheduleSync>();
        return services;
    }
}

