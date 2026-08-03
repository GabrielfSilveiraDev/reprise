using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Application.Enrichment;
using Reprise.Domain.Enums;
using SeriesEntity = Reprise.Domain.Entities.Series;
using TrackedSeriesEntity = Reprise.Domain.Entities.TrackedSeries;

namespace Reprise.Application.Features.Series;

/// <summary>Uma série encontrada no TMDB, já cruzada com o que o usuário tem.</summary>
/// <param name="SeriesId">
/// Id no catálogo local quando a série já existe aqui — é o que permite ao cliente levar direto
/// para a página dela em vez de oferecer "adicionar" uma segunda vez.
/// </param>
/// <param name="TrackedStatus">
/// Estado de acompanhamento do usuário, ou nulo quando ele não acompanha. Distinguir "existe no
/// catálogo" de "eu acompanho" importa: o catálogo é global e compartilhado entre usuários.
/// </param>
public sealed record SeriesSearchResultDto(
    int TmdbId,
    string Name,
    string? OriginalName,
    string? Overview,
    string? PosterPath,
    DateOnly? FirstAirDate,
    long? SeriesId,
    string? TrackedStatus);

/// <summary>O que aconteceu ao adicionar. <paramref name="AlreadyTracked"/> torna o repetir visível.</summary>
public sealed record AddSeriesResultDto(
    long SeriesId,
    string Name,
    bool AlreadyTracked,
    int EpisodesCreated);

/// <summary>
/// Entrada de séries novas pela busca — o caminho que não passa pelo export do TV Time.
///
/// <para>
/// <b>Catálogo e acompanhamento são coisas separadas, e isso aparece aqui.</b> A série
/// (<see cref="SeriesEntity"/>) é global: se outro usuário já adicionou Severance, ela é
/// reaproveitada, com os episódios que já estão lá. O que nasce por usuário é o
/// <see cref="TrackedSeriesEntity"/>. Sem essa separação, cada pessoa arrastaria uma cópia do
/// catálogo inteiro e o mesmo episódio teria ids diferentes para cada uma.
/// </para>
///
/// <para>
/// <b>Repetível.</b> Adicionar duas vezes não duplica série, episódio nem acompanhamento — a
/// segunda vez devolve <c>AlreadyTracked</c> e não escreve nada. É o mesmo princípio do
/// importador: a operação é sobre um estado desejado, não sobre um evento.
/// </para>
/// </summary>
public sealed class SeriesCatalogService
{
    private readonly IRepriseDbContext _db;
    private readonly ITmdbClient _tmdb;
    private readonly ICurrentUser _currentUser;
    private readonly SeriesEnrichmentService _enrichment;

    public SeriesCatalogService(
        IRepriseDbContext db, ITmdbClient tmdb, ICurrentUser currentUser, SeriesEnrichmentService enrichment)
    {
        _db = db;
        _tmdb = tmdb;
        _currentUser = currentUser;
        _enrichment = enrichment;
    }

    public async Task<IReadOnlyList<SeriesSearchResultDto>> SearchAsync(string query, CancellationToken ct = default)
    {
        var hits = await _tmdb.SearchShowsAsync(query, ct);
        if (hits.Count == 0) return [];

        // Uma consulta para o catálogo e uma para o acompanhamento, não uma por resultado.
        var tmdbIds = hits.Select(h => h.TmdbId).ToList();
        var locais = await _db.Series
            .Where(s => s.TmdbId != null && tmdbIds.Contains(s.TmdbId!.Value))
            .Select(s => new { s.Id, TmdbId = s.TmdbId!.Value })
            .ToListAsync(ct);

        var seriesIdPorTmdb = locais.ToDictionary(x => x.TmdbId, x => x.Id);
        var seriesIds = locais.Select(x => x.Id).ToList();

        // O filtro global de tenant já restringe ao usuário atual.
        var acompanhadas = await _db.TrackedSeries
            .Where(t => seriesIds.Contains(t.SeriesId))
            .ToDictionaryAsync(t => t.SeriesId, t => t.Status, ct);

        return hits.Select(h =>
        {
            long? seriesId = seriesIdPorTmdb.TryGetValue(h.TmdbId, out var id) ? id : null;
            string? status = seriesId is long sid && acompanhadas.TryGetValue(sid, out var st) ? st.ToString() : null;

            return new SeriesSearchResultDto(
                h.TmdbId,
                // A MESMA política de nome do enriquecimento: título original quando legível,
                // inglês quando não. Escolher diferente aqui faria a série mudar de nome no
                // instante em que fosse adicionada.
                SeriesNamePolicy.Choose(h.OriginalName, h.EnglishName, fallback: h.Name),
                h.OriginalName,
                h.Overview,
                h.PosterPath,
                h.FirstAirDate,
                seriesId,
                status);
        }).ToList();
    }

    /// <summary>
    /// Adiciona a série ao catálogo (se ainda não estiver) e passa a acompanhá-la.
    /// Devolve <c>null</c> quando o TMDB não conhece o id — que é um 404, não um erro do servidor.
    /// </summary>
    public async Task<AddSeriesResultDto?> AddAsync(int tmdbId, CancellationToken ct = default)
    {
        var show = await _tmdb.GetShowAsync(tmdbId, ct);
        if (show is null) return null;

        var agora = DateTimeOffset.UtcNow;

        var serie = await _db.Series.FirstOrDefaultAsync(s => s.TmdbId == tmdbId, ct);
        var episodiosCriados = 0;

        if (serie is null)
        {
            // Nome provisório só até o ApplyAsync rodar: ele é quem aplica a política de nome.
            serie = new SeriesEntity { TmdbId = tmdbId, Name = show.Name, CreatedAt = agora, UpdatedAt = agora };
            _db.Series.Add(serie);
            await _db.SaveChangesAsync(ct);   // materializa o id, de que o catálogo precisa

            var resultado = await _enrichment.ApplyAsync(serie, show, ct);
            episodiosCriados = resultado.EpisodesCreated;
        }
        else if (!serie.MetadataEnriched)
        {
            // Já estava no catálogo como stub do export (veio do CSV, sem episódios). Adicionar
            // pela busca é uma oportunidade de completá-la, e não custa uma requisição a mais:
            // o `show` já está na mão.
            var resultado = await _enrichment.ApplyAsync(serie, show, ct);
            episodiosCriados = resultado.EpisodesCreated;
        }

        var jaAcompanhava = await _db.TrackedSeries.AnyAsync(t => t.SeriesId == serie.Id, ct);
        if (!jaAcompanhava)
        {
            _db.TrackedSeries.Add(new TrackedSeriesEntity
            {
                UserId = _currentUser.UserId,
                SeriesId = serie.Id,
                Status = SeriesStatus.Following,
                FollowedAt = agora,
                AddedAt = agora
            });
            await _db.SaveChangesAsync(ct);
        }

        return new AddSeriesResultDto(serie.Id, serie.Name, jaAcompanhava, episodiosCriados);
    }
}
