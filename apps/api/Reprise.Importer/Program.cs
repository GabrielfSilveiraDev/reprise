using System.Security.Cryptography;
using Microsoft.Extensions.DependencyInjection;
using Reprise.Application;
using Reprise.Application.Import;
using Reprise.Importer;
using Reprise.Infrastructure;

// CLI de importação do export do TV Time. Idempotente e reexecutável.
//   reprise-import <caminho.zip|.csv> [--dry-run]

var positional = args.Where(a => !a.StartsWith("--", StringComparison.Ordinal)).ToArray();
var dryRun = args.Contains("--dry-run");

if (positional.Length == 0)
{
    Console.Error.WriteLine("Uso: reprise-import <caminho-do-export.zip|.csv> [--dry-run]");
    return 1;
}

var path = positional[0];
if (!File.Exists(path))
{
    Console.Error.WriteLine($"Arquivo não encontrado: {path}");
    return 1;
}

var conn = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
           ?? "Host=localhost;Port=5432;Database=reprise;Username=reprise;Password=reprise";

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
