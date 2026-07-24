using Reprise.Application.Import;

namespace Reprise.Importer;

/// <summary>Formata o relatório de conferência da importação para o console.</summary>
public static class ImportReportPrinter
{
    public static void Print(TextWriter o, ImportPlan plan, ImportResult? result)
    {
        var hard = plan.Reconciliation.Hard;

        o.WriteLine();
        o.WriteLine("========== RELATÓRIO DE IMPORTAÇÃO — Reprise ==========");
        o.WriteLine(result is null ? "(DRY RUN — nada foi persistido)" : $"Import run #{result.ImportRunId}");
        o.WriteLine();

        o.WriteLine("-- Invariantes duros (sob nosso controle) --");
        o.WriteLine($"  Linhas lidas .............. {hard.RowsRead}");
        o.WriteLine($"  Exibições (watch+rewatch) . {hard.ExhibitionRows}");
        o.WriteLine($"  Eventos planejados ........ {hard.EventsPlanned}");
        o.WriteLine($"  Linhas user-series ........ {hard.UserSeriesRows}");
        o.WriteLine($"  Linhas tracking-stats ..... {hard.StatsRows}");
        o.WriteLine($"  Rejeitadas (exibição) ..... {hard.RejectedExhibitionRows}");
        o.WriteLine($"  Formato desconhecido ...... {hard.UnknownRows}");
        o.WriteLine($"  Todas contabilizadas ...... {YesNo(hard.AllRowsAccounted)}");
        o.WriteLine($"  INVARIANTES DUROS ......... {(hard.Passed ? "PASSOU ✓" : "FALHOU ✗")}");
        o.WriteLine();

        if (result is not null)
        {
            o.WriteLine("-- Persistência --");
            o.WriteLine($"  Eventos criados ........... {result.EventsCreated}");
            o.WriteLine($"  Eventos já existentes ..... {result.EventsSkipped}  (idempotência)");
            o.WriteLine($"  Séries criadas (catálogo) . {result.SeriesCreated}");
            o.WriteLine($"  Episódios criados ......... {result.EpisodesCreated}");
            o.WriteLine($"  Séries acompanhadas ....... {result.TrackedUpserted}");
            o.WriteLine();
        }

        if (plan.Reconciliation.Vendor.Count > 0)
        {
            o.WriteLine("-- Cross-check com tracking-stats (tolerante — só sinaliza) --");
            o.WriteLine($"  {"Métrica",-22} {"Vendor",12} {"Calculado",12} {"Δ",12}  Status");
            foreach (var m in plan.Reconciliation.Vendor)
            {
                var delta = m.DeltaAbs is null ? "—" : $"{m.DeltaAbs:+#;-#;0}";
                var pct = m.DeltaPct is null ? "" : $" ({m.DeltaPct:+0.0;-0.0;0}%)";
                var status = m.Vendor is null ? "s/ referência"
                    : m.WithinExpectation ? "OK" : (m.ExactExpected ? "DIVERGE!" : "diverge (tolerado)");
                o.WriteLine($"  {m.Name,-22} {Fmt(m.Vendor),12} {m.Calculated,12} {delta + pct,12}  {status}");
            }
            o.WriteLine();
        }

        // Séries no catálogo — as não casadas com TMDB precisam de resolução manual (nome + tvdb/s_id).
        var unmatched = plan.Series; // sem enriquecimento TMDB, todas ainda "não casadas"
        o.WriteLine($"-- Séries no catálogo: {plan.Series.Count} (TMDB-casadas: 0 — enriquecimento é passo posterior) --");
        foreach (var s in unmatched.Take(25))
            o.WriteLine($"    s_id={s.TvdbId,-8} {s.ProvisionalName}");
        if (unmatched.Count > 25)
            o.WriteLine($"    … e mais {unmatched.Count - 25} (resolução manual via s_id).");
        o.WriteLine();

        if (plan.Rejected.Count > 0)
        {
            o.WriteLine($"-- Linhas rejeitadas: {plan.Rejected.Count} --");
            foreach (var r in plan.Rejected.Take(25))
                o.WriteLine($"    [{r.Type}] {r.Reason}  key={Trunc(r.Key, 60)}");
            if (plan.Rejected.Count > 25)
                o.WriteLine($"    … e mais {plan.Rejected.Count - 25}.");
            o.WriteLine();
        }

        o.WriteLine("=======================================================");
    }

    private static string YesNo(bool v) => v ? "sim" : "NÃO";
    private static string Fmt(long? v) => v?.ToString() ?? "—";
    private static string Trunc(string s, int n) => s.Length <= n ? s : s[..n] + "…";
}
