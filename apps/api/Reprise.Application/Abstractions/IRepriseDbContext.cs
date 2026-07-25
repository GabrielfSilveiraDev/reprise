using Microsoft.EntityFrameworkCore;
using Reprise.Domain.Entities;

namespace Reprise.Application.Abstractions;

/// <summary>
/// O DbContext exposto como interface para a camada Application usá-lo sem referenciar a Infrastructure
/// (mantém o Clean layering). Não é um repositório genérico: é o próprio Unit of Work do EF,
/// com os <see cref="DbSet{TEntity}"/> reais — nenhuma capacidade do EF fica escondida.
/// </summary>
public interface IRepriseDbContext
{
    DbSet<User> Users { get; }
    DbSet<Series> Series { get; }
    DbSet<Season> Seasons { get; }
    DbSet<Episode> Episodes { get; }
    DbSet<TrackedSeries> TrackedSeries { get; }
    DbSet<WatchEvent> WatchEvents { get; }
    DbSet<ImportRun> ImportRuns { get; }
    DbSet<SeriesMatchOverride> SeriesMatchOverrides { get; }
    DbSet<ProcessedAction> ProcessedActions { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
