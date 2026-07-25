namespace Reprise.Application.Features.Watching;

/// <summary>
/// Decide QUANDO colocar uma exibição que o export perdeu.
///
/// <para>
/// O problema: sabe-se que os episódios foram assistidos, mas não quando. Carimbá-los com a data
/// de hoje diria que você viu 24 episódios de 2013 numa tarde de 2026, e as estatísticas temporais
/// passariam a mentir — que é exatamente o defeito do backfill do TV Time que este projeto já
/// isola por padrão.
/// </para>
///
/// <para>
/// A solução: <b>interpolar entre os vizinhos</b>. Se a 7ª temporada foi vista até março e a 9ª
/// começou em maio, a 8ª aconteceu entre março e maio — e distribuí-la nesse intervalo preserva a
/// ordem real dos acontecimentos. Os eventos nascem marcados como <c>IsBackfill</c>, então
/// continuam fora dos gráficos temporais por padrão: a data é uma inferência honesta, não medição.
/// </para>
/// </summary>
public static class BackfillPlanner
{
    /// <summary>
    /// Distribui <paramref name="count"/> instantes dentro da janela, em ordem.
    ///
    /// Os extremos são evitados de propósito: um evento exatamente igual ao limite ficaria
    /// ambíguo quanto a ter vindo antes ou depois do vizinho que define a janela.
    /// </summary>
    public static IReadOnlyList<DateTimeOffset> Distribute(
        DateTimeOffset? after, DateTimeOffset? before, int count, DateTimeOffset fallback)
    {
        if (count <= 0) return Array.Empty<DateTimeOffset>();

        var (start, end) = Window(after, before, count, fallback);

        // count+1 fatias para que nenhum evento caia sobre `start` ou `end`.
        var step = (end - start) / (count + 1);
        return Enumerable.Range(1, count).Select(i => start + step * i).ToList();
    }

    /// <summary>
    /// A janela onde os eventos cabem. Sem um dos lados, inventa-se um intervalo plausível a
    /// partir do lado conhecido — um dia por episódio, que é o ritmo de quem maratona.
    /// </summary>
    private static (DateTimeOffset Start, DateTimeOffset End) Window(
        DateTimeOffset? after, DateTimeOffset? before, int count, DateTimeOffset fallback)
    {
        var span = TimeSpan.FromDays(Math.Max(1, count));

        return (after, before) switch
        {
            // Os dois lados conhecidos: é o caso bom, e o único em que a data é de fato inferida.
            ({ } a, { } b) when b > a => (a, b),

            // Vizinhos fora de ordem (rewatch embaralhou as datas): trata como se só houvesse o
            // anterior, em vez de produzir um intervalo negativo.
            ({ } a, { }) => (a, a + span),

            ({ } a, null) => (a, a + span),
            (null, { } b) => (b - span, b),
            (null, null) => (fallback - span, fallback)
        };
    }
}
