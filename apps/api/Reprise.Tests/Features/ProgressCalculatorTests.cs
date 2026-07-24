using Reprise.Application.Features.Series;

namespace Reprise.Tests.Features;

public class ProgressCalculatorTests
{
    private static EpisodeProgressInput Ep(long id, int s, int e) => new(id, s, e);

    [Fact]
    public void Sem_episodios_progresso_zero_e_sem_proximo()
    {
        var p = ProgressCalculator.Compute([], new HashSet<long>());
        Assert.Equal(0, p.EpisodesTotal);
        Assert.Equal(0, p.EpisodesWatched);
        Assert.Equal(0d, p.CompletionRatio);
        Assert.Null(p.NextUp);
    }

    [Fact]
    public void Nada_visto_proximo_e_o_primeiro_em_ordem()
    {
        var eps = new[] { Ep(10, 2, 1), Ep(11, 1, 2), Ep(12, 1, 1) };
        var p = ProgressCalculator.Compute(eps, new HashSet<long>());

        Assert.Equal(3, p.EpisodesTotal);
        Assert.Equal(0, p.EpisodesWatched);
        Assert.NotNull(p.NextUp);
        Assert.Equal(12, p.NextUp!.Value.EpisodeId); // T1E1 vem primeiro mesmo desordenado na entrada
    }

    [Fact]
    public void Tudo_visto_completa_e_sem_proximo()
    {
        var eps = new[] { Ep(1, 1, 1), Ep(2, 1, 2) };
        var watched = new HashSet<long> { 1, 2 };
        var p = ProgressCalculator.Compute(eps, watched);

        Assert.Equal(2, p.EpisodesWatched);
        Assert.Equal(1d, p.CompletionRatio);
        Assert.Null(p.NextUp);
    }

    [Fact]
    public void Proximo_pula_os_vistos_e_respeita_ordem_entre_temporadas()
    {
        // T1 inteira vista; T2E1 vista; próximo deve ser T2E2.
        var eps = new[] { Ep(1, 1, 1), Ep(2, 1, 2), Ep(3, 2, 1), Ep(4, 2, 2) };
        var watched = new HashSet<long> { 1, 2, 3 };
        var p = ProgressCalculator.Compute(eps, watched);

        Assert.Equal(4, p.EpisodesTotal);
        Assert.Equal(3, p.EpisodesWatched);
        Assert.Equal(0.75d, p.CompletionRatio);
        Assert.Equal(4, p.NextUp!.Value.EpisodeId);
    }

    [Fact]
    public void Buraco_no_meio_proximo_e_o_primeiro_nao_visto()
    {
        // T1E1 e T1E3 vistos, T1E2 não: o próximo é o E2 (não o E4 seguinte).
        var eps = new[] { Ep(1, 1, 1), Ep(2, 1, 2), Ep(3, 1, 3), Ep(4, 1, 4) };
        var watched = new HashSet<long> { 1, 3 };
        var p = ProgressCalculator.Compute(eps, watched);

        Assert.Equal(2, p.NextUp!.Value.EpisodeId);
        Assert.Equal(1, p.NextUp!.Value.SeasonNumber);
        Assert.Equal(2, p.NextUp!.Value.EpisodeNumber);
    }
}
