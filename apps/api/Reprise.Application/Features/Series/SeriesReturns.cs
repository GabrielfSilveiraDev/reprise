using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Domain.Entities;
using Reprise.Domain.Enums;

namespace Reprise.Application.Features.Series;

/// <summary>O que uma passada fez, para o log da API: o nome de cada série que voltou.</summary>
public sealed record SeriesReturnReport(IReadOnlyList<string> Returned);

/// <summary>
/// Devolve para Assistindo a série Concluída ou Arquivada que ganhou temporada nova.
///
/// <para>
/// <b>O problema.</b> Concluída e Arquivada saem da fila de próximos e da agenda — é para isso que
/// existem. Mas em outubro de 2026 Cyberpunk: Edgerunners, concluída desde 2022, ganhou a temporada 2,
/// e o catálogo ficou sabendo (ver <c>CatalogRefresh</c>) sem que a tela contasse para ninguém: a
/// série continuava sumida exatamente onde a notícia teria de aparecer.
/// </para>
///
/// <para>
/// <b>Mudança automática, e não sugestão.</b> Ao contrário do <c>CompletionAdvisor</c> do web, que só
/// SUGERE concluir, aqui o estado muda sozinho — foi a escolha do dono do app. A diferença de risco
/// justifica: concluir por engano tira a série da vista, e voltar por engano só a põe na fila, de
/// onde um toque a tira. E a volta fica marcada (<see cref="TrackedSeries.ReturnedAt"/>), para a
/// tela dizer o que aconteceu em vez de a série simplesmente reaparecer.
/// </para>
///
/// <para>
/// <b>Por estreia de temporada, e não por episódio.</b> Quem marca Concluída de novo depois da volta
/// está dizendo "não quero esta temporada"; numa série semanal, voltar a cada episódio novo seria
/// insistir oito vezes. A estreia é o episódio 1, a mesma convenção do "estreia de temporada" da
/// agenda. Quando ela volta e o que vale como "novo" estão em
/// <see cref="TrackedSeries.ShouldReturnFor"/>.
/// </para>
///
/// <para>
/// <b>Uma passada por estado, e não um gatilho na chegada do episódio.</b> A temporada costuma entrar
/// no catálogo meses antes de estrear, e a volta só faz sentido quando dá para assistir. Comparar
/// datas a cada passada pega os dois casos — a estreia anunciada que chegou ao dia, e a temporada que
/// já chega estreada (a de Edgerunners veio pela CLI, no próprio dia) — sem lembrar de nada entre
/// uma passada e outra.
/// </para>
/// </summary>
public sealed class SeriesReturns
{
    private readonly IRepriseDbContext _db;

    public SeriesReturns(IRepriseDbContext db) => _db = db;

    /// <summary>Uma passada sobre o acervo de todo mundo, em <paramref name="now"/>.</summary>
    public async Task<SeriesReturnReport> ApplyAsync(DateTimeOffset now, CancellationToken ct = default)
    {
        var hoje = DateOnly.FromDateTime(now.UtcDateTime);

        // Sem o filtro de tenant: roda no serviço em segundo plano, sem usuário, e vale para todos —
        // como a seleção do CatalogRefresh. Por isso cada subconsulta compara o UserId à mão: sem o
        // filtro, `e.WatchEvents.Any()` seria "alguém viu", e a exibição de outra pessoa seguraria a
        // sua série concluída.
        var candidatas = await _db.TrackedSeries
            .IgnoreQueryFilters()
            .Where(t => t.Status == SeriesStatus.Finished || t.Status == SeriesStatus.Archived)
            .Select(t => new
            {
                Acompanhamento = t,
                t.Series.Name,
                // A estreia mais recente que já saiu e que esta pessoa não viu. Data obrigatória, ao
                // contrário de `Episode.Aired`: um episódio sem data não tem como ser "novo desde".
                Estreia = t.Series.Episodes
                    .Where(e => e.SeasonNumber > 0 && e.EpisodeNumber == 1
                                && e.AirDate != null && e.AirDate <= hoje
                                && !e.WatchEvents.Any(w => w.UserId == t.UserId))
                    .Max(e => e.AirDate),
                UltimaExibicao = t.Series.Episodes
                    .SelectMany(e => e.WatchEvents)
                    .Where(w => w.UserId == t.UserId)
                    .Max(w => (DateTimeOffset?)w.WatchedAt),
            })
            .Where(c => c.Estreia != null)
            .ToListAsync(ct);

        var voltaram = new List<string>();
        foreach (var c in candidatas)
        {
            if (!c.Acompanhamento.ShouldReturnFor(c.Estreia!.Value, c.UltimaExibicao)) continue;

            c.Acompanhamento.ReturnForNewSeason(now);
            voltaram.Add(c.Name);
        }

        if (voltaram.Count > 0) await _db.SaveChangesAsync(ct);
        return new SeriesReturnReport(voltaram);
    }
}
