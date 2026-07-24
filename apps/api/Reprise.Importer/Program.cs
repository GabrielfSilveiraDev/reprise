using System.Security.Cryptography;
using Microsoft.Extensions.DependencyInjection;
using Reprise.Application;
using Reprise.Application.Enrichment;
using Reprise.Application.Import;
using Reprise.Importer;
using Reprise.Infrastructure;

// CLI do Reprise. Idempotente e reexecutável nos dois modos.
//   reprise-import <caminho.zip|.csv> [--dry-run]      importa o export do TV Time
//   reprise-import enrich [--force] [--tvdb <id>]      casa as séries no TMDB e completa o catálogo

var positional = args.Where(a => !a.StartsWith("--", StringComparison.Ordinal)).ToArray();

if (positional.Length == 0)
{
    Console.Error.WriteLine("Uso: reprise-import <caminho-do-export.zip|.csv> [--dry-run]");
    Console.Error.WriteLine("     reprise-import enrich [--force] [--tvdb <id>]");
    return 1;
}

var conn = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
           ?? "Host=localhost;Port=5432;Database=reprise;Username=reprise;Password=reprise";

return positional[0].Equals("enrich", StringComparison.OrdinalIgnoreCase)
    ? await RunEnrichAsync(args, positional, conn)
    : await RunImportAsync(args, positional, conn);

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
