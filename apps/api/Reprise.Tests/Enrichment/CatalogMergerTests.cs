using Reprise.Application.Enrichment;

namespace Reprise.Tests.Enrichment;

public class CatalogMergerTests
{
    private static ExistingEpisode Local(long id, int s, int e, int? runtime = 2700, bool estimated = false)
        => new(id, s, e, runtime, estimated);

    private static TmdbEpisodeInput Remote(int s, int e, int? runtimeSeconds = 2700, string? name = null)
        => new(TmdbId: 1000 + s * 100 + e, s, e, name ?? $"T{s}E{e}", new DateOnly(2020, 1, 1), runtimeSeconds);

    [Fact]
    public void Episodios_nao_assistidos_do_TMDB_viram_criacoes()
    {
        // O export só tinha T1E1; o TMDB conhece a temporada inteira.
        var local = new[] { Local(1, 1, 1) };
        var remote = new[] { Remote(1, 1), Remote(1, 2), Remote(1, 3) };

        var plan = CatalogMerger.Plan(local, [1], remote, seriesAverageRuntimeSeconds: 2700);

        Assert.Equal(2, plan.EpisodesToCreate.Count);
        Assert.Equal([2, 3], plan.EpisodesToCreate.Select(e => e.EpisodeNumber).Order());
        Assert.Single(plan.EpisodeUpdates);
        Assert.Equal(1, plan.EpisodeUpdates[0].EpisodeId);
    }

    [Fact]
    public void Episodio_local_ausente_no_TMDB_nao_e_removido_e_e_reportado()
    {
        // INVARIANTE CRÍTICO: apagar este episódio derrubaria os watch_events dele em cascata.
        var local = new[] { Local(1, 1, 1), Local(2, 1, 2), Local(3, 99, 1) };
        var remote = new[] { Remote(1, 1), Remote(1, 2) };

        var plan = CatalogMerger.Plan(local, [1, 99], remote, 2700);

        Assert.Equal(1, plan.EpisodesNotFoundInTmdb);
        Assert.Equal(2, plan.EpisodeUpdates.Count);
        Assert.DoesNotContain(3L, plan.EpisodeUpdates.Select(u => u.EpisodeId));
        Assert.Empty(plan.EpisodesToCreate);
    }

    [Fact]
    public void Runtime_vindo_do_export_prevalece_sobre_o_TMDB()
    {
        // 1500s é o que o TV Time registrou e com o que as estatísticas do usuário sempre foram contadas.
        var local = new[] { Local(1, 1, 1, runtime: 1500) };
        var remote = new[] { Remote(1, 1, runtimeSeconds: 2700) };

        var plan = CatalogMerger.Plan(local, [1], remote, 2700);

        Assert.Equal(1500, plan.EpisodeUpdates[0].RuntimeSeconds);
        Assert.False(plan.EpisodeUpdates[0].RuntimeEstimated);
        Assert.Equal(0, plan.RuntimesFilled);
    }

    [Fact]
    public void Runtime_nulo_e_preenchido_pelo_TMDB_e_nao_conta_como_estimativa()
    {
        var local = new[] { Local(1, 1, 1, runtime: null) };
        var remote = new[] { Remote(1, 1, runtimeSeconds: 2700) };

        var plan = CatalogMerger.Plan(local, [1], remote, 3000);

        Assert.Equal(2700, plan.EpisodeUpdates[0].RuntimeSeconds);
        Assert.False(plan.EpisodeUpdates[0].RuntimeEstimated); // valor real do episódio, não chute
        Assert.Equal(1, plan.RuntimesFilled);
    }

    [Fact]
    public void Sem_runtime_em_lugar_nenhum_cai_na_media_da_serie_e_marca_estimado()
    {
        var local = new[] { Local(1, 1, 1, runtime: null) };
        var remote = new[] { Remote(1, 1, runtimeSeconds: null) };

        var plan = CatalogMerger.Plan(local, [1], remote, seriesAverageRuntimeSeconds: 3000);

        Assert.Equal(3000, plan.EpisodeUpdates[0].RuntimeSeconds);
        Assert.True(plan.EpisodeUpdates[0].RuntimeEstimated);
        Assert.Equal(1, plan.RuntimesFilled);
    }

    [Fact]
    public void Sem_runtime_em_lugar_nenhum_o_campo_continua_nulo()
    {
        var local = new[] { Local(1, 1, 1, runtime: null) };
        var remote = new[] { Remote(1, 1, runtimeSeconds: null) };

        var plan = CatalogMerger.Plan(local, [1], remote, seriesAverageRuntimeSeconds: null);

        Assert.Null(plan.EffectiveAverageRuntimeSeconds);
        Assert.Null(plan.EpisodeUpdates[0].RuntimeSeconds);
        Assert.False(plan.EpisodeUpdates[0].RuntimeEstimated);
        Assert.Equal(0, plan.RuntimesFilled);
    }

    [Fact]
    public void Sem_media_declarada_pelo_TMDB_a_mediana_dos_episodios_remotos_vira_o_fallback()
    {
        // Caso real: o TMDB não declara episode_run_time para várias séries (HIMYM entre elas).
        var remote = new[] { Remote(1, 1, 1200), Remote(1, 2, 1500), Remote(1, 3, 1400), Remote(0, 1, null) };

        var plan = CatalogMerger.Plan([], [], remote, seriesAverageRuntimeSeconds: null);

        Assert.Equal(1400, plan.EffectiveAverageRuntimeSeconds); // mediana de 1200/1400/1500
        var special = plan.EpisodesToCreate.Single(e => e.SeasonNumber == 0);
        Assert.Equal(1400, special.RuntimeSeconds);
        Assert.True(special.RuntimeEstimated);
    }

    [Fact]
    public void Sem_nada_no_TMDB_a_mediana_do_export_local_vira_o_fallback()
    {
        // Último recurso: os runtimes que o próprio TV Time registrou são dado real do usuário.
        var local = new[] { Local(1, 1, 1, 2700), Local(2, 1, 2, 2700), Local(3, 1, 3, 2700) };
        var remote = new[] { Remote(1, 1, null), Remote(1, 2, null), Remote(1, 3, null), Remote(1, 4, null) };

        var plan = CatalogMerger.Plan(local, [1], remote, seriesAverageRuntimeSeconds: null);

        Assert.Equal(2700, plan.EffectiveAverageRuntimeSeconds);
        var novo = Assert.Single(plan.EpisodesToCreate);
        Assert.Equal(2700, novo.RuntimeSeconds);
        Assert.True(novo.RuntimeEstimated);
    }

    [Fact]
    public void Media_declarada_pelo_TMDB_tem_precedencia_sobre_as_medianas()
    {
        var local = new[] { Local(1, 1, 1, 2700) };
        var remote = new[] { Remote(1, 1, 1200), Remote(1, 2, null) };

        var plan = CatalogMerger.Plan(local, [1], remote, seriesAverageRuntimeSeconds: 1800);

        Assert.Equal(1800, plan.EffectiveAverageRuntimeSeconds);
        Assert.Equal(1800, plan.EpisodesToCreate.Single().RuntimeSeconds);
    }

    [Fact]
    public void Temporada_nova_do_TMDB_e_criada_uma_unica_vez()
    {
        var local = new[] { Local(1, 1, 1) };
        var remote = new[] { Remote(2, 1), Remote(2, 2), Remote(3, 1) };

        var plan = CatalogMerger.Plan(local, [1], remote, 2700);

        Assert.Equal([2, 3], plan.SeasonsToCreate.Order());
        Assert.Equal(3, plan.EpisodesToCreate.Count);
    }

    [Fact]
    public void Especiais_vem_como_temporada_zero_e_marcados()
    {
        var local = Array.Empty<ExistingEpisode>();
        var remote = new[] { Remote(0, 1), Remote(1, 1) };

        var plan = CatalogMerger.Plan(local, [], remote, 2700);

        var special = plan.EpisodesToCreate.Single(e => e.SeasonNumber == 0);
        var regular = plan.EpisodesToCreate.Single(e => e.SeasonNumber == 1);
        Assert.True(special.IsSpecial);
        Assert.False(regular.IsSpecial);
        Assert.Contains(0, plan.SeasonsToCreate);
    }

    [Fact]
    public void Reexecutar_sobre_o_catalogo_ja_completo_nao_cria_nada()
    {
        // Idempotência: a segunda passada só atualiza metadados, sem inserir nem perder nada.
        var remote = new[] { Remote(1, 1), Remote(1, 2), Remote(0, 1) };
        var local = new[] { Local(1, 1, 1), Local(2, 1, 2), Local(3, 0, 1) };

        var plan = CatalogMerger.Plan(local, [0, 1], remote, 2700);

        Assert.Empty(plan.EpisodesToCreate);
        Assert.Empty(plan.SeasonsToCreate);
        Assert.Equal(3, plan.EpisodeUpdates.Count);
        Assert.Equal(0, plan.EpisodesNotFoundInTmdb);
    }

    [Fact]
    public void Catalogo_local_vazio_traz_a_serie_inteira()
    {
        var remote = new[] { Remote(1, 1), Remote(1, 2), Remote(2, 1) };

        var plan = CatalogMerger.Plan([], [], remote, 2700);

        Assert.Equal(3, plan.EpisodesToCreate.Count);
        Assert.Equal([1, 2], plan.SeasonsToCreate.Order());
        Assert.Empty(plan.EpisodeUpdates);
        Assert.Equal(0, plan.EpisodesNotFoundInTmdb);
    }


    [Fact]
    public void Episodio_duplo_isolado_nao_dispara_a_divergencia()
    {
        // Caso Friends/The Office: o TMDB funde alguns episódios duplos. Uns poucos sem par
        // é ruído normal, não incompatibilidade de numeração — o catálogo deve ser completado.
        var local = Enumerable.Range(1, 20).Select(i => Local(i, 1, i)).ToArray();
        var remote = Enumerable.Range(1, 19).Select(i => Remote(1, i))
            .Concat([Remote(1, 21), Remote(1, 22)]).ToArray();

        var plan = CatalogMerger.Plan(local, [1], remote, 1400);

        Assert.False(plan.AlignedByOrder); // 1 de 20 = 5%
        Assert.Equal(1, plan.EpisodesNotFoundInTmdb);
        Assert.Equal(2, plan.EpisodesToCreate.Count);
    }


    [Fact]
    public void Amostra_local_pequena_demais_nao_dispara_a_divergencia()
    {
        // Com 1 episódio local, um único descasamento daria 100% — razão sem significado estatístico.
        var local = new[] { Local(1, 1, 1) };
        var remote = new[] { Remote(2, 1), Remote(2, 2) };

        var plan = CatalogMerger.Plan(local, [1], remote, 1400);

        Assert.False(plan.AlignedByOrder);
        Assert.Equal(2, plan.EpisodesToCreate.Count);
    }

    [Fact]
    public void Catalogo_local_vazio_nunca_conta_como_divergencia()
    {
        // Série nova, sem nada local: não há numeração para comparar — o TMDB entra inteiro.
        var remote = Enumerable.Range(1, 10).Select(i => Remote(1, i)).ToArray();

        var plan = CatalogMerger.Plan([], [], remote, 1400);

        Assert.False(plan.AlignedByOrder);
        Assert.Equal(10, plan.EpisodesToCreate.Count);
    }

    [Fact]
    public void Numeracao_incompativel_alinha_pela_ordem_de_exibicao()
    {
        // Caso Naruto Shippuden: o TVDB reparte em muitas temporadas, o TMDB usa outra numeração.
        // Quem viu do 1 ao 20 na ordem local deve ficar com os 20 primeiros do TMDB.
        var local = Enumerable.Range(1, 20).Select(i => Local(i, 2, i)).ToArray();
        var remote = Enumerable.Range(1, 30).Select(i => Remote(1, i)).ToArray();

        var plan = CatalogMerger.Plan(local, [2], remote, 1400);

        Assert.True(plan.AlignedByOrder);
        Assert.Equal(20, plan.EpisodeRenumbers.Count);

        // 1º local -> 1º do TMDB, 20º local -> 20º do TMDB.
        var primeiro = plan.EpisodeRenumbers.Single(r => r.EpisodeId == 1);
        var ultimo = plan.EpisodeRenumbers.Single(r => r.EpisodeId == 20);
        Assert.Equal((1, 1), (primeiro.NewSeasonNumber, primeiro.NewEpisodeNumber));
        Assert.Equal((1, 20), (ultimo.NewSeasonNumber, ultimo.NewEpisodeNumber));

        // Os 10 restantes do TMDB entram como não assistidos.
        Assert.Equal(10, plan.EpisodesToCreate.Count);
        Assert.Equal(Enumerable.Range(21, 10), plan.EpisodesToCreate.Select(e => e.EpisodeNumber).Order());
    }

    [Fact]
    public void Alinhamento_por_ordem_atravessa_fronteiras_de_temporada()
    {
        // Local: T1 com 3 episódios + T2 com 2 => ordem 1,2,3,4,5.
        // Remoto: uma única temporada de 5. O 4º local (T2E1) deve virar o 4º remoto.
        var local = new[] { Local(1, 1, 1), Local(2, 1, 2), Local(3, 1, 3), Local(4, 2, 1), Local(5, 2, 2) };
        var remote = Enumerable.Range(1, 5).Select(i => Remote(1, i)).ToArray();

        var plan = CatalogMerger.Plan(local, [1, 2], remote, 1400);

        Assert.True(plan.AlignedByOrder);
        var quarto = plan.EpisodeRenumbers.Single(r => r.EpisodeId == 4);
        Assert.Equal((1, 4), (quarto.NewSeasonNumber, quarto.NewEpisodeNumber));
        var quinto = plan.EpisodeRenumbers.Single(r => r.EpisodeId == 5);
        Assert.Equal((1, 5), (quinto.NewSeasonNumber, quinto.NewEpisodeNumber));
        Assert.Empty(plan.EpisodesToCreate);
    }

    [Fact]
    public void Buraco_no_meio_e_preservado_como_pulo_e_nao_comprimido()
    {
        // Viu do 1 ao 5 e depois do 8 ao 10 da T3 local, que o TMDB numera como T1.
        // O 8º da ordem precisa cair no 8º remoto — não no 6º, que seria comprimir o buraco.
        var local = Enumerable.Range(1, 5).Select(i => Local(i, 3, i))
            .Concat(Enumerable.Range(8, 3).Select(i => Local(i, 3, i))).ToArray();
        var remote = Enumerable.Range(1, 10).Select(i => Remote(1, i)).ToArray();

        var plan = CatalogMerger.Plan(local, [3], remote, 1400);

        Assert.True(plan.AlignedByOrder);
        var oitavo = plan.EpisodeRenumbers.Single(r => r.EpisodeId == 8);
        Assert.Equal(8, oitavo.NewEpisodeNumber);

        // Os pulados (6 e 7) entram como não assistidos, preservando o buraco.
        Assert.Equal([6, 7], plan.EpisodesToCreate.Select(e => e.EpisodeNumber).Order());
    }

    [Fact]
    public void Ordem_local_maior_que_o_catalogo_do_TMDB_preserva_o_excedente()
    {
        // O TMDB conhece menos episódios do que a ordem local alcança: o excedente fica intocado.
        var local = Enumerable.Range(1, 20).Select(i => Local(i, 3, i)).ToArray();
        var remote = Enumerable.Range(1, 12).Select(i => Remote(1, i)).ToArray();

        var plan = CatalogMerger.Plan(local, [3], remote, 1400);

        Assert.True(plan.AlignedByOrder);
        Assert.Equal(12, plan.EpisodeRenumbers.Count);
        Assert.Equal(8, plan.EpisodesNotFoundInTmdb);
        Assert.Empty(plan.EpisodesToCreate);
    }

    [Fact]
    public void Especiais_ficam_fora_da_ordem_linear()
    {
        // Especial não pertence à sequência de exibição: casa por número, não por posição.
        var local = Enumerable.Range(1, 10).Select(i => Local(i, 4, i))
            .Concat([Local(99, 0, 1)]).ToArray();
        var remote = Enumerable.Range(1, 10).Select(i => Remote(1, i))
            .Concat([Remote(0, 1), Remote(0, 2)]).ToArray();

        var plan = CatalogMerger.Plan(local, [0, 4], remote, 1400);

        Assert.True(plan.AlignedByOrder);
        Assert.Equal(10, plan.EpisodeRenumbers.Count);
        Assert.DoesNotContain(99L, plan.EpisodeRenumbers.Select(r => r.EpisodeId));

        // O especial local casou por número e o outro entrou como novo.
        Assert.Equal(99, Assert.Single(plan.EpisodeUpdates).EpisodeId);
        var novoEspecial = Assert.Single(plan.EpisodesToCreate);
        Assert.True(novoEspecial.IsSpecial);
        Assert.Equal(2, novoEspecial.EpisodeNumber);
    }

    [Fact]
    public void Reposicionamento_preserva_a_identidade_de_cada_episodio()
    {
        // O id não muda em nenhuma hipótese — é o que mantém os watch_events pendurados.
        var local = Enumerable.Range(1, 20).Select(i => Local(i, 5, i)).ToArray();
        var remote = Enumerable.Range(1, 20).Select(i => Remote(2, i)).ToArray();

        var plan = CatalogMerger.Plan(local, [5], remote, 1400);

        Assert.Equal(
            Enumerable.Range(1, 20).Select(i => (long)i),
            plan.EpisodeRenumbers.Select(r => r.EpisodeId).Order());
    }

    [Fact]
    public void Metadados_do_episodio_existente_sao_atualizados_preservando_a_identidade()
    {
        var local = new[] { Local(42, 3, 7) };
        var remote = new[] { Remote(3, 7, name: "O Retorno") };

        var plan = CatalogMerger.Plan(local, [3], remote, 2700);

        var u = Assert.Single(plan.EpisodeUpdates);
        Assert.Equal(42, u.EpisodeId); // mesmo id => watch_events continuam pendurados nele
        Assert.Equal("O Retorno", u.Name);
        Assert.Equal(new DateOnly(2020, 1, 1), u.AirDate);
        Assert.Equal(1307, u.TmdbId);
    }
}
