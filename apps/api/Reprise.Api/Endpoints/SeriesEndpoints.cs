using Microsoft.AspNetCore.Http.HttpResults;
using Reprise.Application.Features.Series;

namespace Reprise.Api.Endpoints;

public static class SeriesEndpoints
{
    public sealed record StatusBody(string Status);

    public sealed record AddSeriesBody(int TmdbId);

    /// <summary>
    /// O que responder quando a instância subiu sem chave do TMDB. Não é erro do cliente nem bug do
    /// servidor: é um recurso opcional desligado, e 503 com o motivo por extenso é o que permite à
    /// tela dizer o que fazer em vez de mostrar "algo deu errado".
    /// </summary>
    private static readonly string SemTmdb =
        "A busca de séries exige a chave v3 do TMDB (32 caracteres hexadecimais, em " +
        "themoviedb.org > Configurações > API). Defina Tmdb__ApiKey e reinicie a API. " +
        "Atenção: o 'API Read Access Token' da mesma página é a credencial v4 e não serve aqui.";

    public static void MapSeriesEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/series").WithTags("Series");

        // Resultados TIPADOS (não IResult): é deles que o OpenAPI extrai os schemas de resposta,
        // e é do OpenAPI que saem os tipos do cliente web (apps/web/src/api/schema.d.ts).
        g.MapGet("/", async (SeriesQueries q, CancellationToken ct) =>
                TypedResults.Ok(await q.GetListAsync(ct)))
            .WithSummary("Lista as séries acompanhadas com progresso derivado do log de eventos.");

        // A rota literal vem ANTES de "/{id:long}". A restrição :long já impediria "search" de cair
        // no detalhe, mas a ordem deixa a intenção explícita para quem mexer aqui depois.
        g.MapGet("/search", async Task<Results<Ok<IReadOnlyList<SeriesSearchResultDto>>, BadRequest<string>, ProblemHttpResult>> (
                string? q, IServiceProvider sp, CancellationToken ct) =>
            {
                var termo = (q ?? string.Empty).Trim();
                if (termo.Length < 2)
                    return TypedResults.BadRequest("Digite ao menos 2 caracteres para buscar.");

                var catalogo = sp.GetService<SeriesCatalogService>();
                if (catalogo is null)
                    return TypedResults.Problem(SemTmdb, statusCode: StatusCodes.Status503ServiceUnavailable);

                return TypedResults.Ok(await catalogo.SearchAsync(termo, ct));
            })
            .WithSummary("Busca séries no TMDB para adicionar ao acervo. Marca as que você já tem.");

        // POST e não PUT: o cliente manda o id do TMDB e o servidor decide o id local. Quem escolhe
        // o endereço do recurso criado é o servidor, e é isso que POST significa.
        g.MapPost("/", async Task<Results<Ok<AddSeriesResultDto>, NotFound<string>, ProblemHttpResult>> (
                AddSeriesBody body, IServiceProvider sp, CancellationToken ct) =>
            {
                var catalogo = sp.GetService<SeriesCatalogService>();
                if (catalogo is null)
                    return TypedResults.Problem(SemTmdb, statusCode: StatusCodes.Status503ServiceUnavailable);

                var resultado = await catalogo.AddAsync(body.TmdbId, ct);
                return resultado is null
                    ? TypedResults.NotFound($"O TMDB não conhece a série {body.TmdbId}.")
                    : TypedResults.Ok(resultado);
            })
            .WithSummary("Adiciona uma série do TMDB ao acervo e passa a acompanhá-la. Repetir não duplica.");

        g.MapGet("/{id:long}", async Task<Results<Ok<SeriesDetailDto>, NotFound>> (
                long id, SeriesQueries q, CancellationToken ct) =>
            {
                var detail = await q.GetDetailAsync(id, ct);
                return detail is null ? TypedResults.NotFound() : TypedResults.Ok(detail);
            })
            .WithSummary("Detalhe da série: temporadas e episódios com contagem de exibições (trilha de rewatch).");

        // Mudança de estado de acompanhamento. Não toca no log de exibições: arquivar uma série
        // não apaga nem cria um evento.
        g.MapPatch("/{id:long}/status", async (long id, StatusBody body, TrackingService s, CancellationToken ct) =>
                TypedResults.Ok(await s.SetAsync(id, body.Status, ct)))
            .WithSummary("Muda o estado da série: Following, Archived, ForLater ou Finished.");

        // Em lote, porque a regra de "isto acabou e eu terminei" mora no cliente (CompletionAdvisor,
        // no web, coberto por teste) — reimplementá-la no servidor criaria duas versões dela.
        g.MapPatch("/status", async (TrackingChange[] changes, TrackingService s, CancellationToken ct) =>
                TypedResults.Ok(await s.ApplyAsync(changes, ct)))
            .WithSummary("Muda o estado de várias séries de uma vez. Definir um valor é idempotente.");

        // A dispensa da revisão é um recurso: PUT cria (a partir de agora), DELETE desfaz. É o
        // par que o "Desfazer" do aviso precisa, e repetir qualquer um dos dois não faz estrago.
        g.MapPut("/{id:long}/rewatch/dismissal", async Task<Results<NoContent, NotFound>> (
                long id, TrackingService s, CancellationToken ct) =>
                await s.DismissRewatchAsync(id, ct) ? TypedResults.NoContent() : TypedResults.NotFound())
            .WithSummary("Tira a revisão da série da fila de próximos, até a próxima exibição repetida.");

        g.MapDelete("/{id:long}/rewatch/dismissal", async Task<Results<NoContent, NotFound>> (
                long id, TrackingService s, CancellationToken ct) =>
                await s.RestoreRewatchAsync(id, ct) ? TypedResults.NoContent() : TypedResults.NotFound())
            .WithSummary("Devolve a revisão da série à fila de próximos.");

        app.MapGet("/next-up", async (SeriesQueries q, CancellationToken ct) =>
                TypedResults.Ok(await q.GetNextUpAsync(ct)))
            .WithTags("Series")
            .WithSummary("O que assistir agora: o próximo inédito das acompanhadas e o próximo das revisões em andamento.");
    }
}
