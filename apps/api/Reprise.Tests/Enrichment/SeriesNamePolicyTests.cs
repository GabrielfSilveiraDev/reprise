using Reprise.Application.Enrichment;

namespace Reprise.Tests.Enrichment;

public class SeriesNamePolicyTests
{
    [Theory]
    [InlineData("How I Met Your Mother")]
    [InlineData("La casa de papel")]
    [InlineData("Låt den rätte komma in")]
    [InlineData("Sen Çal Kapımı")]
    [InlineData("Cô Gái Đến Từ Quá Khứ")] // Latin Extended Additional
    public void Original_em_alfabeto_latino_e_usado_como_esta(string original)
    {
        Assert.True(SeriesNamePolicy.IsLatinScript(original));
        Assert.Equal(original, SeriesNamePolicy.Choose(original, "Ignorado", "Ignorado"));
    }

    [Theory]
    [InlineData("ナルト- 疾風伝")] // japonês
    [InlineData("오징어 게임")] // coreano
    [InlineData("Слово пацана")] // cirílico
    [InlineData("三体")] // chinês
    public void Original_ilegivel_cai_para_o_ingles(string original)
    {
        Assert.False(SeriesNamePolicy.IsLatinScript(original));
        Assert.Equal("Naruto Shippuden", SeriesNamePolicy.Choose(original, "Naruto Shippuden", "provisório"));
    }

    [Fact]
    public void Nome_traduzido_nunca_e_escolhido_quando_ha_original_legivel()
    {
        // O caso que motivou a regra: antes disso a série aparecia como "Como Eu Conheci Sua Mãe".
        var escolhido = SeriesNamePolicy.Choose(
            originalName: "How I Met Your Mother",
            englishName: "How I Met Your Mother",
            fallback: "Como Eu Conheci Sua Mãe");

        Assert.Equal("How I Met Your Mother", escolhido);
    }

    [Fact]
    public void Sem_ingles_disponivel_o_original_ilegivel_ainda_e_melhor_que_o_fallback()
    {
        Assert.Equal("三体", SeriesNamePolicy.Choose("三体", englishName: null, fallback: "provisório"));
    }

    [Fact]
    public void Sem_nada_do_TMDB_sobra_o_fallback()
    {
        Assert.Equal("provisório", SeriesNamePolicy.Choose(null, null, "provisório"));
        Assert.Equal("provisório", SeriesNamePolicy.Choose("   ", "", "provisório"));
    }

    [Theory]
    [InlineData("9-1-1")]
    [InlineData("3%")]
    [InlineData("")]
    public void Texto_sem_letra_nenhuma_nao_conta_como_latino(string texto)
    {
        // Sem letra não há script para julgar; o caminho do inglês dá no mesmo resultado.
        Assert.False(SeriesNamePolicy.IsLatinScript(texto));
    }

    [Fact]
    public void Mistura_de_latino_com_nao_latino_conta_como_nao_latino()
    {
        // "Attack on Titan 進撃の巨人" tem parte ilegível: o inglês limpo é preferível.
        Assert.False(SeriesNamePolicy.IsLatinScript("Attack on Titan 進撃の巨人"));
    }
}
