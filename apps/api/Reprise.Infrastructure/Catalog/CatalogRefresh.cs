using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Application.Enrichment;
using Reprise.Domain.Enums;
using Reprise.Infrastructure.Persistence;
using Reprise.Infrastructure.Tvmaze;

namespace Reprise.Infrastructure.Catalog;

/// <summary>O que uma rodada fez, para o log da API.</summary>
/// <param name="Vencidas">Séries que estavam para atualizar.</param>
/// <param name="Atualizadas">Destas, quantas o TMDB atualizou de fato.</param>
/// <param name="Falhas">Uma linha por série que ficou para a próxima rodada, com o motivo.</param>
public sealed record CatalogRefreshReport(int Vencidas, int Atualizadas, IReadOnlyList<string> Falhas);

/// <summary>
/// Mantém em dia o catálogo das séries que ainda podem ganhar episódio.
///
/// <para>
/// <b>O problema.</b> O catálogo só era atualizado pela CLI (<c>enrich --force</c>, <c>agenda</c>),
/// e ninguém se lembra de rodá-la. Em setembro de 2026 isso significava que a tela inicial não
/// sabia da volta de Silo, anunciada para julho de 2027, nem de duas outras temporadas já datadas —
/// e o resumo do próximo Dark Matter, publicado dias antes da estreia, nunca chegava. Uma tela que
/// promete "o próximo episódio de cada série" é tão boa quanto o catálogo que ela lê.
/// </para>
///
/// <para>
/// <b>Quais séries, e em que ritmo.</b> Duas velocidades. As que alguém está assistindo
/// (<c>Following</c>) e que o TMDB dá como em produção são consultadas a cada <see cref="Validade"/>:
/// é delas que sai a próxima estreia e o resumo do próximo episódio. Todo o resto que alguém
/// acompanha — encerrada, cancelada, concluída, para depois, parada — a cada <see cref="ValidadeLenta"/>.
/// "Encerrada" é o que o TMDB acha hoje, não uma promessa: em outubro de 2026 Cyberpunk: Edgerunners,
/// "Ended" desde 2022 e marcada como concluída, ganhou a temporada 2 — e, sem a velocidade lenta, o
/// Reprise nunca ficaria sabendo. Uma vez por semana é barato (umas cinco requisições por série) e
/// basta: a volta de uma série é anunciada com meses de antecedência.
/// </para>
///
/// <para>
/// <b>Quantas por rodada.</b> No máximo <see cref="MaximoPorRodada"/>, as mais velhas primeiro. A
/// primeira rodada depois desta mudança encontra o acervo inteiro vencido; sem o teto, seriam
/// centenas de requisições seguidas — e o TVmaze limita a 20 a cada 10 segundos. O resto fica para
/// as rodadas seguintes, de hora em hora.
/// </para>
///
/// <para>
/// <b>De quanto em quanto tempo.</b> Cada série no máximo a cada <see cref="Validade"/>, medida por
/// <c>series.updated_at</c> — que só o enriquecimento escreve, e que portanto diz exatamente "quando
/// o TMDB foi consultado pela última vez". Guardar o marco na própria série, e não num relógio da
/// rodada, é o que faz uma rodada interrompida (a API fechada no meio) retomar de onde parou: o que
/// já foi feito não está mais vencido.
/// </para>
///
/// <para>
/// <b>O mesmo caminho da CLI.</b> Cada série passa pelo <see cref="SeriesEnrichmentService.ApplyAsync"/>
/// e pela <see cref="TvmazeScheduleSync.SyncSeriesAsync"/>, que são o que o <c>enrich</c> e o
/// <c>agenda</c> já fazem — inclusive a regra de nunca apagar episódio. Um segundo caminho de
/// escrita no catálogo seria um segundo lugar para as regras divergirem.
/// </para>
/// </summary>
public sealed class CatalogRefresh
{
    /// <summary>
    /// Doze horas: quem abre o app de manhã e de noite vê o resumo publicado entre uma e outra. O
    /// custo é baixo — umas cinco requisições por série, meia centena de séries.
    /// </summary>
    public static readonly TimeSpan Validade = TimeSpan.FromHours(12);

    /// <summary>Uma semana: o ritmo das séries que não devem ganhar episódio tão cedo — ver o cabeçalho.</summary>
    public static readonly TimeSpan ValidadeLenta = TimeSpan.FromDays(7);

    /// <summary>Teto de séries por rodada. A rodada é de hora em hora, então o atraso máximo é pequeno.</summary>
    public const int MaximoPorRodada = 40;

    /// <summary>Os status do TMDB de série que não volta. O campo não é traduzido: vem em inglês mesmo pedindo pt-BR.</summary>
    private static readonly string[] Encerradas = ["Ended", "Canceled"];

    private readonly RepriseDbContext _db;
    private readonly ITmdbClient _tmdb;
    private readonly SeriesEnrichmentService _enriquecimento;
    private readonly TvmazeScheduleSync _agenda;

    public CatalogRefresh(
        RepriseDbContext db, ITmdbClient tmdb, SeriesEnrichmentService enriquecimento, TvmazeScheduleSync agenda)
    {
        _db = db;
        _tmdb = tmdb;
        _enriquecimento = enriquecimento;
        _agenda = agenda;
    }

    /// <summary>Atualiza, da mais antiga para a mais recente, as séries vencidas em <paramref name="now"/>.</summary>
    public async Task<CatalogRefreshReport> RefreshStaleAsync(DateTimeOffset now, CancellationToken ct = default)
    {
        var vencidas = await VencidasAsync(now, ct);
        var atualizadas = 0;
        var falhas = new List<string>();

        foreach (var id in vencidas)
        {
            ct.ThrowIfCancellationRequested();

            var nome = $"série {id}";
            try
            {
                var serie = await _db.Series.SingleAsync(s => s.Id == id, ct);
                nome = serie.Name;

                var show = await _tmdb.GetShowAsync(serie.TmdbId!.Value, ct);
                if (show is null)
                {
                    falhas.Add($"{nome}: o TMDB não conhece mais o id {serie.TmdbId}");
                    continue;
                }

                await _enriquecimento.ApplyAsync(serie, show, ct);
                atualizadas++;

                // A agenda é complemento: sem ela o episódio continua datado pelo TMDB, só com a
                // regra conservadora de horário. Por isso a falha aqui não desfaz nem acusa a
                // atualização — e "não está no TVmaze" nem é falha, é o normal de parte do acervo.
                await _agenda.SyncSeriesAsync(serie, ct);
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                // Uma série com problema não pode deixar as outras sem atualizar. Ela continua
                // vencida e é tentada de novo na rodada seguinte.
                falhas.Add($"{nome}: {ex.GetType().Name} — {ex.Message}");
            }
            finally
            {
                // Um contexto só atravessa a rodada inteira. Sem limpar, cada série deixaria seus
                // episódios rastreados, e a última pagaria a detecção de mudanças de todas.
                _db.ChangeTracker.Clear();
            }
        }

        return new CatalogRefreshReport(vencidas.Count, atualizadas, falhas);
    }

    /// <summary>
    /// Os ids a atualizar, os mais velhos primeiro.
    ///
    /// <para>
    /// <b>Sem o filtro de tenant.</b> Isto roda fora de requisição, sem usuário — e o catálogo é
    /// de todos: basta uma pessoa acompanhar a série para ela precisar estar em dia. Com o filtro,
    /// o usuário vazio do serviço em segundo plano não acompanharia nada e nada seria atualizado.
    /// </para>
    /// </summary>
    private async Task<List<long>> VencidasAsync(DateTimeOffset now, CancellationToken ct)
    {
        var limite = now - Validade;
        var limiteLento = now - ValidadeLenta;

        // Uma linha por acompanhamento: a mesma série acompanhada por duas pessoas, uma assistindo e
        // outra que já concluiu, vale pela velocidade mais rápida — basta uma delas precisar.
        var candidatas = await _db.TrackedSeries
            .IgnoreQueryFilters()
            .Where(t => t.Series.TmdbId != null && t.Series.UpdatedAt < limite)
            .Select(t => new
            {
                t.SeriesId,
                t.Series.UpdatedAt,
                Rapida = t.Status == SeriesStatus.Following
                         && (t.Series.Status == null || !Encerradas.Contains(t.Series.Status)),
            })
            .ToListAsync(ct);

        return candidatas
            .GroupBy(c => c.SeriesId)
            .Select(g => new { Id = g.Key, g.First().UpdatedAt, Rapida = g.Any(c => c.Rapida) })
            .Where(s => s.Rapida || s.UpdatedAt < limiteLento)
            .OrderBy(s => s.UpdatedAt)
            .Take(MaximoPorRodada)
            .Select(s => s.Id)
            .ToList();
    }
}
