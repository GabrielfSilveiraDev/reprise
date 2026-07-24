using Reprise.Application.Import;
using Reprise.Domain.Enums;

namespace Reprise.Tests.Import;

/// <summary>
/// Testes do núcleo do importador com fixtures RECORTADAS DO EXPORT REAL
/// (HIMYM S7E2 = os 17; House com especiais) + fixtures sintéticas para reconciliação e casos-limite.
/// É aqui que se valida o requisito nº 1 do projeto: "se o rewatch não sobreviver à importação, tudo depois está errado".
/// </summary>
public class ImportPlannerTests
{
    private static readonly TvTimeExportReader Reader = new();
    private static readonly ImportPlanner Planner = new();

    private static ImportPlan PlanFixture(string name)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", name);
        var records = Reader.ReadFile(path);
        return Planner.Plan(records);
    }

    // ---------------------------------------------------------------
    // 1. REWATCH REAL: os 17 (1 watch + 16 rewatch) do HIMYM S7E2
    // ---------------------------------------------------------------

    [Fact]
    public void Rewatch_real_himym_gera_17_eventos_no_mesmo_episodio()
    {
        var plan = PlanFixture("himym_s7e2_rewatch.csv");

        Assert.Equal(17, plan.Events.Count);

        // todos apontam para o MESMO episódio (75760, T7, E2)
        var key = new EpisodeKey(75760, 7, 2);
        Assert.All(plan.Events, e => Assert.Equal(key, e.Episode));

        // 1 primeira exibição + 16 revisões
        Assert.Equal(1, plan.Events.Count(e => e.SourceKey.StartsWith("watch-episode-", StringComparison.Ordinal)));
        Assert.Equal(16, plan.Events.Count(e => e.SourceKey.StartsWith("rewatch-episode-", StringComparison.Ordinal)));
    }

    [Fact]
    public void Rewatch_real_himym_chaves_naturais_sao_unicas()
    {
        var plan = PlanFixture("himym_s7e2_rewatch.csv");
        // Pré-condição da idempotência: a chave natural (source_key) é única por exibição.
        var distinct = plan.Events.Select(e => e.SourceKey).Distinct().Count();
        Assert.Equal(plan.Events.Count, distinct);
    }

    [Fact]
    public void Rewatch_real_himym_todos_backfill_e_um_episodio()
    {
        var plan = PlanFixture("himym_s7e2_rewatch.csv");

        Assert.All(plan.Events, e => Assert.True(e.IsBackfill)); // export inteiro é marcação em massa (dez/2025)

        var ep = Assert.Single(plan.Episodes);
        Assert.Equal(1500, ep.RuntimeSeconds);
        Assert.False(ep.IsSpecial);

        var series = Assert.Single(plan.Series);
        Assert.Equal(75760, series.TvdbId);
        Assert.Contains("How I Met Your Mother", series.ProvisionalName);

        Assert.True(plan.Reconciliation.HardInvariantsPassed);
        Assert.Equal(17, plan.Reconciliation.Hard.EventsPlanned);
    }

    // ---------------------------------------------------------------
    // 2. ESPECIAIS REAIS: House (s_no=0) + user-series
    // ---------------------------------------------------------------

    [Fact]
    public void Especiais_house_sao_derivados_de_temporada_zero()
    {
        var plan = PlanFixture("house_mixed.csv");

        Assert.Equal(9, plan.Events.Count);          // 4 especiais + 5 regulares
        Assert.Equal(7, plan.Episodes.Count);        // 4 especiais + 3 regulares distintos

        var specials = plan.Episodes.Where(e => e.IsSpecial).ToList();
        Assert.Equal(4, specials.Count);
        Assert.All(specials, e => Assert.Equal(0, e.Key.SeasonNumber));
        Assert.All(specials, e => Assert.Equal(2700, e.RuntimeSeconds));

        // os regulares NÃO são especiais
        Assert.All(plan.Episodes.Where(e => e.Key.SeasonNumber > 0), e => Assert.False(e.IsSpecial));
    }

    [Fact]
    public void House_user_series_vira_tracked_series_seguindo()
    {
        var plan = PlanFixture("house_mixed.csv");

        var tracked = Assert.Single(plan.TrackedSeries);
        Assert.Equal(73255, tracked.TvdbId);
        Assert.Equal(SeriesStatus.Following, tracked.Status);
        Assert.NotNull(tracked.FollowedAt); // followed_at em microssegundos foi parseado
        // 1766977962497301 µs desde o epoch => 29/12/2025 (a data do backfill), confirmando µs (não ms).
        Assert.Equal(2025, tracked.FollowedAt!.Value.Year);
        Assert.Equal(12, tracked.FollowedAt!.Value.Month);

        Assert.Contains("House", plan.Series.Single().ProvisionalName);
        Assert.True(plan.Reconciliation.HardInvariantsPassed);
        Assert.Equal(1, plan.Reconciliation.Hard.UserSeriesRows);
    }

    // ---------------------------------------------------------------
    // 3. RECONCILIAÇÃO — Estratégia C: invariantes duros passam,
    //    cross-check com o vendor apenas SINALIZA divergência (não aborta)
    // ---------------------------------------------------------------

    [Fact]
    public void Reconciliacao_divergencia_do_vendor_nao_derruba_o_import()
    {
        var plan = PlanFixture("reconciliation_mismatch.csv");

        // Invariantes duros (sob nosso controle) PASSAM mesmo com o vendor divergindo.
        Assert.True(plan.Reconciliation.HardInvariantsPassed);
        Assert.Equal(3, plan.Events.Count);
        Assert.Equal(2, plan.Episodes.Count);
        Assert.Single(plan.TrackedSeries);
    }

    [Fact]
    public void Reconciliacao_series_follow_bate_exato_e_os_demais_sao_tolerantes()
    {
        var plan = PlanFixture("reconciliation_mismatch.csv");
        var vendor = plan.Reconciliation.Vendor;

        var follow = vendor.Single(m => m.Name == "series_follow_count");
        Assert.True(follow.ExactExpected);
        Assert.Equal(1, follow.Vendor);
        Assert.Equal(1, follow.Calculated);
        Assert.True(follow.WithinExpectation); // exato

        var epWatch = vendor.Single(m => m.Name == "ep_watch_count");
        Assert.Equal(5, epWatch.Vendor);   // vendor mente
        Assert.Equal(2, epWatch.Calculated); // realidade
        Assert.False(epWatch.WithinExpectation); // fora da banda, mas só é LOGADO

        var runtime = vendor.Single(m => m.Name == "total_series_runtime");
        Assert.Equal(99999, runtime.Vendor);
        Assert.Equal(3600, runtime.Calculated); // 2 episódios × 1800s
        Assert.False(runtime.WithinExpectation);
    }

    // ---------------------------------------------------------------
    // 4. CASO-LIMITE: runtime ausente (defensivo — não existe no export real)
    // ---------------------------------------------------------------

    [Fact]
    public void Runtime_ausente_ainda_cria_o_evento_com_runtime_nulo()
    {
        var plan = PlanFixture("edge_null_runtime.csv");

        Assert.Equal(2, plan.Events.Count);
        Assert.Empty(plan.Rejected);
        Assert.True(plan.Reconciliation.HardInvariantsPassed);

        var semRuntime = plan.Episodes.Single(e => e.Key.EpisodeNumber == 1);
        Assert.Null(semRuntime.RuntimeSeconds); // preenchido depois pelo TMDB

        var comRuntime = plan.Episodes.Single(e => e.Key.EpisodeNumber == 2);
        Assert.Equal(1560, comRuntime.RuntimeSeconds);
    }

    // ---------------------------------------------------------------
    // 5. CASO-LIMITE: rejeições reportadas (nada some silenciosamente)
    // ---------------------------------------------------------------

    [Fact]
    public void Linhas_invalidas_sao_rejeitadas_e_reportadas_nao_perdidas()
    {
        var plan = PlanFixture("edge_rejections.csv");

        Assert.Single(plan.Events); // só a linha válida virou evento

        // 1 exibição sem s_id + 1 key desconhecida = 2 rejeições reportadas
        Assert.Equal(2, plan.Rejected.Count);
        Assert.Contains(plan.Rejected, r => r.Type is RecordType.Watch && r.Reason.Contains("s_id"));
        Assert.Contains(plan.Rejected, r => r.Type == RecordType.Unknown);

        // key de formato desconhecido derruba o invariante duro (possível mudança no export)
        Assert.Equal(1, plan.Reconciliation.Hard.UnknownRows);
        Assert.False(plan.Reconciliation.HardInvariantsPassed);
    }
}
