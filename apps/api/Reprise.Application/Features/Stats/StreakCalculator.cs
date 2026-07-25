namespace Reprise.Application.Features.Stats;

/// <summary>
/// Sequências de dias consecutivos com pelo menos uma exibição.
///
/// Fica separado do SQL de propósito: agregação por dia o banco faz bem, mas "quantos dias
/// seguidos" é regra de negócio com decisões que merecem teste — o que conta como sequência
/// viva, o que fazer com dois eventos no mesmo dia, se ontem ainda vale para a sequência atual.
/// </summary>
public static class StreakCalculator
{
    /// <param name="activeDays">Dias com atividade. Duplicatas e desordem são toleradas.</param>
    /// <param name="today">
    /// Referência para a sequência atual. Ela continua viva se o último dia ativo foi hoje ou
    /// ontem — cortar em "só hoje" faria a sequência parecer quebrada toda manhã antes de assistir.
    /// </param>
    public static StreaksDto Compute(IEnumerable<DateOnly> activeDays, DateOnly today)
    {
        var days = activeDays.Distinct().Order().ToList();
        if (days.Count == 0) return new StreaksDto(0, 0, null, null);

        var longest = 1;
        DateOnly longestStart = days[0], longestEnd = days[0];

        var runStart = days[0];
        var run = 1;

        for (var i = 1; i < days.Count; i++)
        {
            if (days[i] == days[i - 1].AddDays(1))
            {
                run++;
            }
            else
            {
                runStart = days[i];
                run = 1;
            }

            if (run > longest)
            {
                longest = run;
                longestStart = runStart;
                longestEnd = days[i];
            }
        }

        // A sequência que termina no último dia ativo só conta como "atual" se ainda alcança hoje.
        var last = days[^1];
        var current = last == today || last == today.AddDays(-1) ? run : 0;

        return new StreaksDto(longest, current, longestStart, longestEnd);
    }
}
