using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

namespace Reprise.Api.Hosting;

/// <summary>
/// O cliente web servido pela própria API, quando o build dele está em <c>wwwroot</c> — é assim que
/// a imagem do Reprise (o <c>Dockerfile</c> da raiz) entrega tudo num processo só.
///
/// <para>
/// <b>Por que a API, e não um nginx na frente.</b> Hospedagem gratuita dá um serviço com 512 MB, e
/// não dois: nginx e API no mesmo container exigiriam um supervisor de processos, e em dois serviços
/// cada um dorme e acorda por conta própria. Com a API servindo os arquivos, é um processo, uma
/// porta, uma origem — a sessão nunca cruza domínio e a API continua sem precisar de CORS.
/// </para>
///
/// <para>
/// <b>O mesmo contrato do proxy do Vite.</b> O cliente chama <c>/api/…</c>; tudo fora de
/// <c>/api</c> é do cliente (arquivo ou rota da SPA), e o que está dentro chega aos endpoints sem o
/// prefixo, como chega pelo Vite em desenvolvimento. Sem <c>wwwroot</c> (<c>dotnet run</c>, testes),
/// nada disto liga e a API responde na raiz, como sempre.
/// </para>
///
/// <para>
/// O cadeado (<c>Api:AccessToken</c>) fica só na frente de <c>/api</c>: os arquivos do cliente são
/// públicos de qualquer jeito (estão no repositório), e é o próprio cliente que pede a chave.
/// </para>
/// </summary>
public static class WebClientHosting
{
    public const string ApiPrefix = "/api";

    /// <summary>
    /// Arquivos com hash no nome (o Vite os põe aqui) nunca mudam de conteúdo: cache de um ano. O
    /// resto — <c>index.html</c>, o service worker, o manifesto — precisa ser conferido a cada
    /// visita, ou uma versão nova nunca chegaria a quem já abriu o app.
    /// </summary>
    private const string HashedAssets = "/assets";

    public static IServiceCollection AddRepriseWebClient(this IServiceCollection services)
        // Só os arquivos do cliente passam pela compressão (ver UseRepriseWebClient), e eles não têm
        // segredo nenhum — então o risco do BREACH, que é o motivo de o HTTPS vir desligado, não existe.
        => services.AddResponseCompression(o => o.EnableForHttps = true);

    /// <summary>
    /// Liga o cliente web, se houver um build em <c>wwwroot</c>. Vem antes de tudo no pipeline, e o
    /// <c>UseRouting</c> precisa vir depois: é só depois do <c>UsePathBase</c> que o caminho já está
    /// sem o <c>/api</c>.
    /// </summary>
    /// <returns>Se o cliente está sendo servido.</returns>
    public static bool UseRepriseWebClient(this WebApplication app)
    {
        var files = app.Environment.WebRootFileProvider;
        var index = files.GetFileInfo("index.html");
        if (!index.Exists) return false;

        app.MapWhen(context => !context.Request.Path.StartsWithSegments(ApiPrefix), web =>
        {
            web.UseResponseCompression();
            web.Use(WithSecurityHeaders);
            web.UseAndroidAppLinks();
            web.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = files,
                ContentTypeProvider = ContentTypes(),
                OnPrepareResponse = static file => file.Context.Response.Headers.CacheControl =
                    file.Context.Request.Path.StartsWithSegments(HashedAssets)
                        ? "public, max-age=31536000, immutable"
                        : "no-cache",
            });
            web.Run(context => ServeIndexAsync(context, index));
        });

        app.UsePathBase(ApiPrefix);
        return true;
    }

    /// <summary>
    /// Rota da SPA cai no <c>index.html</c>, e o roteador do navegador resolve. O que tem cara de
    /// arquivo (um ponto no último trecho, a mesma regra do <c>MapFallbackToFile</c>) e não existe é
    /// 404 de verdade: devolver HTML no lugar de um <c>.js</c> de uma versão antiga quebraria a página
    /// com erro de tipo, em vez de deixar o navegador buscar a versão nova.
    /// </summary>
    private static Task ServeIndexAsync(HttpContext context, IFileInfo index)
    {
        var path = context.Request.Path.Value ?? "/";
        var lastSegment = path[(path.LastIndexOf('/') + 1)..];
        var isRead = HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method);

        if (!isRead || lastSegment.Contains('.') || context.Request.Path.StartsWithSegments(HashedAssets))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return Task.CompletedTask;
        }

        context.Response.ContentType = "text/html; charset=utf-8";
        context.Response.Headers.CacheControl = "no-cache";
        return HttpMethods.IsHead(context.Request.Method)
            ? Task.CompletedTask
            : context.Response.SendFileAsync(index);
    }

    /// <summary>Os mesmos cabeçalhos que o nginx do web mandava.</summary>
    private static Task WithSecurityHeaders(HttpContext context, RequestDelegate next)
    {
        var headers = context.Response.Headers;
        headers.XContentTypeOptions = "nosniff";
        headers.XFrameOptions = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        return next(context);
    }

    /// <summary>
    /// O manifesto do app instalável. Tipo desconhecido não é servido pelo StaticFiles — cairia no
    /// <c>index.html</c>, e o navegador acharia que o site não tem manifesto.
    /// </summary>
    private static FileExtensionContentTypeProvider ContentTypes()
    {
        var provider = new FileExtensionContentTypeProvider();
        provider.Mappings[".webmanifest"] = "application/manifest+json";
        return provider;
    }
}
