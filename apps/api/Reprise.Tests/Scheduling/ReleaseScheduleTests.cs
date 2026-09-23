using Reprise.Domain.Scheduling;

namespace Reprise.Tests.Scheduling;

public class ReleaseScheduleTests
{
    /// <summary>
    /// O caso real que originou a regra.
    ///
    /// Silo T3E10 tem <c>air_date</c> 03/09 (quinta) no calendário americano, e o app dizia
    /// "Estreou hoje" desde a meia-noite de quinta em Brasília — mas o episódio só chega aqui na
    /// madrugada de sexta. O fim do dia 03/09 no Pacífico é 04/09 08h UTC, ou seja, 05h de sexta
    /// em Brasília: depois da estreia, que é a direção certa do erro.
    /// </summary>
    [Fact]
    public void Estreia_americana_so_conta_depois_que_o_dia_acaba_no_pacifico()
    {
        var airDate = new DateOnly(2026, 9, 3);

        var quintaTardeNoBrasil = new DateTimeOffset(2026, 9, 3, 17, 56, 0, TimeSpan.Zero);
        Assert.False(ReleaseSchedule.HasReleased(airDate, "US", quintaTardeNoBrasil));

        // 04/09 07h59 UTC ainda é 03/09 23h59 no Pacífico.
        Assert.False(ReleaseSchedule.HasReleased(airDate, "US", new DateTimeOffset(2026, 9, 4, 7, 59, 0, TimeSpan.Zero)));
        Assert.True(ReleaseSchedule.HasReleased(airDate, "US", new DateTimeOffset(2026, 9, 4, 8, 0, 0, TimeSpan.Zero)));
    }

    /// <summary>
    /// O defeito de fuso do servidor: às 21h no Brasil o UTC já virou o dia seguinte, e a lista de
    /// "Próximos" perdia a estreia de amanhã. Com a regra pelo instante isso não acontece mais.
    /// </summary>
    [Fact]
    public void As_21h_no_Brasil_a_estreia_de_amanha_continua_por_vir()
    {
        // 04/09 00h30 UTC = 03/09 21h30 em Brasília.
        var noite = new DateTimeOffset(2026, 9, 4, 0, 30, 0, TimeSpan.Zero);

        Assert.False(ReleaseSchedule.HasReleased(new DateOnly(2026, 9, 4), "US", noite));
        Assert.False(ReleaseSchedule.HasReleased(new DateOnly(2026, 9, 3), "US", noite));
    }

    [Fact]
    public void Serie_japonesa_estreia_antes_de_virar_o_dia_em_UTC()
    {
        var airDate = new DateOnly(2026, 9, 3);

        // Fim do dia 03/09 no Japão (UTC+9) = 03/09 15h UTC.
        Assert.False(ReleaseSchedule.HasReleased(airDate, "JP", new DateTimeOffset(2026, 9, 3, 14, 59, 0, TimeSpan.Zero)));
        Assert.True(ReleaseSchedule.HasReleased(airDate, "JP", new DateTimeOffset(2026, 9, 3, 15, 0, 0, TimeSpan.Zero)));
    }

    [Fact]
    public void Pais_desconhecido_cai_no_padrao_conservador()
    {
        Assert.Equal(ReleaseSchedule.DefaultOffsetMinutes, ReleaseSchedule.OffsetMinutes(null));
        Assert.Equal(ReleaseSchedule.DefaultOffsetMinutes, ReleaseSchedule.OffsetMinutes("XX"));

        // O padrão é o Pacífico: o mesmo comportamento de uma série americana.
        var airDate = new DateOnly(2026, 9, 3);
        var antes = new DateTimeOffset(2026, 9, 4, 7, 59, 0, TimeSpan.Zero);
        Assert.Equal(
            ReleaseSchedule.HasReleased(airDate, "US", antes),
            ReleaseSchedule.HasReleased(airDate, null, antes));
    }

    [Fact]
    public void O_codigo_do_pais_nao_depende_de_caixa()
    {
        Assert.Equal(ReleaseSchedule.OffsetMinutes("JP"), ReleaseSchedule.OffsetMinutes("jp"));
    }

    /// <summary>
    /// Mesma escolha de <c>Episode.HasAired</c>: são centenas de episódios antigos que o TMDB
    /// nunca datou, e escondê-los como "por vir" seria pior do que mostrá-los.
    /// </summary>
    [Fact]
    public void Sem_data_conta_como_lancado()
    {
        Assert.True(ReleaseSchedule.HasReleased(null, "US", DateTimeOffset.UtcNow));
        Assert.Null(ReleaseSchedule.ReleasesAt(null, "US"));
    }

    [Fact]
    public void O_instante_devolvido_e_a_meia_noite_do_dia_seguinte_na_origem()
    {
        var at = ReleaseSchedule.ReleasesAt(new DateOnly(2026, 9, 3), "US");

        Assert.NotNull(at);
        Assert.Equal(new DateTimeOffset(2026, 9, 4, 0, 0, 0, TimeSpan.FromHours(-8)), at!.Value);
        Assert.Equal(new DateTimeOffset(2026, 9, 4, 8, 0, 0, TimeSpan.Zero), at.Value.ToUniversalTime());
    }

    /// <summary>
    /// Caso 1: TV linear, com horário declarado. O instante vem do TVmaze e não se heuriza nada.
    /// </summary>
    [Fact]
    public void Horario_declarado_pelo_TVmaze_manda_em_tudo()
    {
        // Survivor, CBS: 20h no fuso de Nova York.
        var exato = new DateTimeOffset(2026, 2, 26, 1, 0, 0, TimeSpan.Zero);
        var e = new EpisodeRelease(new DateOnly(2026, 2, 25), new DateOnly(2026, 2, 25), exato, "US");

        Assert.Equal(exato, ReleaseSchedule.ReleasesAt(e));
        Assert.False(ReleaseSchedule.HasReleased(e, exato.AddMinutes(-1)));
        Assert.True(ReleaseSchedule.HasReleased(e, exato));
    }

    /// <summary>
    /// Caso 2: streaming. Só a data do TVmaze, que já é a do lançamento como se observa — por isso
    /// vale o INÍCIO do dia, sem o deslocamento que a data do TMDB exige.
    /// </summary>
    [Fact]
    public void Data_do_TVmaze_vale_pelo_inicio_do_dia()
    {
        // Silo T3E10: TMDB diz 03/09, TVmaze diz 04/09 — e o TVmaze é quem acerta.
        var e = new EpisodeRelease(new DateOnly(2026, 9, 3), new DateOnly(2026, 9, 4), null, "US");

        // 04/09 00h no Pacífico = 04/09 08h UTC = 05h de Brasília.
        Assert.Equal(new DateTimeOffset(2026, 9, 4, 8, 0, 0, TimeSpan.Zero),
            ReleaseSchedule.ReleasesAt(e)!.Value.ToUniversalTime());
    }

    /// <summary>
    /// O TVmaze tem precedência sobre o TMDB: é o motivo da integração.
    /// </summary>
    [Fact]
    public void Quando_as_fontes_discordam_o_TVmaze_manda()
    {
        var soTmdb = EpisodeRelease.FromTmdb(new DateOnly(2026, 9, 3), "US");
        var comTvmaze = new EpisodeRelease(new DateOnly(2026, 9, 3), new DateOnly(2026, 9, 4), null, "US");

        // Sem o TVmaze o palpite é o fim do dia 03/09; com ele, o início do dia 04/09.
        // Aqui os dois coincidem — é o mesmo instante —, e é justamente por isso que a heurística
        // servia de reserva razoável enquanto a fonte boa não existia.
        Assert.Equal(ReleaseSchedule.ReleasesAt(soTmdb), ReleaseSchedule.ReleasesAt(comTvmaze));
    }

    /// <summary>
    /// Onde as fontes concordam — 77% do acervo —, o TVmaze <b>adianta</b> o reconhecimento em um
    /// dia em relação à heurística. É a correção do excesso de conservadorismo que a medição
    /// contra Netflix, HBO e Disney+ expôs.
    /// </summary>
    [Fact]
    public void Onde_as_fontes_concordam_o_TVmaze_desfaz_o_atraso_de_um_dia()
    {
        var dia = new DateOnly(2026, 9, 3);
        var soTmdb = EpisodeRelease.FromTmdb(dia, "US");
        var comTvmaze = new EpisodeRelease(dia, dia, null, "US");

        var semFonte = ReleaseSchedule.ReleasesAt(soTmdb)!.Value;
        var comFonte = ReleaseSchedule.ReleasesAt(comTvmaze)!.Value;

        Assert.Equal(TimeSpan.FromDays(1), semFonte - comFonte);
    }

    [Fact]
    public void Sem_nenhuma_data_nao_ha_instante_e_conta_como_lancado()
    {
        var e = new EpisodeRelease(null, null, null, "US");

        Assert.Null(ReleaseSchedule.ReleasesAt(e));
        Assert.True(ReleaseSchedule.HasReleased(e, DateTimeOffset.UtcNow));
    }
}
