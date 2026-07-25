using Reprise.Application.Features.Watching;

namespace Reprise.Tests.Features;

/// <summary>
/// "Quantas vezes eu revi isso, e quando?" é a pergunta que dá nome ao app. A contagem por
/// episódio responde só o "quanto".
/// </summary>
public class RewatchSessionCalculatorTests
{
    private static readonly DateTimeOffset Base = new(2020, 1, 1, 20, 0, 0, TimeSpan.Zero);

    private static SessionEvent Ev(int dayOffset, long episodeId, int runtime = 1200)
        => new(Base.AddDays(dayOffset), episodeId, runtime);

    [Fact]
    public void Maratona_continua_e_uma_sessao_so()
    {
        // Dez episódios em dez dias: uma passada, não dez.
        var events = Enumerable.Range(0, 10).Select(i => Ev(i, i + 1));

        var sessions = RewatchSessionCalculator.Compute(events);

        Assert.Single(sessions);
        Assert.Equal(10, sessions[0].Exhibitions);
        Assert.Equal(10, sessions[0].DistinctEpisodes);
    }

    [Fact]
    public void Silencio_longo_separa_passadas()
    {
        var events = new[] { Ev(0, 1), Ev(1, 2), Ev(400, 1), Ev(401, 2) };

        var sessions = RewatchSessionCalculator.Compute(events);

        Assert.Equal(2, sessions.Count);
        Assert.Equal(1, sessions[0].Ordinal);
        Assert.Equal(2, sessions[1].Ordinal);
        Assert.All(sessions, s => Assert.Equal(2, s.Exhibitions));
    }

    [Fact]
    public void Intervalo_semanal_de_serie_em_exibicao_NAO_quebra_a_sessao()
    {
        // Uma temporada semanal: se 7 dias cortassem, cada episódio viraria uma "maratona".
        var events = Enumerable.Range(0, 8).Select(i => Ev(i * 7, i + 1));

        Assert.Single(RewatchSessionCalculator.Compute(events));
    }

    [Fact]
    public void Pausa_entre_temporadas_separa()
    {
        var events = new[] { Ev(0, 1), Ev(7, 2), Ev(120, 3), Ev(127, 4) };

        Assert.Equal(2, RewatchSessionCalculator.Compute(events).Count);
    }

    [Fact]
    public void O_corte_e_por_silencio_e_nao_por_ordem_de_episodio()
    {
        // Fora de ordem no mesmo fim de semana continua sendo a mesma sessão: quem pula para
        // rever um episódio favorito não começou uma maratona nova.
        var events = new[] { Ev(0, 5), Ev(0, 1), Ev(1, 3) };

        var sessions = RewatchSessionCalculator.Compute(events);

        Assert.Single(sessions);
        Assert.Equal(3, sessions[0].DistinctEpisodes);
    }

    [Fact]
    public void Rever_o_mesmo_episodio_conta_exibicao_mas_nao_episodio_distinto()
    {
        var events = new[] { Ev(0, 1), Ev(1, 1), Ev(2, 1) };

        var s = Assert.Single(RewatchSessionCalculator.Compute(events));

        Assert.Equal(3, s.Exhibitions);
        Assert.Equal(1, s.DistinctEpisodes);
    }

    [Fact]
    public void Soma_o_tempo_e_ignora_runtime_ausente_sem_estourar()
    {
        var events = new[] { Ev(0, 1, 1800), new SessionEvent(Base.AddDays(1), 2, null) };

        var s = Assert.Single(RewatchSessionCalculator.Compute(events));

        Assert.Equal(1800, s.TotalSeconds);
    }

    [Fact]
    public void Entrada_desordenada_e_normalizada()
    {
        var events = new[] { Ev(5, 3), Ev(0, 1), Ev(2, 2) };

        var s = Assert.Single(RewatchSessionCalculator.Compute(events));

        Assert.Equal(Base, s.StartedAt);
        Assert.Equal(Base.AddDays(5), s.EndedAt);
    }

    [Fact]
    public void Sessao_de_um_dia_conta_um_dia_e_nao_zero()
    {
        var s = Assert.Single(RewatchSessionCalculator.Compute([Ev(0, 1), Ev(0, 2)]));

        Assert.Equal(1, s.SpanDays);
    }

    [Fact]
    public void Sem_exibicao_nao_ha_sessao()
    {
        Assert.Empty(RewatchSessionCalculator.Compute([]));
    }
}
