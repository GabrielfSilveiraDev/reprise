using Reprise.Domain.Entities;
using Reprise.Domain.Enums;

namespace Reprise.Tests.Features;

/// <summary>
/// Quando uma estreia de temporada traz a série de volta para Assistindo — a regra pura, sem banco.
/// A passada que a aplica ao acervo inteiro está em <c>SeriesReturnsTests</c>.
/// </summary>
public sealed class SeriesReturnRuleTests
{
    private static readonly DateTimeOffset Entrada = new(2026, 9, 1, 12, 0, 0, TimeSpan.Zero);

    private static TrackedSeries Acompanhamento(SeriesStatus status, DateTimeOffset? mudanca = null) =>
        new() { Status = status, AddedAt = Entrada, StatusChangedAt = mudanca };

    [Fact]
    public void Concluida_e_arquivada_voltam_com_estreia_depois_da_ultima_exibicao()
    {
        var exibicao = new DateTimeOffset(2022, 9, 20, 23, 0, 0, TimeSpan.Zero);
        var estreia = new DateOnly(2026, 10, 20);

        Assert.True(Acompanhamento(SeriesStatus.Finished).ShouldReturnFor(estreia, exibicao));
        Assert.True(Acompanhamento(SeriesStatus.Archived).ShouldReturnFor(estreia, exibicao));
    }

    [Fact]
    public void Assistindo_e_para_depois_nunca_voltam()
    {
        var estreia = new DateOnly(2026, 10, 20);

        Assert.False(Acompanhamento(SeriesStatus.Following).ShouldReturnFor(estreia, null));
        Assert.False(Acompanhamento(SeriesStatus.ForLater).ShouldReturnFor(estreia, null));
    }

    [Fact]
    public void Vale_a_mais_recente_entre_a_ultima_exibicao_e_a_ultima_mudanca_de_estado()
    {
        var exibicao = new DateTimeOffset(2025, 1, 10, 12, 0, 0, TimeSpan.Zero);
        var mudanca = new DateTimeOffset(2026, 10, 21, 12, 0, 0, TimeSpan.Zero);
        var concluida = Acompanhamento(SeriesStatus.Finished, mudanca);

        // A temporada estreou entre as duas: você já a conhecia quando marcou Concluída de novo.
        Assert.False(concluida.ShouldReturnFor(new DateOnly(2026, 10, 20), exibicao));
        Assert.True(concluida.ShouldReturnFor(new DateOnly(2026, 10, 22), exibicao));

        // E ao contrário: assistir depois da mudança também é a sua última palavra.
        var antiga = Acompanhamento(SeriesStatus.Finished, new DateTimeOffset(2024, 1, 1, 0, 0, 0, TimeSpan.Zero));
        Assert.False(antiga.ShouldReturnFor(new DateOnly(2024, 6, 1), exibicao));
    }

    [Fact]
    public void Estreia_no_proprio_dia_da_decisao_nao_traz_de_volta()
    {
        // 23h em Brasília, já dia 21 em UTC — o dia da comparação é o UTC, como o "hoje" da API.
        var mudanca = new DateTimeOffset(2026, 10, 21, 2, 0, 0, TimeSpan.Zero);
        var concluida = Acompanhamento(SeriesStatus.Finished, mudanca);

        Assert.False(concluida.ShouldReturnFor(new DateOnly(2026, 10, 21), null));
        Assert.True(concluida.ShouldReturnFor(new DateOnly(2026, 10, 22), null));
    }

    [Fact]
    public void Sem_exibicao_nem_mudanca_registrada_vale_o_dia_em_que_entrou_no_acervo()
    {
        var concluida = Acompanhamento(SeriesStatus.Finished);

        Assert.False(concluida.ShouldReturnFor(DateOnly.FromDateTime(Entrada.UtcDateTime), null));
        Assert.True(concluida.ShouldReturnFor(DateOnly.FromDateTime(Entrada.UtcDateTime).AddDays(1), null));
    }

    [Fact]
    public void Voltar_marca_a_volta_e_mudar_a_mao_apaga()
    {
        var agora = new DateTimeOffset(2026, 10, 20, 15, 0, 0, TimeSpan.Zero);
        var serie = Acompanhamento(SeriesStatus.Finished);

        serie.ReturnForNewSeason(agora);
        Assert.Equal(SeriesStatus.Following, serie.Status);
        Assert.Equal(agora, serie.ReturnedAt);
        Assert.Equal(agora, serie.StatusChangedAt);

        // Repetir o estado atual não é decisão nova: nem conta como mudança nem apaga a volta.
        Assert.False(serie.ChangeStatus(SeriesStatus.Following, agora.AddHours(1)));
        Assert.Equal(agora, serie.ReturnedAt);

        Assert.True(serie.ChangeStatus(SeriesStatus.Finished, agora.AddDays(1)));
        Assert.Null(serie.ReturnedAt);
        Assert.Equal(agora.AddDays(1), serie.StatusChangedAt);
    }
}
