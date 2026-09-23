using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Domain.Enums;

namespace Reprise.Application.Features.Series;

/// <summary>Uma mudança de estado pedida pelo cliente.</summary>
public sealed record TrackingChange(long SeriesId, string Status);

/// <summary>Quantas séries mudaram de fato — repetir a operação devolve zero, não erro.</summary>
public sealed record TrackingUpdateResult(int Updated, IReadOnlyList<long> NotFound);

/// <summary>
/// Comandos sobre a relação do usuário com a série (acompanhando, arquivada, concluída…), que é
/// coisa distinta do log de exibições: mudar o estado aqui não cria nem apaga um único evento.
///
/// <para>
/// <b>Por que existe a operação em lote.</b> A decisão de "esta série acabou e eu terminei" mora
/// no <c>CompletionAdvisor</c> do cliente web, em TypeScript e coberto por teste.
/// Reimplementá-la aqui em C# criaria duas versões da mesma regra, que divergem no primeiro ajuste.
/// Então o cliente decide QUAIS séries mudam e este serviço só aplica — e como definir um valor é
/// naturalmente idempotente, repetir não faz estrago e não precisa de chave.
/// </para>
/// </summary>
public sealed class TrackingService
{
    private readonly IRepriseDbContext _db;

    public TrackingService(IRepriseDbContext db) => _db = db;

    public async Task<TrackingUpdateResult> ApplyAsync(
        IReadOnlyList<TrackingChange> changes, CancellationToken ct = default)
    {
        if (changes.Count == 0) return new TrackingUpdateResult(0, Array.Empty<long>());

        // Valida tudo antes de gravar qualquer coisa: um status inválido no meio da lista não pode
        // deixar metade aplicada.
        var parsed = new List<(long SeriesId, SeriesStatus Status)>(changes.Count);
        foreach (var change in changes)
        {
            if (!Enum.TryParse<SeriesStatus>(change.Status, ignoreCase: true, out var status))
                throw new ArgumentException($"Status desconhecido: '{change.Status}'.", nameof(changes));
            parsed.Add((change.SeriesId, status));
        }

        var ids = parsed.Select(p => p.SeriesId).Distinct().ToList();
        var tracked = await _db.TrackedSeries
            .Where(t => ids.Contains(t.SeriesId))
            .ToDictionaryAsync(t => t.SeriesId, ct);

        var updated = 0;
        foreach (var (seriesId, status) in parsed)
        {
            if (!tracked.TryGetValue(seriesId, out var row)) continue;
            if (row.Status == status) continue;   // já estava assim: não conta como mudança

            row.Status = status;
            updated += 1;
        }

        if (updated > 0) await _db.SaveChangesAsync(ct);

        var notFound = ids.Where(id => !tracked.ContainsKey(id)).ToList();
        return new TrackingUpdateResult(updated, notFound);
    }

    public Task<TrackingUpdateResult> SetAsync(long seriesId, string status, CancellationToken ct = default)
        => ApplyAsync([new TrackingChange(seriesId, status)], ct);

    /// <summary>
    /// Tira a revisão da série da fila de próximos, até a próxima exibição repetida — ver
    /// <see cref="Domain.Entities.TrackedSeries.RewatchDismissedAt"/>. Falso se a série não é acompanhada.
    ///
    /// <para>
    /// Não muda o estado nem o log: quem cansou de rever uma série continua com ela concluída e
    /// com todas as passagens registradas.
    /// </para>
    /// </summary>
    public Task<bool> DismissRewatchAsync(long seriesId, CancellationToken ct = default)
        => SetRewatchDismissalAsync(seriesId, DateTimeOffset.UtcNow, ct);

    /// <summary>Desfaz <see cref="DismissRewatchAsync"/>: a revisão volta para a fila, se ainda estiver em andamento.</summary>
    public Task<bool> RestoreRewatchAsync(long seriesId, CancellationToken ct = default)
        => SetRewatchDismissalAsync(seriesId, null, ct);

    private async Task<bool> SetRewatchDismissalAsync(long seriesId, DateTimeOffset? when, CancellationToken ct)
    {
        var row = await _db.TrackedSeries.FirstOrDefaultAsync(t => t.SeriesId == seriesId, ct);
        if (row is null) return false;

        row.RewatchDismissedAt = when;
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
