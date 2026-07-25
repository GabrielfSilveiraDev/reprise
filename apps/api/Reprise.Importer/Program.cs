using System.Security.Cryptography;
using Microsoft.Extensions.DependencyInjection;
using Reprise.Application;
using Reprise.Application.Enrichment;
using Microsoft.AspNetCore.Identity;
using Reprise.Application.Features.Watching;
using Reprise.Application.Import;
using Reprise.Importer;
using Reprise.Domain.Entities;
using Reprise.Infrastructure;

// CLI do Reprise. Idempotente e reexecutável nos dois modos.
//   reprise-import <caminho.zip|.csv> [--dry-run]      importa o export do TV Time
//   reprise-import enrich [--force] [--tvdb <id>]      casa as séries no TMDB e completa o catálogo
//   reprise-import backfill --series <id> [--season <n>] [--episodes <id,id>] [--dry-run]
//       recoloca exibições que aconteceram mas o export perdeu, com data inferida dos vizinhos
//   reprise-import passwd --email <e> --password <p> [--name <nome>] [--user <usuario>]
//       define a senha de uma conta (cria se não existir). É como o dono entra na própria conta
//       depois que a autenticação passou a existir.

var positional = args.Where(a => !a.StartsWith("--", StringComparison.Ordinal)).ToArray();

if (positional.Length == 0)
{
    Console.Error.WriteLine("Uso: reprise-import <caminho-do-export.zip|.csv> [--dry-run]");
    Console.Error.WriteLine("     reprise-import enrich [--force] [--tvdb <id>]");
    Console.Error.WriteLine("     reprise-import backfill --series <id> [--season <n>] [--episodes <id,id>] [--dry-run]");
    Console.Error.WriteLine("     reprise-import passwd --email <e> --password <p> [--name <nome>] [--user <usuario>]");
    return 1;
}

var conn = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
           ?? "Host=localhost;Port=5432;Database=reprise;Username=reprise;Password=reprise";

return positional[0].ToLowerInvariant() switch
{
    "enrich" => await RunEnrichAsync(args, positional, conn),
    "backfill" => await RunBackfillAsync(args, conn),
    "passwd" => await RunPasswdAsync(args, conn),
    _ => await RunImportAsync(args, positional, conn)
};

/// <summary>
/// Define a senha de uma conta, criando-a se necessário.
///
/// Existe porque a autenticação chegou depois dos dados: o usuário-semente é dono de dezenas de
/// milhares de exibições e nunca teve senha. Trocar isso pelo endpoint de cadastro criaria uma
/// conta NOVA, com id novo — e o histórico continuaria pendurado na antiga. Aqui a conta é a
/// mesma; só ganha credencial.
/// </summary>
static async Task<int> RunPasswdAsync(string[] args, string conn)
{
    static string? Flag(string[] a, string name)
    {
        var i = Array.IndexOf(a, name);
        return i >= 0 && i + 1 < a.Length ? a[i + 1] : null;
    }

    var email = Flag(args, "--email");
    var password = Flag(args, "--password");
    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
    {
        Console.Error.WriteLine("passwd exige --email e --password.");
        return 1;
    }

    var services = new ServiceCollection();
    services.AddLogging();
    services.AddRepriseInfrastructure(conn);
    services.AddRepriseIdentityCore();
    await using var provider = services.BuildServiceProvider();
    using var scope = provider.CreateScope();

    var users = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
    var user = await users.FindByEmailAsync(email);

    if (user is null)
    {
        user = new User
        {
            Id = Guid.CreateVersion7(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            DisplayName = Flag(args, "--name") ?? email.Split('@')[0],
            CreatedAt = DateTimeOffset.UtcNow
        };
        var created = await users.CreateAsync(user, password);
        if (!created.Succeeded)
        {
            Console.Error.WriteLine(string.Join(' ', created.Errors.Select(e => e.Description)));
            return 1;
        }
        Console.WriteLine($"Conta criada: {email} ({user.Id})");
        return 0;
    }

    // Conta existente: remove a senha antiga (se houver) e põe a nova. O token de reset seria
    // cerimônia inútil numa CLI que só roda na máquina do dono.
    if (await users.HasPasswordAsync(user)) await users.RemovePasswordAsync(user);
    var result = await users.AddPasswordAsync(user, password);
    if (!result.Succeeded)
    {
        Console.Error.WriteLine(string.Join(' ', result.Errors.Select(e => e.Description)));
        return 1;
    }

    var mudou = false;
    if (Flag(args, "--name") is { Length: > 0 } nome)
    {
        user.DisplayName = nome;
        mudou = true;
    }
    if (Flag(args, "--user") is { Length: > 0 } login)
    {
        // O nome de usuário é a outra forma de entrar (o login aceita e-mail ou usuário), então
        // precisa do normalizado junto — é por ele que o Identity procura.
        user.UserName = login;
        user.NormalizedUserName = users.NormalizeName(login);
        mudou = true;
    }
    if (mudou) await users.UpdateAsync(user);

    Console.WriteLine($"Senha definida para {email} ({user.Id}).");
    return 0;
}

/// <summary>
/// Recoloca exibições perdidas pelo export. Existe como comando, e não como SQL avulso, porque
/// a operação se repete: toda vez que um buraco do export aparece, a pergunta "que data usar?"
/// volta — e a resposta (interpolar entre os vizinhos, marcar como backfill) tem de ser a mesma.
/// </summary>
static async Task<int> RunBackfillAsync(string[] args, string conn)
{
    static string? Flag(string[] a, string name)
    {
        var i = Array.IndexOf(a, name);
        return i >= 0 && i + 1 < a.Length ? a[i + 1] : null;
    }

    if (!long.TryParse(Flag(args, "--series"), out var seriesId))
    {
        Console.Error.WriteLine("--series exige o id numérico da série.");
        return 1;
    }

    int? season = int.TryParse(Flag(args, "--season"), out var sn) ? sn : null;
    var episodeIds = Flag(args, "--episodes")?
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(long.Parse).ToList();

    var services = new ServiceCollection();
    services.AddRepriseInfrastructure(conn);
    services.AddRepriseApplication();
    await using var provider = services.BuildServiceProvider();
    using var scope = provider.CreateScope();

    var service = scope.ServiceProvider.GetRequiredService<BackfillService>();
    var plan = await service.PlanAsync(seriesId, season, episodeIds);

    if (plan is null)
    {
        Console.Error.WriteLine($"Série {seriesId} não encontrada.");
        return 1;
    }

    Console.WriteLine($"{plan.SeriesName}: {plan.Events.Count} episódio(s) sem exibição.");
    if (plan.Events.Count == 0) return 0;

    Console.WriteLine($"  janela inferida: {plan.From:yyyy-MM-dd} → {plan.To:yyyy-MM-dd}");
    foreach (var (_, s, e, when) in plan.Events.Take(4))
        Console.WriteLine($"    T{s}E{e,-3} {when:yyyy-MM-dd HH:mm}");
    if (plan.Events.Count > 4) Console.WriteLine($"    … e mais {plan.Events.Count - 4}");

    if (args.Contains("--dry-run"))
    {
        Console.WriteLine("--dry-run: nada gravado.");
        return 0;
    }

    var created = await service.ApplyAsync(plan);
    Console.WriteLine($"  {created} exibição(ões) criada(s), marcadas como backfill.");
    return 0;
}

static async Task<int> RunImportAsync(string[] args, string[] positional, string conn)
{
    var dryRun = args.Contains("--dry-run");
    var path = positional[0];
    if (!File.Exists(path))
    {
        Console.Error.WriteLine($"Arquivo não encontrado: {path}");
        return 1;
    }

    var reader = new TvTimeExportReader();
    Console.WriteLine($"Lendo export: {path}");
    var records = reader.ReadPath(path);
    Console.WriteLine($"  {records.Count} linhas lidas.");

    var services = new ServiceCollection();
    services.AddRepriseInfrastructure(conn);
    services.AddRepriseApplication();
    await using var provider = services.BuildServiceProvider();
    using var scope = provider.CreateScope();

    if (dryRun)
    {
        var planner = scope.ServiceProvider.GetRequiredService<ImportPlanner>();
        var plan = planner.Plan(records);
        ImportReportPrinter.Print(Console.Out, plan, null);
        return plan.Reconciliation.HardInvariantsPassed ? 0 : 2;
    }

    var sha = Convert.ToHexString(SHA256.HashData(await File.ReadAllBytesAsync(path))).ToLowerInvariant();
    var importer = scope.ServiceProvider.GetRequiredService<ImportService>();
    var result = await importer.ImportAsync(records, sha);

    ImportReportPrinter.Print(Console.Out, result.Plan, result);
    return result.Reconciliation.HardInvariantsPassed ? 0 : 2;
}

static async Task<int> RunEnrichAsync(string[] args, string[] positional, string conn)
{
    var force = args.Contains("--force");

    int? onlyTvdb = null;
    var tvdbFlag = Array.IndexOf(args, "--tvdb");
    if (tvdbFlag >= 0)
    {
        if (tvdbFlag + 1 >= args.Length || !int.TryParse(args[tvdbFlag + 1], out var parsed))
        {
            Console.Error.WriteLine("--tvdb exige um id numérico.");
            return 1;
        }
        onlyTvdb = parsed;
    }

    if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("Tmdb__ApiKey")))
    {
        Console.Error.WriteLine("Variável de ambiente Tmdb__ApiKey não definida.");
        return 1;
    }

    var services = new ServiceCollection();
    services.AddRepriseInfrastructure(conn);
    services.AddRepriseApplication();
    services.AddRepriseTmdb();
    await using var provider = services.BuildServiceProvider();
    using var scope = provider.CreateScope();

    var service = scope.ServiceProvider.GetRequiredService<SeriesEnrichmentService>();

    var done = 0;
    var progress = new Progress<string>(name => Console.WriteLine($"  [{++done,3}] {name}"));

    Console.WriteLine(force
        ? "Enriquecendo TODAS as séries (--force)…"
        : "Enriquecendo as séries ainda sem metadados…");

    var report = await service.EnrichAsync(force, onlyTvdb, progress);
    EnrichmentReportPrinter.Print(Console.Out, report);

    return report.NeedsAttention ? 3 : 0; // 3 = concluiu, mas há séries a resolver manualmente
}
