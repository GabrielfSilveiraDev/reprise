using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Application.Features.Series;
using Reprise.Domain.Entities;

namespace Reprise.Application.Features.Watching;

/// <summary>
/// Comandos de marcação. Coerente com o princípio central: marcar = <b>acrescentar</b> um evento ao log;
/// desmarcar = <b>remover</b> um evento. Marcar um episódio já visto é, por construção, um rewatch —
/// não há operação separada. Marcações em massa (temporada / "até aqui") só criam eventos para o que
/// ainda não foi visto (não geram rewatches acidentais).
///
/// <para>
/// <b>Idempotência.</b> Todo comando aceita um <c>clientKey</c> opcional: um UUID que o cliente gera por
/// ação e reenvia em cada retentativa. Ele existe para o app offline, onde retentativa é a regra e não a
/// exceção — sem ele, uma resposta perdida na volta viraria um rewatch que nunca aconteceu. O evento e o
/// registro da chave são gravados no <b>mesmo</b> <c>SaveChanges</c>, então ou os dois existem ou nenhum:
/// falhar no meio não deixa nem evento órfão nem chave que bloqueia a ação de verdade.
/// </para>
/// </summary>
public sealed class WatchingService
{
    private readonly IRepriseDbContext _db;
    private readonly ICurrentUser _currentUser;

    public WatchingService(IRepriseDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    /// <summary>Marca um episódio como visto (append). Chamado de novo no mesmo episódio = rewatch.</summary>
    public async Task<WatchStateDto?> MarkAsync(long episodeId, DateTimeOffset? watchedAt, string? clientKey = null, CancellationToken ct = default)
    {
        var exists = await _db.Episodes.AnyAsync(e => e.Id == episodeId, ct);
        if (!exists) return null;

        if (await AlreadyAppliedAsync(clientKey, ct)) return await StateAsync(episodeId, ct);

        _db.WatchEvents.Add(WatchEvent.CreateManual(_currentUser.UserId, episodeId, watchedAt ?? DateTimeOffset.UtcNow));
        StageLedger(clientKey, ActionKind.Watch);
        await SaveIgnoringReplayAsync(ct);

        return await StateAsync(episodeId, ct);
    }

    /// <summary>Desmarca: remove a exibição mais recente do episódio (decrementa o rewatch).</summary>
    public async Task<WatchStateDto?> UnmarkAsync(long episodeId, string? clientKey = null, CancellationToken ct = default)
    {
        var exists = await _db.Episodes.AnyAsync(e => e.Id == episodeId, ct);
        if (!exists) return null;

        if (await AlreadyAppliedAsync(clientKey, ct)) return await StateAsync(episodeId, ct);

        var latest = await _db.WatchEvents
            .Where(w => w.EpisodeId == episodeId)
            .OrderByDescending(w => w.WatchedAt)
            .FirstOrDefaultAsync(ct);

        // Sem exibição para remover, ainda assim registramos a chave: a ação foi processada, e uma
        // retentativa não pode voltar depois e apagar um rewatch legítimo criado no meio-tempo.
        if (latest is not null) _db.WatchEvents.Remove(latest);
        StageLedger(clientKey, ActionKind.Unwatch);
        await SaveIgnoringReplayAsync(ct);

        return await StateAsync(episodeId, ct);
    }

    /// <summary>Marca a temporada inteira: cria eventos apenas para os episódios ainda não vistos.</summary>
    public async Task<int> MarkSeasonAsync(long seriesId, int seasonNumber, DateTimeOffset? watchedAt, string? clientKey = null, CancellationToken ct = default)
    {
        if (await AlreadyAppliedAsync(clientKey, ct)) return 0;

        var unseen = await _db.Episodes
            .Where(e => e.SeriesId == seriesId && e.SeasonNumber == seasonNumber && !e.WatchEvents.Any())
            .Select(e => e.Id)
            .ToListAsync(ct);

        return await MarkManyAsync(unseen, watchedAt, clientKey, ActionKind.WatchSeason, ct);
    }

    /// <summary>"Marcar até aqui": todos os episódios regulares até (temporada, episódio), ainda não vistos.</summary>
    public async Task<int> MarkUpToAsync(long seriesId, int seasonNumber, int episodeNumber, DateTimeOffset? watchedAt, string? clientKey = null, CancellationToken ct = default)
    {
        if (await AlreadyAppliedAsync(clientKey, ct)) return 0;

        var unseen = await _db.Episodes
            .Where(e => e.SeriesId == seriesId && e.SeasonNumber > 0 && !e.WatchEvents.Any()
                        && (e.SeasonNumber < seasonNumber
                            || (e.SeasonNumber == seasonNumber && e.EpisodeNumber <= episodeNumber)))
            .Select(e => e.Id)
            .ToListAsync(ct);

        return await MarkManyAsync(unseen, watchedAt, clientKey, ActionKind.WatchUpTo, ct);
    }

    private async Task<int> MarkManyAsync(
        IReadOnlyList<long> episodeIds, DateTimeOffset? watchedAt, string? clientKey, string kind, CancellationToken ct)
    {
        // Nada a marcar e nenhuma chave a registrar: não há o que gravar.
        if (episodeIds.Count == 0 && clientKey is null) return 0;

        var when = watchedAt ?? DateTimeOffset.UtcNow;
        foreach (var id in episodeIds)
            _db.WatchEvents.Add(WatchEvent.CreateManual(_currentUser.UserId, id, when));

        StageLedger(clientKey, kind);
        return await SaveIgnoringReplayAsync(ct) ? episodeIds.Count : 0;
    }

    private async Task<WatchStateDto> StateAsync(long episodeId, CancellationToken ct)
    {
        var agg = await _db.WatchEvents
            .Where(w => w.EpisodeId == episodeId)
            .GroupBy(w => w.EpisodeId)
            .Select(g => new { Count = g.Count(), Last = g.Max(w => (DateTimeOffset?)w.WatchedAt) })
            .FirstOrDefaultAsync(ct);

        return new WatchStateDto(episodeId, agg?.Count ?? 0, agg?.Last);
    }

    // ── Idempotência ─────────────────────────────────────────────────────────────────────
    // O pré-teste abaixo é só economia: evita o custo da exceção no caso comum, em que a
    // retentativa chega bem depois da primeira. Quem de fato garante a unicidade é o índice
    // único do banco, porque duas retentativas simultâneas passam pelo pré-teste juntas.

    private async Task<bool> AlreadyAppliedAsync(string? clientKey, CancellationToken ct)
        => clientKey is not null && await _db.ProcessedActions.AnyAsync(a => a.ClientKey == clientKey, ct);

    private void StageLedger(string? clientKey, string kind)
    {
        if (clientKey is not null)
            _db.ProcessedActions.Add(ProcessedAction.Create(_currentUser.UserId, clientKey, kind));
    }

    /// <summary>
    /// Salva. Devolve <c>false</c> quando a gravação foi rejeitada por colisão da chave do cliente —
    /// ou seja, a ação já tinha sido aplicada e esta requisição é uma repetição.
    /// A detecção é por entidade envolvida, não por código de erro do provedor: a camada Application
    /// não conhece Postgres.
    /// </summary>
    private async Task<bool> SaveIgnoringReplayAsync(CancellationToken ct)
    {
        try
        {
            await _db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException ex) when (ex.Entries.Any(e => e.Entity is ProcessedAction))
        {
            // Descarta o lote: o evento desta requisição não pode ser regravado por um SaveChanges
            // posterior, porque a requisição que ganhou a corrida já o criou.
            foreach (var entry in ex.Entries) entry.State = EntityState.Detached;
            return false;
        }
    }

    private static class ActionKind
    {
        public const string Watch = "watch";
        public const string Unwatch = "unwatch";
        public const string WatchSeason = "watch-season";
        public const string WatchUpTo = "watch-up-to";
    }
}
