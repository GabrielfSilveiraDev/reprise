using Microsoft.EntityFrameworkCore;

namespace Reprise.Infrastructure.Persistence;

/// <summary>
/// Leva o banco até a última migração. A CLI (<c>migrate</c>) e a API (quando
/// <c>Database:MigrateOnStartup</c> está ligado) passam pelo mesmo caminho.
/// </summary>
public sealed class DatabaseMigrator
{
    private readonly RepriseDbContext _db;

    public DatabaseMigrator(RepriseDbContext db) => _db = db;

    /// <summary>Aplica o que falta e devolve os nomes das migrações aplicadas (vazio = já estava em dia).</summary>
    public async Task<IReadOnlyList<string>> MigrateAsync(CancellationToken ct = default)
    {
        var pending = (await _db.Database.GetPendingMigrationsAsync(ct)).ToList();
        if (pending.Count > 0) await _db.Database.MigrateAsync(ct);
        return pending;
    }
}
