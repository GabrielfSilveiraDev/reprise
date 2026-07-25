using Reprise.Application.Features.Stats;

namespace Reprise.Tests.Features;

public class StreakCalculatorTests
{
    private static DateOnly D(int day) => new(2026, 3, day);
    private static readonly DateOnly Hoje = new(2026, 3, 20);

    [Fact]
    public void Sem_dias_ativos_tudo_zero()
    {
        var s = StreakCalculator.Compute([], Hoje);
        Assert.Equal(0, s.LongestDays);
        Assert.Equal(0, s.CurrentDays);
        Assert.Null(s.LongestStartedAt);
    }

    [Fact]
    public void Um_unico_dia_e_sequencia_de_um()
    {
        var s = StreakCalculator.Compute([D(1)], Hoje);
        Assert.Equal(1, s.LongestDays);
        Assert.Equal(D(1), s.LongestStartedAt);
        Assert.Equal(D(1), s.LongestEndedAt);
    }

    [Fact]
    public void Dias_consecutivos_formam_a_sequencia_e_o_intervalo_e_reportado()
    {
        var s = StreakCalculator.Compute([D(3), D(4), D(5), D(6)], Hoje);
        Assert.Equal(4, s.LongestDays);
        Assert.Equal(D(3), s.LongestStartedAt);
        Assert.Equal(D(6), s.LongestEndedAt);
    }

    [Fact]
    public void Buraco_quebra_a_sequencia_e_a_maior_vence()
    {
        // 1,2 (2 dias) · buraco no 3 · 4,5,6,7 (4 dias) · buraco · 10
        var s = StreakCalculator.Compute([D(1), D(2), D(4), D(5), D(6), D(7), D(10)], Hoje);
        Assert.Equal(4, s.LongestDays);
        Assert.Equal(D(4), s.LongestStartedAt);
        Assert.Equal(D(7), s.LongestEndedAt);
    }

    [Fact]
    public void Entrada_desordenada_e_com_repeticao_nao_atrapalha()
    {
        // Vários eventos no mesmo dia contam como um dia só.
        var s = StreakCalculator.Compute([D(5), D(3), D(4), D(5), D(3), D(5)], Hoje);
        Assert.Equal(3, s.LongestDays);
        Assert.Equal(D(3), s.LongestStartedAt);
    }

    [Fact]
    public void Sequencia_atual_conta_quando_termina_hoje()
    {
        var s = StreakCalculator.Compute([D(18), D(19), D(20)], Hoje);
        Assert.Equal(3, s.CurrentDays);
    }

    [Fact]
    public void Sequencia_atual_sobrevive_a_ontem()
    {
        // Antes de assistir hoje a sequência não pode parecer quebrada.
        var s = StreakCalculator.Compute([D(17), D(18), D(19)], Hoje);
        Assert.Equal(3, s.CurrentDays);
    }

    [Fact]
    public void Sequencia_atual_zera_quando_o_ultimo_dia_e_anteontem()
    {
        var s = StreakCalculator.Compute([D(16), D(17), D(18)], Hoje);
        Assert.Equal(0, s.CurrentDays);
        Assert.Equal(3, s.LongestDays); // a maior histórica continua registrada
    }

    [Fact]
    public void Sequencia_atual_pode_ser_menor_que_a_maior()
    {
        var s = StreakCalculator.Compute([D(1), D(2), D(3), D(4), D(5), D(19), D(20)], Hoje);
        Assert.Equal(5, s.LongestDays);
        Assert.Equal(2, s.CurrentDays);
    }

    [Fact]
    public void Virada_de_mes_nao_quebra_a_sequencia()
    {
        var s = StreakCalculator.Compute(
            [new DateOnly(2026, 2, 27), new DateOnly(2026, 2, 28), new DateOnly(2026, 3, 1)],
            Hoje);
        Assert.Equal(3, s.LongestDays);
    }
}
