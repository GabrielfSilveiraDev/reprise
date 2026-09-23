using Microsoft.EntityFrameworkCore;
using Reprise.Application.Features.Watching;
using Reprise.Domain.Entities;
using Reprise.Domain.Enums;
using Reprise.Infrastructure.Persistence;

namespace Reprise.Tests.Integration;

/// <summary>
/// Os comandos de marcação, contra um Postgres de verdade.
///
/// <b>O que estes testes protegem.</b> Que nenhum caminho de escrita crie exibição de episódio que
/// ainda não foi ao ar. São três portas — o episódio avulso, a temporada inteira e o "marcar até
/// aqui" — e fechar só a primeira não resolveria: "marcar temporada" na Silo criaria de uma vez os
/// seis episódios que estreiam entre agosto e setembro, e sem barulho nenhum.
/// </summary>
public sealed class WatchingServiceTests : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private readonly PostgresFixture _pg;
    private readonly Guid _eu = Guid.NewGuid();

    public WatchingServiceTests(PostgresFixture pg) => _pg = pg;

    public async Task InitializeAsync()
    {
        await using var db = _pg.CreateContext(_eu);
        await db.Database.ExecuteSqlRawAsync(
            "TRUNCATE watch_events, tracked_series, episodes, seasons, series RESTART IDENTITY CASCADE");
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Marcar_episodio_que_ainda_nao_estreou_e_recusado()
    {
        var ids = await SemearAsync(("Dias atrás", -3), ("Semana que vem", 7));

        await using var db = _pg.CreateContext(_eu);
        var resultado = await Servico(db).MarkAsync(ids["Semana que vem"], watchedAt: null);

        Assert.Equal(MarkRefusal.NotAiredYet, resultado.Refusal);
        Assert.Null(resultado.State);
        Assert.Equal(0, await db.WatchEvents.CountAsync());
    }

    /// <summary>
    /// O caso do Silo T3E10: <c>air_date</c> é hoje no calendário americano, mas o dia ainda não
    /// terminou lá — a tela diz "Estreia amanhã", e o botão tem de concordar com a tela.
    /// </summary>
    [Fact]
    public async Task Marcar_episodio_de_hoje_que_ainda_nao_saiu_na_origem_e_recusado()
    {
        var ids = await SemearAsync(("Hoje", 0));

        await using var db = _pg.CreateContext(_eu);
        var resultado = await Servico(db).MarkAsync(ids["Hoje"], watchedAt: null);

        Assert.Equal(MarkRefusal.NotAiredYet, resultado.Refusal);
        Assert.Equal(0, await db.WatchEvents.CountAsync());
    }

    [Fact]
    public async Task Marcar_episodio_ja_exibido_continua_funcionando()
    {
        var ids = await SemearAsync(("Dias atrás", -3));

        await using var db = _pg.CreateContext(_eu);
        var resultado = await Servico(db).MarkAsync(ids["Dias atrás"], watchedAt: null);

        Assert.Equal(MarkRefusal.None, resultado.Refusal);
        Assert.Equal(1, resultado.State!.WatchCount);
    }

    [Fact]
    public async Task Marcar_episodio_sem_data_continua_funcionando()
    {
        var ids = await SemearAsync(("Sem data", null));

        await using var db = _pg.CreateContext(_eu);
        var resultado = await Servico(db).MarkAsync(ids["Sem data"], watchedAt: null);

        Assert.Equal(MarkRefusal.None, resultado.Refusal);
        Assert.Equal(1, resultado.State!.WatchCount);
    }

    [Fact]
    public async Task Marcar_com_data_no_futuro_e_recusado()
    {
        var ids = await SemearAsync(("Dias atrás", -3));

        await using var db = _pg.CreateContext(_eu);
        var resultado = await Servico(db).MarkAsync(ids["Dias atrás"], DateTimeOffset.UtcNow.AddDays(30));

        Assert.Equal(MarkRefusal.WatchedInTheFuture, resultado.Refusal);
        Assert.Equal(0, await db.WatchEvents.CountAsync());
    }

    [Fact]
    public async Task Relogio_adiantado_nao_derruba_a_marcacao()
    {
        // Celular meia hora à frente é comum; recusar por isso seria trocar um defeito por outro.
        var ids = await SemearAsync(("Dias atrás", -3));

        await using var db = _pg.CreateContext(_eu);
        var resultado = await Servico(db).MarkAsync(ids["Dias atrás"], DateTimeOffset.UtcNow.AddMinutes(30));

        Assert.Equal(MarkRefusal.None, resultado.Refusal);
    }

    [Fact]
    public async Task Marcar_a_temporada_pula_em_silencio_o_que_ainda_nao_estreou()
    {
        // E2 três dias atrás, e não ontem: "ontem" em UTC ainda não saiu no Pacífico entre 0h e 8h
        // UTC, e o teste passava ou falhava conforme a hora em que a suíte rodava.
        var ids = await SemearAsync(("E1", -30), ("E2", -3), ("E3", 7), ("E4", 14));
        var serie = await SerieIdAsync();

        await using var db = _pg.CreateContext(_eu);
        var marcados = await Servico(db).MarkSeasonAsync(serie, seasonNumber: 1, watchedAt: null);

        // Dois, não quatro: "pus a temporada em dia" é uma afirmação sobre o que já existe.
        Assert.Equal(2, marcados);
        var vistos = await db.WatchEvents.Select(w => w.EpisodeId).ToListAsync();
        Assert.Equivalent(new[] { ids["E1"], ids["E2"] }, vistos);
    }

    [Fact]
    public async Task Marcar_ate_aqui_tambem_para_na_data_de_hoje()
    {
        var ids = await SemearAsync(("E1", -30), ("E2", 7));
        var serie = await SerieIdAsync();

        await using var db = _pg.CreateContext(_eu);
        // Pedir "até o E2" quando o E2 só estreia semana que vem: marca o que dá, não o que foi pedido.
        var marcados = await Servico(db).MarkUpToAsync(serie, seasonNumber: 1, episodeNumber: 2, watchedAt: null);

        Assert.Equal(1, marcados);
        Assert.Equal(ids["E1"], await db.WatchEvents.Select(w => w.EpisodeId).SingleAsync());
    }

    // ---- apoio -----------------------------------------------------------------------------

    private WatchingService Servico(RepriseDbContext db) => new(db, new PostgresFixture.FixedUser(_eu));

    private async Task<long> SerieIdAsync()
    {
        await using var db = _pg.CreateContext(_eu);
        return await db.Series.Select(s => s.Id).SingleAsync();
    }

    /// <summary>Uma série com episódios na temporada 1, datados em dias relativos a hoje.</summary>
    private async Task<Dictionary<string, long>> SemearAsync(params (string Nome, int? DiasDeHoje)[] eps)
    {
        await using var db = _pg.CreateContext(_eu);
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);

        // País declarado de propósito: sem ele a regra de lançamento cai no padrão, e o teste
        // passaria a depender do fuso do padrão em vez de afirmar algo sobre a série.
        var serie = new Series { Name = "Série de teste", OriginCountry = "US" };
        db.Series.Add(serie);
        await db.SaveChangesAsync();

        var temporada = new Season { SeriesId = serie.Id, SeasonNumber = 1 };
        db.Seasons.Add(temporada);
        await db.SaveChangesAsync();

        var numero = 1;
        foreach (var (nome, dias) in eps)
        {
            db.Episodes.Add(new Episode
            {
                SeriesId = serie.Id,
                SeasonId = temporada.Id,
                SeasonNumber = 1,
                EpisodeNumber = numero++,
                Name = nome,
                AirDate = dias is null ? null : hoje.AddDays(dias.Value),
            });
        }

        db.TrackedSeries.Add(new TrackedSeries
        {
            UserId = _eu,
            SeriesId = serie.Id,
            Status = SeriesStatus.Following,
            AddedAt = DateTimeOffset.UtcNow,
        });

        await db.SaveChangesAsync();

        return await db.Episodes.ToDictionaryAsync(e => e.Name!, e => e.Id);
    }
}
