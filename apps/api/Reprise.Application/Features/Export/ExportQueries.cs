using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;

namespace Reprise.Application.Features.Export;

/// <summary>
/// Uma série do export, identificada por chaves <b>externas</b>.
///
/// O <c>tvdbId</c> e o <c>tmdbId</c> estão aqui porque o id interno não significa nada fora
/// desta instalação. Um export que só carrega ids internos é bonito e inútil: não dá para
/// reconstruir nada com ele em outro lugar, que é justamente o que se quer de um export.
/// </summary>
public sealed record ExportedSeries(
    int? TvdbId,
    int? TmdbId,
    string Name,
    string? OriginalName,
    string Status,
    string? ProductionStatus,
    DateTimeOffset AddedAt);

/// <summary>
/// Uma exibição. Endereçada pelas coordenadas do episódio (série + temporada + número), não pelo
/// id da linha — as coordenadas sobrevivem a uma reimportação; o id, não.
/// </summary>
public sealed record ExportedWatchEvent(
    int? SeriesTvdbId,
    string SeriesName,
    int SeasonNumber,
    int EpisodeNumber,
    string? EpisodeName,
    DateTimeOffset WatchedAt,
    string Source,
    bool IsBackfill,
    string? SourceKey);

public sealed record ExportedProfile(string DisplayName, string Email, DateTimeOffset MemberSince);

/// <summary>
/// O arquivo inteiro. <paramref name="Format"/> é versionado de propósito: quem ler isto daqui a
/// três anos precisa saber com que formato está lidando, e um número é mais honesto do que
/// adivinhar pela forma.
/// </summary>
public sealed record ExportDocument(
    string Format,
    DateTimeOffset ExportedAt,
    ExportedProfile Profile,
    IReadOnlyList<ExportedSeries> Series,
    IReadOnlyList<ExportedWatchEvent> WatchEvents);

/// <summary>
/// O export próprio — a razão pela qual este projeto existe.
///
/// <para>
/// O TV Time fechou levando os dados junto, e o que sobrou foi um zip de CSVs que não fechava com
/// as próprias contas. Um rastreador pessoal que não sabe devolver o que guardou repete o mesmo
/// erro. Por isso o export é <b>completo e reconstruível</b>, não um resumo bonito: cada exibição,
/// com data, origem e a marca de backfill, endereçada por coordenadas estáveis.
/// </para>
///
/// <para>
/// Materializa tudo em memória. Com 10 mil exibições isso é cerca de 2 MB — proporcional ao
/// tamanho real do problema. Se um dia for para centenas de milhares, o caminho é
/// <c>Utf8JsonWriter</c> escrevendo direto na resposta; hoje seria complexidade sem pergunta
/// correspondente.
/// </para>
/// </summary>
public sealed class ExportQueries
{
    /// <summary>Muda quando a forma do arquivo mudar de um jeito que quebre quem o lê.</summary>
    public const string CurrentFormat = "reprise-export-v1";

    private readonly IRepriseDbContext _db;
    private readonly ICurrentUser _currentUser;

    public ExportQueries(IRepriseDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<ExportDocument?> BuildAsync(CancellationToken ct = default)
    {
        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == _currentUser.UserId, ct);
        if (user is null) return null;

        // A ordenação vem ANTES da projeção: ordenar por uma propriedade do record projetado
        // obriga o EF a materializar o construtor em SQL, coisa que ele não sabe fazer.
        var series = await _db.TrackedSeries
            .AsNoTracking()
            .OrderBy(t => t.Series.Name)
            .Select(t => new ExportedSeries(
                t.Series.TvdbId,
                t.Series.TmdbId,
                t.Series.Name,
                t.Series.OriginalName,
                t.Status.ToString(),
                t.Series.Status,
                t.AddedAt))
            .ToListAsync(ct);

        var events = await _db.WatchEvents
            .AsNoTracking()
            .OrderBy(w => w.WatchedAt)
            .Select(w => new ExportedWatchEvent(
                w.Episode.Series.TvdbId,
                w.Episode.Series.Name,
                w.Episode.SeasonNumber,
                w.Episode.EpisodeNumber,
                w.Episode.Name,
                w.WatchedAt,
                w.Source.ToString(),
                w.IsBackfill,
                w.SourceKey))
            .ToListAsync(ct);

        return new ExportDocument(
            CurrentFormat,
            DateTimeOffset.UtcNow,
            new ExportedProfile(user.DisplayName, user.Email ?? string.Empty, user.CreatedAt),
            series,
            events);
    }
}
