using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Domain.Enums;

namespace Reprise.Application.Features.Profile;

/// <summary>
/// Quem é o dono dos dados e o tamanho do acervo dele.
///
/// Separado de <c>/stats</c> de propósito: aquilo responde "como eu assisti ao longo do tempo",
/// isto responde "o que eu tenho". A tela de perfil junta os dois, mas o app offline guarda cada
/// resposta sob a sua chave — misturá-las obrigaria a recarregar as estatísticas inteiras só para
/// atualizar a contagem de séries.
/// </summary>
public sealed record ProfileDto(
    string DisplayName,
    string Email,
    DateTimeOffset MemberSince,
    int SeriesTracked,
    int SeriesFollowing,
    int SeriesFinished,
    int SeriesArchived,
    int CatalogEpisodes,
    /// <summary>Séries do acervo cujo catálogo ainda não veio do TMDB — progresso delas é chute.</summary>
    int SeriesWithoutMetadata,
    DateTimeOffset? LastImportedAt);

public sealed class ProfileQueries
{
    private readonly IRepriseDbContext _db;
    private readonly ICurrentUser _currentUser;

    public ProfileQueries(IRepriseDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<ProfileDto?> GetAsync(CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == _currentUser.UserId, ct);
        if (user is null) return null;

        // Uma passada só pelo tracked_series; contar por status em consultas separadas seria
        // quatro viagens ao banco para responder a mesma pergunta.
        var byStatus = await _db.TrackedSeries
            .GroupBy(t => t.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        int CountOf(SeriesStatus status) => byStatus.FirstOrDefault(x => x.Status == status)?.Count ?? 0;

        var trackedIds = await _db.TrackedSeries.Select(t => t.SeriesId).ToListAsync(ct);

        var catalogEpisodes = await _db.Episodes.CountAsync(e => trackedIds.Contains(e.SeriesId), ct);
        var withoutMetadata = await _db.Series
            .CountAsync(s => trackedIds.Contains(s.Id) && !s.MetadataEnriched, ct);

        var lastImport = await _db.ImportRuns
            .OrderByDescending(r => r.StartedAt)
            .Select(r => (DateTimeOffset?)r.StartedAt)
            .FirstOrDefaultAsync(ct);

        return new ProfileDto(
            user.DisplayName,
            // O Identity declara o e-mail como anulável; aqui toda conta tem um (o cadastro exige e
            // a CLI também). Mesma convenção do AuthService ao montar a sessão.
            user.Email ?? string.Empty,
            user.CreatedAt,
            trackedIds.Count,
            CountOf(SeriesStatus.Following),
            CountOf(SeriesStatus.Finished),
            CountOf(SeriesStatus.Archived),
            catalogEpisodes,
            withoutMetadata,
            lastImport);
    }
}
