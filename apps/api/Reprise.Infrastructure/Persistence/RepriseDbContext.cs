using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Domain.Entities;

namespace Reprise.Infrastructure.Persistence;

/// <summary>
/// O contexto herda de <see cref="IdentityDbContext{TUser,TRole,TKey}"/> para que o ASP.NET
/// Identity governe a autenticação — mas <c>users</c> continua sendo a MESMA tabela de sempre,
/// com os mesmos ids. É o que mantém o histórico ligado ao seu dono.
/// </summary>
public class RepriseDbContext
    : IdentityDbContext<User, IdentityRole<Guid>, Guid>, IRepriseDbContext
{
    private readonly ICurrentUser _currentUser;

    /// <summary>Usuário-semente (single-user). A fundação já é multi-tenant; este é o tenant atual.</summary>
    public static readonly Guid SeedUserId = new("00000000-0000-0000-0000-000000000001");

    public RepriseDbContext(DbContextOptions<RepriseDbContext> options, ICurrentUser currentUser)
        : base(options)
    {
        _currentUser = currentUser;
    }

    // `Users` já vem do IdentityDbContext; não redeclarar.
    public DbSet<Series> Series => Set<Series>();
    public DbSet<Season> Seasons => Set<Season>();
    public DbSet<Episode> Episodes => Set<Episode>();
    public DbSet<TrackedSeries> TrackedSeries => Set<TrackedSeries>();
    public DbSet<WatchEvent> WatchEvents => Set<WatchEvent>();
    public DbSet<ImportRun> ImportRuns => Set<ImportRun>();
    public DbSet<SeriesMatchOverride> SeriesMatchOverrides => Set<SeriesMatchOverride>();
    public DbSet<ProcessedAction> ProcessedActions => Set<ProcessedAction>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    // Referenciado pelos filtros globais de tenant; reavaliado a cada query.
    private Guid CurrentUserId => _currentUser.UserId;

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<User>(e =>
        {
            // A tabela continua `users`: o Identity nomearia `asp_net_users`, e renomear
            // desconectaria o tenant de tudo o que já aponta para cá.
            e.ToTable("users");
            e.Property(x => x.DisplayName).HasMaxLength(200);
        });

        // As demais tabelas do Identity ganham nomes no estilo do resto do schema.
        b.Entity<IdentityRole<Guid>>().ToTable("roles");
        b.Entity<IdentityUserRole<Guid>>().ToTable("user_roles");
        b.Entity<IdentityUserClaim<Guid>>().ToTable("user_claims");
        b.Entity<IdentityUserLogin<Guid>>().ToTable("user_logins");
        b.Entity<IdentityUserToken<Guid>>().ToTable("user_tokens");
        b.Entity<IdentityRoleClaim<Guid>>().ToTable("role_claims");

        b.Entity<RefreshToken>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
            e.Property(x => x.Device).HasMaxLength(200);
            e.HasOne(x => x.User).WithMany(u => u.RefreshTokens)
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            // A busca na renovação é pelo hash; único porque dois tokens iguais seria colisão
            // de 32 bytes aleatórios — se acontecer, é bug, e o índice avisa.
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasIndex(x => new { x.UserId, x.ExpiresAt });
        });

        b.Entity<Series>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(500).IsRequired();
            e.HasIndex(x => x.TvdbId).IsUnique().HasFilter(null);   // catálogo global; casamento pelo TheTVDB
            e.HasIndex(x => x.TmdbId).IsUnique();
        });

        b.Entity<Season>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Series).WithMany(s => s.Seasons).HasForeignKey(x => x.SeriesId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.SeriesId, x.SeasonNumber }).IsUnique();
        });

        b.Entity<Episode>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Series).WithMany(s => s.Episodes).HasForeignKey(x => x.SeriesId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Season).WithMany(s => s.Episodes).HasForeignKey(x => x.SeasonId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.StillPath).HasMaxLength(200);
            e.HasIndex(x => new { x.SeriesId, x.SeasonNumber, x.EpisodeNumber }).IsUnique();
            e.HasIndex(x => x.IsSpecial);
        });

        b.Entity<TrackedSeries>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.HasOne(x => x.Series).WithMany().HasForeignKey(x => x.SeriesId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.UserId, x.SeriesId }).IsUnique();
            e.HasQueryFilter(x => x.UserId == CurrentUserId);
        });

        b.Entity<WatchEvent>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Source).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.SourceKey).HasMaxLength(200);
            e.HasOne(x => x.Episode).WithMany(ep => ep.WatchEvents).HasForeignKey(x => x.EpisodeId).OnDelete(DeleteBehavior.Cascade);
            // Idempotência multi-tenant: a chave natural do export é única por usuário.
            e.HasIndex(x => new { x.UserId, x.SourceKey }).IsUnique().HasFilter("source_key IS NOT NULL");
            e.HasIndex(x => new { x.UserId, x.EpisodeId });
            e.HasIndex(x => new { x.UserId, x.WatchedAt });
            e.HasIndex(x => new { x.IsBackfill, x.WatchedAt });
            e.HasQueryFilter(x => x.UserId == CurrentUserId);
        });

        b.Entity<ImportRun>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.ReconciliationJson).HasColumnType("jsonb");
            e.HasQueryFilter(x => x.UserId == CurrentUserId);
        });

        b.Entity<SeriesMatchOverride>(e =>
        {
            e.HasKey(x => x.TvdbId);
            e.Property(x => x.TvdbId).ValueGeneratedNever();
        });

        b.Entity<ProcessedAction>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.ClientKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.Kind).HasMaxLength(40).IsRequired();
            // A garantia de idempotência mora AQUI, não no if do serviço: duas retentativas
            // concorrentes chegam juntas e é o banco que decide qual delas aplicou.
            e.HasIndex(x => new { x.UserId, x.ClientKey }).IsUnique();
            e.HasQueryFilter(x => x.UserId == CurrentUserId);
        });
    }
}
