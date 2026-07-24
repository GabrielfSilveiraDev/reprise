using Reprise.Application.Abstractions;

namespace Reprise.Infrastructure.Persistence;

/// <summary>Resolve sempre o usuário-semente. Usado pela CLI de importação e em design-time.
/// Na fase da API é substituído por um provedor que lê o <c>sub</c> do JWT.</summary>
public sealed class SeedCurrentUser : ICurrentUser
{
    public Guid UserId => RepriseDbContext.SeedUserId;
}
