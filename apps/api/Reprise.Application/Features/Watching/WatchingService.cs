using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Application.Features.Series;
using Reprise.Domain.Entities;
using Reprise.Domain.Scheduling;

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

    /// <summary>
    /// Marca um episódio como visto (append). Chamado de novo no mesmo episódio = rewatch.
    ///
    /// <para>
    /// <b>Episódio que ainda não foi ao ar é recusado.</b> Não é preciosismo de validação: o log de
    /// exibições é a fonte da verdade de tudo o que o app calcula, então um evento impossível
    /// contamina o progresso da série, o "próximo a assistir", as estatísticas e as sessões de
    /// rewatch — e some no meio de dez mil eventos legítimos, sem nada que o denuncie depois.
    /// </para>
    /// </summary>
    public async Task<MarkOutcome> MarkAsync(long episodeId, DateTimeOffset? watchedAt, string? clientKey = null, CancellationToken ct = default)
    {
        var episode = await _db.Episodes
            .Where(e => e.Id == episodeId)
            .Select(e => new { e.AirDate, e.TvmazeAirDate, e.TvmazeAirStamp, e.Series.OriginCountry })
            .FirstOrDefaultAsync(ct);

        if (episode is null) return MarkOutcome.NotFound;

        // Recusa pelo INSTANTE de lançamento (fuso de origem da série), e não pela data em UTC.
        // A regra antiga liberava o episódio de amanhã a partir das 21h no Brasil — hora em que o
        // UTC já virou —, e liberava o de hoje desde a meia-noite, quando ele ainda não saiu.
        // É a MESMA regra que a tela usa para dizer "Estreia amanhã": o botão não pode aceitar o
        // que o texto ao lado dele diz que ainda não existe.
        var lancamento = new EpisodeRelease(
            episode.AirDate, episode.TvmazeAirDate, episode.TvmazeAirStamp, episode.OriginCountry);

        if (!ReleaseSchedule.HasReleased(lancamento, DateTimeOffset.UtcNow)) return MarkOutcome.NotAired;

        // A outra porta para o mesmo evento impossível. O episódio pode já ter estreado e a DATA
        // vir no futuro — nenhum cliente manda isso hoje, mas o corpo aceita, e uma exibição
        // datada em 2027 desloca a maior sequência, o calendário e a "última atividade" sem que
        // nada na tela denuncie de onde veio.
        if (IsInTheFuture(watchedAt)) return MarkOutcome.FutureDate;

        if (await AlreadyAppliedAsync(clientKey, ct)) return MarkOutcome.Ok(await StateAsync(episodeId, ct));

        _db.WatchEvents.Add(WatchEvent.CreateManual(_currentUser.UserId, episodeId, watchedAt ?? DateTimeOffset.UtcNow));
        StageLedger(clientKey, ActionKind.Watch);
        await SaveIgnoringReplayAsync(ct);

        return MarkOutcome.Ok(await StateAsync(episodeId, ct));
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

    /// <summary>
    /// Marca a temporada inteira: cria eventos apenas para os episódios ainda não vistos <b>e já
    /// exibidos</b>.
    ///
    /// <para>
    /// Aqui o episódio futuro é <i>pulado em silêncio</i>, e não recusado como no comando
    /// individual. A diferença é de intenção: quem aperta "Assisti" num episódio específico está
    /// afirmando algo sobre aquele episódio e merece ser corrigido; quem aperta "Marcar temporada"
    /// está dizendo "pus a temporada em dia", e a resposta certa a isso é marcar o que existe — não
    /// recusar tudo porque a Silo tem mais seis episódios agendados até setembro.
    /// </para>
    /// </summary>
    public async Task<int> MarkSeasonAsync(long seriesId, int seasonNumber, DateTimeOffset? watchedAt, string? clientKey = null, CancellationToken ct = default)
    {
        if (await AlreadyAppliedAsync(clientKey, ct)) return 0;

        var unseen = await JaLancadosAsync(
            seriesId,
            _db.Episodes.Where(e => e.SeriesId == seriesId && e.SeasonNumber == seasonNumber && !e.WatchEvents.Any()),
            ct);

        return await MarkManyAsync(unseen, watchedAt, clientKey, ActionKind.WatchSeason, ct);
    }

    /// <summary>"Marcar até aqui": episódios regulares até (temporada, episódio), não vistos e já exibidos.</summary>
    public async Task<int> MarkUpToAsync(long seriesId, int seasonNumber, int episodeNumber, DateTimeOffset? watchedAt, string? clientKey = null, CancellationToken ct = default)
    {
        if (await AlreadyAppliedAsync(clientKey, ct)) return 0;

        var unseen = await JaLancadosAsync(
            seriesId,
            _db.Episodes.Where(e => e.SeriesId == seriesId && e.SeasonNumber > 0 && !e.WatchEvents.Any()
                                    && (e.SeasonNumber < seasonNumber
                                        || (e.SeasonNumber == seasonNumber && e.EpisodeNumber <= episodeNumber))),
            ct);

        return await MarkManyAsync(unseen, watchedAt, clientKey, ActionKind.WatchUpTo, ct);
    }

    /// <summary>
    /// Dos episódios candidatos, os que já saíram.
    ///
    /// <para>
    /// O filtro fino acontece na memória porque o instante de lançamento passou a ser <b>por
    /// episódio</b> — o TVmaze dá horário exato em TV linear e data própria no resto —, e isso não
    /// cabe numa comparação de datas em SQL. O custo é trazer quatro colunas dos episódios de UMA
    /// série em vez de só os ids: um conjunto pequeno e limitado, contra o benefício de a regra
    /// continuar existindo num lugar só.
    /// </para>
    /// </summary>
    private async Task<List<long>> JaLancadosAsync(
        long seriesId, IQueryable<Episode> candidatos, CancellationToken ct)
    {
        var pais = await _db.Series
            .Where(s => s.Id == seriesId)
            .Select(s => s.OriginCountry)
            .FirstOrDefaultAsync(ct);

        var linhas = await candidatos
            .Select(e => new { e.Id, e.AirDate, e.TvmazeAirDate, e.TvmazeAirStamp })
            .ToListAsync(ct);

        var agora = DateTimeOffset.UtcNow;
        return linhas
            .Where(e => ReleaseSchedule.HasReleased(
                new EpisodeRelease(e.AirDate, e.TvmazeAirDate, e.TvmazeAirStamp, pais), agora))
            .Select(e => e.Id)
            .ToList();
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

    /// <summary>
    /// A data está no futuro?
    ///
    /// A folga de um dia é de propósito: o relógio do aparelho é do aparelho, e um celular meia
    /// hora adiantado não pode virar uma marcação recusada. O que se quer barrar é a data
    /// francamente errada, não o desencontro de fuso.
    /// </summary>
    private static bool IsInTheFuture(DateTimeOffset? watchedAt)
        => watchedAt is not null && watchedAt.Value > DateTimeOffset.UtcNow.AddDays(1);

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
