using Microsoft.EntityFrameworkCore;
using Reprise.Application.Features.Series;
using Reprise.Domain.Entities;
using Reprise.Domain.Enums;

namespace Reprise.Tests.Integration;

/// <summary>
/// A volta automática para Assistindo, contra um Postgres de verdade.
///
/// <para>
/// O que só o banco prova: que a passada, rodando sem usuário e sem o filtro de tenant, enxerga o
/// acervo de todos e mesmo assim separa a exibição de uma pessoa da de outra — e que a estreia e a
/// última exibição saem certas das subconsultas. A regra de datas em si está em
/// <c>SeriesReturnRuleTests</c>.
/// </para>
/// </summary>
public sealed class SeriesReturnsTests : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private readonly PostgresFixture _pg;
    private readonly Guid _eu = Guid.NewGuid();
    private readonly Guid _outra = Guid.NewGuid();

    /// <summary>
    /// Datas relativas a hoje, e não fixas: o <see cref="TrackingService"/> grava a mudança de estado
    /// com o relógio de verdade, e a passada precisa concordar com ele sobre o que é "depois".
    /// </summary>
    private readonly DateTimeOffset _agora = DateTimeOffset.UtcNow;
    private DateOnly Hoje => DateOnly.FromDateTime(_agora.UtcDateTime);

    public SeriesReturnsTests(PostgresFixture pg) => _pg = pg;

    public async Task InitializeAsync()
    {
        await using var db = _pg.CreateContext(_eu);
        await db.Database.ExecuteSqlRawAsync(
            "TRUNCATE watch_events, tracked_series, episodes, seasons, series RESTART IDENTITY CASCADE");
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Concluida_volta_para_assistindo_quando_estreia_temporada_nova()
    {
        // O caso real: Cyberpunk: Edgerunners, vista inteira em 2022 e concluída, ganhou a temporada 2.
        var serie = await SemearAsync("Cyberpunk: Edgerunners", (1, 1, Hoje.AddYears(-4)), (1, 2, Hoje.AddYears(-4)), (2, 1, Hoje), (2, 2, Hoje));
        await AcompanharAsync(_eu, serie, SeriesStatus.Finished);
        await MarcarAsync(_eu, serie, _agora.AddYears(-4).AddDays(7), (1, 1), (1, 2));

        var r = await RodarAsync(_agora);

        Assert.Equal(["Cyberpunk: Edgerunners"], r.Returned);
        var t = await AcompanhamentoAsync(_eu, serie);
        Assert.Equal(SeriesStatus.Following, t.Status);
        Assert.Equal(_agora.ToUnixTimeSeconds(), t.ReturnedAt!.Value.ToUnixTimeSeconds());

        // E a lista conta, para a tela dizer por que a série reapareceu.
        var item = (await ListaAsync(_eu)).Single();
        Assert.Equal("Following", item.Status);
        Assert.NotNull(item.ReturnedAt);
        Assert.Equal((2, 1), (item.NextUp!.SeasonNumber, item.NextUp.EpisodeNumber));
    }

    [Fact]
    public async Task Arquivada_tambem_volta_e_para_depois_nao()
    {
        var arquivada = await SemearAsync("Arquivada", (1, 1, Hoje.AddYears(-2)), (2, 1, Hoje.AddDays(-1)));
        var paraDepois = await SemearAsync("Para depois", (1, 1, Hoje.AddYears(-2)), (2, 1, Hoje.AddDays(-1)));
        await AcompanharAsync(_eu, arquivada, SeriesStatus.Archived);
        await AcompanharAsync(_eu, paraDepois, SeriesStatus.ForLater);
        await MarcarAsync(_eu, arquivada, _agora.AddYears(-2), (1, 1));
        await MarcarAsync(_eu, paraDepois, _agora.AddYears(-2), (1, 1));

        var r = await RodarAsync(_agora);

        Assert.Equal(["Arquivada"], r.Returned);
        Assert.Equal(SeriesStatus.ForLater, (await AcompanhamentoAsync(_eu, paraDepois)).Status);
    }

    [Fact]
    public async Task Temporada_que_ja_existia_quando_voce_assistiu_pela_ultima_vez_nao_traz_de_volta()
    {
        // Viu a T3 com a T2 já lançada e sem ver: pular a T2 foi escolha, não novidade.
        var serie = await SemearAsync("Pulou a T2", (1, 1, Hoje.AddYears(-3)), (2, 1, Hoje.AddYears(-2)), (3, 1, Hoje.AddYears(-1)));
        await AcompanharAsync(_eu, serie, SeriesStatus.Finished);
        await MarcarAsync(_eu, serie, _agora.AddYears(-3), (1, 1));
        await MarcarAsync(_eu, serie, _agora.AddMonths(-6), (3, 1));

        Assert.Empty((await RodarAsync(_agora)).Returned);
        Assert.Equal(SeriesStatus.Finished, (await AcompanhamentoAsync(_eu, serie)).Status);
    }

    [Fact]
    public async Task Estreia_anunciada_so_traz_de_volta_quando_chega_o_dia()
    {
        var serie = await SemearAsync("Anunciada", (1, 1, Hoje.AddYears(-1)), (2, 1, Hoje.AddDays(10)));
        await AcompanharAsync(_eu, serie, SeriesStatus.Finished);
        await MarcarAsync(_eu, serie, _agora.AddYears(-1), (1, 1));

        Assert.Empty((await RodarAsync(_agora)).Returned);

        // O catálogo não muda entre uma passada e outra: é só a data que chega.
        Assert.Single((await RodarAsync(_agora.AddDays(10))).Returned);
    }

    [Fact]
    public async Task Episodio_novo_no_meio_da_temporada_nao_traz_de_volta()
    {
        // Concluída no meio da temporada: o episódio seguinte não é temporada nova.
        var serie = await SemearAsync("Largada no meio", (1, 1, Hoje.AddMonths(-2)), (1, 2, Hoje.AddDays(-1)));
        await AcompanharAsync(_eu, serie, SeriesStatus.Finished);
        await MarcarAsync(_eu, serie, _agora.AddMonths(-2), (1, 1));

        Assert.Empty((await RodarAsync(_agora)).Returned);
    }

    [Fact]
    public async Task Marcar_concluida_de_novo_segura_a_serie_ate_a_proxima_temporada()
    {
        var serie = await SemearAsync("Semanal", (1, 1, Hoje.AddYears(-1)), (2, 1, Hoje.AddDays(-1)), (2, 2, Hoje), (3, 1, Hoje.AddDays(300)));
        await AcompanharAsync(_eu, serie, SeriesStatus.Finished);
        await MarcarAsync(_eu, serie, _agora.AddYears(-1), (1, 1));
        Assert.Single((await RodarAsync(_agora)).Returned);

        // "Não quero esta temporada": de volta a Concluída, pelo mesmo caminho do botão.
        await using (var db = _pg.CreateContext(_eu))
            Assert.Equal(1, (await new TrackingService(db).SetAsync(serie, "Finished")).Updated);
        Assert.Null((await ListaAsync(_eu)).Single().ReturnedAt);

        // Nem a passada seguinte nem o episódio novo da mesma temporada a trazem de volta…
        Assert.Empty((await RodarAsync(_agora.AddHours(1))).Returned);
        Assert.Empty((await RodarAsync(_agora.AddDays(7))).Returned);
        Assert.Equal(SeriesStatus.Finished, (await AcompanhamentoAsync(_eu, serie)).Status);

        // …mas a temporada seguinte, sim.
        Assert.Single((await RodarAsync(_agora.AddDays(300))).Returned);
    }

    [Fact]
    public async Task Exibicao_de_outra_pessoa_nao_conta_como_minha()
    {
        var serie = await SemearAsync("Compartilhada", (1, 1, Hoje.AddYears(-2)), (2, 1, Hoje.AddDays(-3)));
        await AcompanharAsync(_eu, serie, SeriesStatus.Finished);
        await AcompanharAsync(_outra, serie, SeriesStatus.Finished);
        await MarcarAsync(_eu, serie, _agora.AddYears(-2), (1, 1));
        // Ela já viu a estreia: para ela não há novidade, e isso não pode segurar a minha.
        await MarcarAsync(_outra, serie, _agora.AddDays(-2), (1, 1), (2, 1));

        Assert.Single((await RodarAsync(_agora)).Returned);

        Assert.Equal(SeriesStatus.Following, (await AcompanhamentoAsync(_eu, serie)).Status);
        Assert.Equal(SeriesStatus.Finished, (await AcompanhamentoAsync(_outra, serie)).Status);
    }

    // ---- montagem ---------------------------------------------------------------------------

    /// <summary>
    /// A passada roda como um usuário que não acompanha nada — como o serviço em segundo plano da
    /// API. Se ela dependesse do filtro de tenant, nada voltaria, e estes testes pegariam isso.
    /// </summary>
    private async Task<SeriesReturnReport> RodarAsync(DateTimeOffset agora)
    {
        await using var db = _pg.CreateContext(Guid.Empty);
        return await new SeriesReturns(db).ApplyAsync(agora);
    }

    private async Task<long> SemearAsync(string nome, params (int Temporada, int Episodio, DateOnly Estreia)[] eps)
    {
        await using var db = _pg.CreateContext(_eu);

        var serie = new Series { Name = nome, Status = "Returning Series" };
        db.Series.Add(serie);
        await db.SaveChangesAsync();

        var temporadas = eps.Select(e => e.Temporada).Distinct()
            .ToDictionary(n => n, n => new Season { SeriesId = serie.Id, SeasonNumber = n });
        db.Seasons.AddRange(temporadas.Values);
        await db.SaveChangesAsync();

        foreach (var (temporada, episodio, estreia) in eps)
        {
            db.Episodes.Add(new Episode
            {
                SeriesId = serie.Id, SeasonId = temporadas[temporada].Id,
                SeasonNumber = temporada, EpisodeNumber = episodio,
                Name = $"T{temporada}E{episodio}", AirDate = estreia,
            });
        }
        await db.SaveChangesAsync();
        return serie.Id;
    }

    /// <summary>Uma linha anterior a esta mudança: sem data de mudança de estado, como as de produção.</summary>
    private async Task AcompanharAsync(Guid usuario, long serie, SeriesStatus status)
    {
        await using var db = _pg.CreateContext(usuario);
        db.TrackedSeries.Add(new TrackedSeries
        {
            UserId = usuario, SeriesId = serie, Status = status, AddedAt = _agora.AddYears(-5),
        });
        await db.SaveChangesAsync();
    }

    /// <summary>Marca os episódios dados, um minuto depois do outro a partir de <paramref name="quando"/>.</summary>
    private async Task MarcarAsync(Guid usuario, long serie, DateTimeOffset quando, params (int Temporada, int Episodio)[] eps)
    {
        await using var db = _pg.CreateContext(usuario);
        var episodios = await db.Episodes.Where(e => e.SeriesId == serie).ToListAsync();

        for (var i = 0; i < eps.Length; i++)
        {
            var ep = episodios.Single(e => e.SeasonNumber == eps[i].Temporada && e.EpisodeNumber == eps[i].Episodio);
            db.WatchEvents.Add(WatchEvent.CreateManual(usuario, ep.Id, quando.AddMinutes(i)));
        }
        await db.SaveChangesAsync();
    }

    private async Task<TrackedSeries> AcompanhamentoAsync(Guid usuario, long serie)
    {
        await using var db = _pg.CreateContext(usuario);
        return await db.TrackedSeries.SingleAsync(t => t.SeriesId == serie);
    }

    private async Task<IReadOnlyList<SeriesListItemDto>> ListaAsync(Guid usuario)
    {
        await using var db = _pg.CreateContext(usuario);
        return await new SeriesQueries(db).GetListAsync();
    }
}
