using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Reprise.Application;
using Reprise.Application.Enrichment;
using Microsoft.AspNetCore.Identity;
using Reprise.Application.Features.Watching;
using Reprise.Application.Import;
using Reprise.Importer;
using Reprise.Domain.Entities;
using Reprise.Application.Abstractions;
using Reprise.Infrastructure;
using Reprise.Infrastructure.Persistence;
using Reprise.Infrastructure.Tvmaze;

// CLI do Reprise. Idempotente e reexecutável nos dois modos.
//   reprise-import migrate                             cria o banco ou aplica as migrações pendentes
//   reprise-import <caminho.zip|.csv> [--dry-run]      importa o export do TV Time
//   reprise-import enrich [--force] [--tvdb <id>]      casa as séries no TMDB e completa o catálogo
//   reprise-import backfill --series <id> [--season <n>] [--episodes <id,id>] [--dry-run]
//       recoloca exibições que aconteceram mas o export perdeu, com data inferida dos vizinhos
//   reprise-import passwd --email <e> --password <p> [--name <nome>] [--user <usuario>]
//       define a senha de uma conta (cria se não existir). É como o dono entra na própria conta
//       depois que a autenticação passou a existir.
//   reprise-import paises [--force]
//       preenche o país de origem das séries — é o que diz em que fuso a data de estreia vale
//   reprise-import agenda [--force] [--mudou <day|week|month>]
//       traz do TVmaze a data e o horário de estreia de cada episódio
//   reprise-import resumos [--force]
//       preenche a sinopse dos episódios pelo TMDB, sem reprocessar o catálogo

var positional = args.Where(a => !a.StartsWith("--", StringComparison.Ordinal)).ToArray();

if (positional.Length == 0)
{
    Console.Error.WriteLine("Uso: reprise-import <caminho-do-export.zip|.csv> [--dry-run]");
    Console.Error.WriteLine("     reprise-import migrate");
    Console.Error.WriteLine("     reprise-import enrich [--force] [--tvdb <id>]");
    Console.Error.WriteLine("     reprise-import backfill --series <id> [--season <n>] [--episodes <id,id>] [--dry-run]");
    Console.Error.WriteLine("     reprise-import passwd --email <e> --password <p> [--name <nome>] [--user <usuario>]");
    Console.Error.WriteLine("     reprise-import paises [--force]");
    Console.Error.WriteLine("     reprise-import agenda [--force] [--mudou <day|week|month>]");
    Console.Error.WriteLine("     reprise-import resumos [--force]");
    return 1;
}

var conn = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
           ?? "Host=localhost;Port=5432;Database=reprise;Username=reprise;Password=reprise";

return positional[0].ToLowerInvariant() switch
{
    "migrate" => await RunMigrateAsync(conn),
    "enrich" => await RunEnrichAsync(args, positional, conn),
    "backfill" => await RunBackfillAsync(args, conn),
    "passwd" => await RunPasswdAsync(args, conn),
    "paises" => await RunOriginCountryAsync(args, conn),
    "agenda" => await RunTvmazeAsync(args, conn),
    "resumos" => await RunOverviewsAsync(args, conn),
    _ => await RunImportAsync(args, positional, conn)
};

/// <summary>
/// Cria o banco, ou leva o que já existe até a última migração.
///
/// <para>
/// A API não migra o banco na partida, e é melhor assim: com mais de uma réplica, todas tentariam migrar ao mesmo
/// tempo, e uma migração que falha no meio da partida deixa a API fora do ar sem dizer por quê.
/// Migrar é um passo explícito — é este comando que o serviço <c>migrate</c> do docker-compose roda
/// antes de a API subir. Faz o mesmo que <c>dotnet ef database update</c>, sem exigir a ferramenta
/// do EF instalada nem o SDK: a imagem da CLI só tem o runtime.
/// </para>
/// </summary>
static async Task<int> RunMigrateAsync(string conn)
{
    var services = new ServiceCollection();
    services.AddRepriseInfrastructure(conn);
    await using var provider = services.BuildServiceProvider();
    using var scope = provider.CreateScope();

    var db = scope.ServiceProvider.GetRequiredService<RepriseDbContext>();
    var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
    if (pending.Count == 0)
    {
        Console.WriteLine("Banco em dia: nenhuma migração pendente.");
        return 0;
    }

    Console.WriteLine($"Aplicando {pending.Count} migração(ões):");
    foreach (var name in pending) Console.WriteLine($"  {name}");
    await db.Database.MigrateAsync();
    Console.WriteLine("Banco em dia.");
    return 0;
}

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


/// <summary>
/// Preenche <c>series.origin_country</c> a partir do TMDB.
///
/// <para>
/// Existe como comando próprio, e não como parte do <c>enrich</c>, por uma questão de proporção:
/// o enriquecimento reprocessa o catálogo inteiro — episódios, temporadas, runtimes, nomes —, e
/// aqui a necessidade é preencher UMA coluna que nasceu depois dos dados. Rodar <c>enrich
/// --force</c> para isso mexeria em milhares de linhas para atualizar 118 campos.
/// </para>
///
/// <para>
/// O país é o que permite saber <b>quando</b> um episódio sai: a <c>air_date</c> do TMDB não tem
/// hora nem fuso, e sem o país não dá para distinguir uma estreia japonesa de uma americana no
/// mesmo dia do calendário. Ver <c>ReleaseSchedule</c>. Sem esta coluna tudo cai no padrão
/// conservador (Pacífico americano), que acerta a maioria do acervo e atrasa o resto.
/// </para>
/// </summary>
static async Task<int> RunOriginCountryAsync(string[] args, string conn)
{
    if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("Tmdb__ApiKey")))
    {
        Console.Error.WriteLine("Variável de ambiente Tmdb__ApiKey não definida.");
        return 1;
    }

    var force = args.Contains("--force");

    var services = new ServiceCollection();
    services.AddRepriseInfrastructure(conn);
    services.AddRepriseApplication();
    services.AddRepriseTmdb();
    await using var provider = services.BuildServiceProvider();
    using var scope = provider.CreateScope();

    var db = scope.ServiceProvider.GetRequiredService<RepriseDbContext>();
    var tmdb = scope.ServiceProvider.GetRequiredService<ITmdbClient>();

    // Sem --force, só quem ainda não tem: reexecutar depois de acrescentar séries custa poucas
    // chamadas em vez de 118.
    var alvos = await db.Series
        .Where(s => s.TmdbId != null && (force || s.OriginCountry == null))
        .OrderBy(s => s.Name)
        .ToListAsync();

    Console.WriteLine($"Séries a consultar: {alvos.Count}");

    var preenchidas = 0;
    var semPais = new List<string>();
    var falharam = new List<string>();

    foreach (var s in alvos)
    {
        // Um id morto não pode derrubar o lote. Acontece de verdade: série que o TMDB fundiu ou
        // removeu devolve 404, e abortar aqui jogaria fora as outras 115 consultas já pagas.
        TmdbShow? show;
        try
        {
            show = await tmdb.GetShowAsync(s.TmdbId!.Value);
        }
        catch (Exception ex)
        {
            falharam.Add($"{s.Name} (tmdb {s.TmdbId}): {ex.GetType().Name}");
            continue;
        }

        if (show?.OriginCountry is { Length: > 0 } pais)
        {
            s.OriginCountry = pais;
            preenchidas++;
        }
        else
        {
            // Não é erro: o TMDB tem séries sem país declarado. Elas caem no padrão conservador.
            semPais.Add(s.Name);
        }
    }

    await db.SaveChangesAsync();

    Console.WriteLine($"Preenchidas: {preenchidas}");
    if (semPais.Count > 0)
    {
        Console.WriteLine($"Sem país no TMDB ({semPais.Count}) — ficam no padrão conservador:");
        foreach (var nome in semPais) Console.WriteLine($"  - {nome}");
    }
    if (falharam.Count > 0)
    {
        Console.WriteLine($"Não consultadas ({falharam.Count}) — ficam no padrão conservador:");
        foreach (var linha in falharam) Console.WriteLine($"  - {linha}");
    }

    var porPais = await db.Series
        .Where(s => s.OriginCountry != null)
        .GroupBy(s => s.OriginCountry!)
        .Select(g => new { Pais = g.Key, Total = g.Count() })
        .OrderByDescending(x => x.Total)
        .ToListAsync();

    Console.WriteLine("Distribuição:");
    foreach (var linha in porPais) Console.WriteLine($"  {linha.Pais}: {linha.Total}");

    return 0;
}


/// <summary>
/// Sincroniza a agenda de estreias com o TVmaze.
///
/// <para>
/// <b>Não precisa de chave.</b> Ao contrário do <c>enrich</c>, que depende do TMDB, este comando
/// roda numa instalação recém-clonada — o que importa, porque é dele que sai a correção de
/// "estreou hoje" para episódio que só sai amanhã.
/// </para>
///
/// <para>
/// <c>--mudou</c> é o modo de manutenção: em vez de varrer o acervo, pergunta ao TVmaze o que
/// mudou na janela e reconsulta só isso. É o que vale rodar periodicamente.
/// </para>
/// </summary>
static async Task<int> RunTvmazeAsync(string[] args, string conn)
{
    static string? Flag(string[] a, string name)
    {
        var i = Array.IndexOf(a, name);
        return i >= 0 && i + 1 < a.Length ? a[i + 1] : null;
    }

    var force = args.Contains("--force");
    var mudou = Flag(args, "--mudou");

    if (mudou is not null && mudou is not ("day" or "week" or "month"))
    {
        Console.Error.WriteLine("--mudou aceita day, week ou month.");
        return 1;
    }

    var services = new ServiceCollection();
    services.AddRepriseInfrastructure(conn);
    services.AddRepriseApplication();
    services.AddRepriseTvmaze();
    await using var provider = services.BuildServiceProvider();
    using var scope = provider.CreateScope();

    var sync = scope.ServiceProvider.GetRequiredService<TvmazeScheduleSync>();

    var feitas = 0;
    var progresso = new Progress<string>(nome => Console.WriteLine($"  [{++feitas,3}] {nome}"));

    Console.WriteLine(mudou is not null
        ? $"Sincronizando as séries alteradas no TVmaze (janela: {mudou})…"
        : force
            ? "Sincronizando TODAS as séries com o TVmaze (--force)…"
            : "Sincronizando as séries ainda sem id do TVmaze…");

    var r = await sync.SyncAsync(force, mudou, progresso);

    Console.WriteLine();
    Console.WriteLine($"Séries consideradas ....... {r.SeriesConsidered}");
    Console.WriteLine($"Casadas no TVmaze ......... {r.SeriesMatched}");
    Console.WriteLine($"Episódios com data ........ {r.EpisodesDated}");
    Console.WriteLine($"  com horário exato ....... {r.EpisodesWithExactTime}  (TV linear)");
    Console.WriteLine($"  data diferente do TMDB .. {r.DatesDifferentFromTmdb}");

    if (r.Divergences.Count > 0)
    {
        Console.WriteLine();
        Console.WriteLine("Onde as fontes discordam (o TVmaze manda):");
        foreach (var d in r.Divergences) Console.WriteLine($"  - {d}");
    }

    if (r.Misses.Count > 0)
    {
        Console.WriteLine();
        Console.WriteLine($"Sem agenda do TVmaze ({r.Misses.Count}) — continuam pelo TMDB:");
        foreach (var m in r.Misses) Console.WriteLine($"  - {m.SeriesName}: {m.Reason}");
    }

    return 0;
}


/// <summary>
/// Preenche a sinopse dos episódios pelo TMDB.
///
/// <para>
/// Mesmo raciocínio de <c>paises</c>: o campo nasceu depois dos dados, e o <c>enrich --force</c>
/// resolveria — mas reprocessando o catálogo inteiro, inclusive o realinhamento de temporadas,
/// para preencher uma coluna. Aqui só a sinopse é escrita; posição, nome, runtime e datas ficam
/// intocados.
/// </para>
///
/// <para>
/// O <c>enrich</c> continua preenchendo a sinopse dos episódios que ele criar daqui para a frente
/// — ela passou a andar junto com o nome e a imagem no plano de merge. Este comando existe para o
/// que já estava no banco antes disso.
/// </para>
/// </summary>
static async Task<int> RunOverviewsAsync(string[] args, string conn)
{
    if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("Tmdb__ApiKey")))
    {
        Console.Error.WriteLine("Variável de ambiente Tmdb__ApiKey não definida.");
        return 1;
    }

    var force = args.Contains("--force");

    var services = new ServiceCollection();
    services.AddRepriseInfrastructure(conn);
    services.AddRepriseApplication();
    services.AddRepriseTmdb();
    await using var provider = services.BuildServiceProvider();
    using var scope = provider.CreateScope();

    var db = scope.ServiceProvider.GetRequiredService<RepriseDbContext>();
    var tmdb = scope.ServiceProvider.GetRequiredService<ITmdbClient>();

    var series = await db.Series
        .Where(s => s.TmdbId != null)
        .OrderBy(s => s.Name)
        .ToListAsync();

    // Sem --force, pula série que já tem sinopse em todo episódio: reexecutar depois de
    // acrescentar séries custa poucas chamadas em vez de uma por série do acervo.
    if (!force)
    {
        var comPendencia = await db.Episodes
            .Where(e => e.Overview == null)
            .Select(e => e.SeriesId)
            .Distinct()
            .ToListAsync();

        var pendentes = comPendencia.ToHashSet();
        series = series.Where(s => pendentes.Contains(s.Id)).ToList();
    }

    Console.WriteLine($"Séries a consultar: {series.Count}");

    var preenchidos = 0;
    var feitas = 0;
    var falharam = new List<string>();

    foreach (var s in series)
    {
        Console.WriteLine($"  [{++feitas,3}] {s.Name}");

        IReadOnlyList<TmdbEpisode> remotos;
        try
        {
            remotos = await tmdb.GetEpisodesAsync(s.TmdbId!.Value);
        }
        catch (Exception ex)
        {
            // Um id morto no TMDB não pode derrubar o lote — já aconteceu com o comando `paises`.
            falharam.Add($"{s.Name} (tmdb {s.TmdbId}): {ex.GetType().Name}");
            continue;
        }

        var porPosicao = remotos
            .Where(r => !string.IsNullOrWhiteSpace(r.Overview))
            .GroupBy(r => (r.SeasonNumber, r.EpisodeNumber))
            .ToDictionary(g => g.Key, g => g.First().Overview);

        var locais = await db.Episodes.Where(e => e.SeriesId == s.Id).ToListAsync();
        foreach (var local in locais)
        {
            if (!force && local.Overview is not null) continue;
            if (!porPosicao.TryGetValue((local.SeasonNumber, local.EpisodeNumber), out var texto)) continue;

            local.Overview = texto;
            preenchidos++;
        }

        // Grava por série: uma falha no meio de cem séries não deve devolver tudo ao começo.
        await db.SaveChangesAsync();
    }

    var total = await db.Episodes.CountAsync();
    var comResumo = await db.Episodes.CountAsync(e => e.Overview != null);

    Console.WriteLine();
    Console.WriteLine($"Sinopses preenchidas nesta execução: {preenchidos}");
    Console.WriteLine($"Cobertura: {comResumo} de {total} episódios ({100.0 * comResumo / Math.Max(1, total):F1}%)");

    if (falharam.Count > 0)
    {
        Console.WriteLine();
        Console.WriteLine($"Não consultadas ({falharam.Count}):");
        foreach (var linha in falharam) Console.WriteLine($"  - {linha}");
    }

    return 0;
}
