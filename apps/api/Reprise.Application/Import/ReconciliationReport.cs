namespace Reprise.Application.Import;

/// <summary>
/// Reconciliação em duas classes (estratégia C):
/// <list type="bullet">
/// <item><b>Invariantes duros</b> — o que está sob nosso controle; toda linha vira evento/estado
/// OU é reportada como rejeitada. Aqui a falha é ruidosa.</item>
/// <item><b>Cross-check com o vendor</b> — os agregados do <c>tracking-stats</c>, comparados com
/// tolerância. Divergências são logadas, não abortam (o próprio vendor não fecha consigo mesmo).</item>
/// </list>
/// </summary>
public sealed record ReconciliationReport(
    HardInvariants Hard,
    IReadOnlyList<VendorMetric> Vendor)
{
    /// <summary>O import só é considerado válido se os invariantes duros passarem.</summary>
    public bool HardInvariantsPassed => Hard.Passed;
}

public sealed record HardInvariants(
    int RowsRead,
    int ExhibitionRows,
    int UserSeriesRows,
    int StatsRows,
    int UnknownRows,
    int EventsPlanned,
    int RejectedExhibitionRows)
{
    /// <summary>Toda linha foi classificada (nada some).</summary>
    public bool AllRowsAccounted =>
        RowsRead == ExhibitionRows + UserSeriesRows + StatsRows + UnknownRows;

    /// <summary>Todo evento de exibição virou evento ou foi explicitamente rejeitado.</summary>
    public bool AllExhibitionsAccounted =>
        ExhibitionRows == EventsPlanned + RejectedExhibitionRows;

    /// <summary>Passa se nada sumiu e não há formato de linha inesperado (possível mudança no export).</summary>
    public bool Passed => AllRowsAccounted && AllExhibitionsAccounted && UnknownRows == 0;
}

/// <summary>Comparação de uma métrica do vendor com o valor recalculado dos eventos.</summary>
public sealed record VendorMetric(
    string Name,
    long? Vendor,
    long Calculated,
    double TolerancePct,
    bool ExactExpected,
    string Note)
{
    public long? DeltaAbs => Vendor is null ? null : Calculated - Vendor;

    public double? DeltaPct =>
        Vendor is null or 0 ? null : (double)(Calculated - Vendor.Value) / Vendor.Value * 100.0;

    /// <summary>
    /// Dentro do esperado: exato quando <see cref="ExactExpected"/>; caso contrário dentro da banda de tolerância.
    /// Nunca é motivo de aborto — só de log.
    /// </summary>
    public bool WithinExpectation
    {
        get
        {
            if (Vendor is null) return true; // sem referência do vendor, nada a checar
            if (ExactExpected) return Calculated == Vendor.Value;
            return DeltaPct is null || Math.Abs(DeltaPct.Value) <= TolerancePct;
        }
    }
}
