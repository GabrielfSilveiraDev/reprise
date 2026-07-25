using Reprise.Application.Features.Watching;

namespace Reprise.Tests.Features;

/// <summary>
/// A data de um episódio que o export perdeu é uma inferência, e inferência errada corrompe
/// silenciosamente as estatísticas temporais — o mesmo defeito que o backfill do TV Time causa.
/// </summary>
public class BackfillPlannerTests
{
    private static readonly DateTimeOffset Marco = new(2013, 3, 1, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Maio = new(2013, 5, 1, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Hoje = new(2026, 7, 25, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Distribui_entre_os_vizinhos_em_ordem_crescente()
    {
        var datas = BackfillPlanner.Distribute(Marco, Maio, 24, Hoje);

        Assert.Equal(24, datas.Count);
        Assert.Equal(datas.OrderBy(d => d), datas);
    }

    [Fact]
    public void Nenhum_evento_cai_exatamente_sobre_os_limites()
    {
        // Igualar o limite deixaria ambíguo se o episódio veio antes ou depois do vizinho.
        var datas = BackfillPlanner.Distribute(Marco, Maio, 5, Hoje);

        Assert.All(datas, d => Assert.True(d > Marco && d < Maio));
    }

    [Fact]
    public void Distribui_uniformemente_dentro_da_janela()
    {
        var datas = BackfillPlanner.Distribute(Marco, Maio, 3, Hoje);
        var intervalos = datas.Zip(datas.Skip(1), (a, b) => b - a).ToList();

        Assert.All(intervalos, i => Assert.Equal(intervalos[0], i));
    }

    [Fact]
    public void Sem_vizinho_posterior_projeta_para_frente_a_partir_do_anterior()
    {
        var datas = BackfillPlanner.Distribute(Marco, before: null, count: 10, Hoje);

        Assert.All(datas, d => Assert.True(d > Marco));
        Assert.True(datas[^1] < Marco.AddDays(11));
    }

    [Fact]
    public void Sem_vizinho_anterior_projeta_para_tras_a_partir_do_posterior()
    {
        var datas = BackfillPlanner.Distribute(after: null, before: Maio, count: 10, Hoje);

        Assert.All(datas, d => Assert.True(d < Maio));
    }

    [Fact]
    public void Sem_vizinho_nenhum_ancora_no_fallback_e_NAO_no_futuro()
    {
        // Sem referência alguma, o pior resultado possível seria empilhar tudo em "hoje".
        var datas = BackfillPlanner.Distribute(after: null, before: null, count: 6, Hoje);

        Assert.All(datas, d => Assert.True(d < Hoje));
    }

    [Fact]
    public void Vizinhos_fora_de_ordem_nao_produzem_intervalo_negativo()
    {
        // Acontece de verdade: um rewatch recente deixa a data da temporada anterior à frente.
        var datas = BackfillPlanner.Distribute(after: Maio, before: Marco, count: 4, Hoje);

        Assert.Equal(4, datas.Count);
        Assert.Equal(datas.OrderBy(d => d), datas);
        Assert.All(datas, d => Assert.True(d > Maio));
    }

    [Fact]
    public void Zero_episodios_nao_gera_evento()
    {
        Assert.Empty(BackfillPlanner.Distribute(Marco, Maio, 0, Hoje));
    }
}
