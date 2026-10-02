using System.Security.Cryptography;
using System.Text;

namespace Reprise.Api.Security;

/// <summary>
/// Cadeado de acesso por segredo compartilhado, para quando a API precisa sair da LAN
/// (túnel de desenvolvimento, por exemplo).
///
/// <para>
/// <b>Não é autenticação.</b> Não identifica ninguém, não tem sessão, não tem expiração e não
/// substitui o Identity + JWT. É uma porta trancada na frente do prédio: com ela, nem a tela de
/// login fica exposta a quem só tem a URL.
/// </para>
///
/// <para>
/// <b>Desligado por padrão.</b> Sem <c>Api:AccessToken</c> configurado o pipeline segue como
/// sempre — em casa, na LAN, não há o que trancar e exigir token só criaria atrito.
/// </para>
///
/// <para>
/// <b>Não há exceção para requisição local.</b> Parece tentador liberar <c>127.0.0.1</c> para o
/// cliente web não precisar do token, mas é justamente por ali que um túnel entra: o
/// <c>cloudflared</c> roda na máquina e abre a conexão a partir do loopback. A exceção anularia
/// o cadeado exatamente no caso em que ele existe para servir.
/// </para>
/// </summary>
public sealed class AccessTokenGate
{
    /// <summary>
    /// Cabeçalho próprio, e não <c>Authorization: Bearer</c>, de propósito: o <c>Authorization</c>
    /// é do JWT — e dois significados no mesmo cabeçalho viraria ambiguidade na hora de distinguir
    /// "token do túnel" de "usuário autenticado".
    /// </summary>
    public const string HeaderName = "X-Reprise-Token";

    private readonly RequestDelegate _next;
    private readonly byte[]? _expected;

    public AccessTokenGate(RequestDelegate next, IConfiguration configuration)
    {
        _next = next;
        var token = configuration["Api:AccessToken"];
        _expected = string.IsNullOrWhiteSpace(token) ? null : Encoding.UTF8.GetBytes(token);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (_expected is null)
        {
            await _next(context);
            return;
        }

        if (!IsAuthorized(context.Request))
        {
            // Sem corpo e sem detalhe: a resposta não deve ajudar quem está tentando adivinhar.
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        await _next(context);
    }

    private bool IsAuthorized(HttpRequest request)
    {
        if (!request.Headers.TryGetValue(HeaderName, out var values)) return false;

        var presented = values.ToString();
        if (string.IsNullOrEmpty(presented)) return false;

        // Comparação de tempo fixo: `==` em string sai no primeiro byte diferente, e a diferença
        // de tempo entre "errou no 1º caractere" e "errou no 20º" é medível pela rede.
        var candidate = Encoding.UTF8.GetBytes(presented);
        return CryptographicOperations.FixedTimeEquals(candidate, _expected!);
    }
}

public static class AccessTokenGateExtensions
{
    /// <summary>
    /// Entra no começo do pipeline: nada — nem a raiz, nem o OpenAPI — responde sem o token
    /// quando o cadeado está ligado.
    /// </summary>
    public static IApplicationBuilder UseAccessTokenGate(this IApplicationBuilder app)
        => app.UseMiddleware<AccessTokenGate>();
}
