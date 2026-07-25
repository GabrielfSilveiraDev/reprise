using Microsoft.AspNetCore.Http.HttpResults;
using Reprise.Infrastructure.Auth;

namespace Reprise.Api.Endpoints;

public static class AuthEndpoints
{
    public sealed record RegisterBody(string Email, string Password, string DisplayName, string? UserName);
    /// <summary>`Identifier` é e-mail <b>ou</b> nome de usuário — o formulário aceita os dois.</summary>
    public sealed record LoginBody(string Identifier, string Password);
    public sealed record RefreshBody(string RefreshToken);
    public sealed record ConfirmBody(string Email, string Code);
    public sealed record ResendBody(string Email);

    /// <summary>O que o cliente guarda depois de autenticar.</summary>
    public sealed record SessionDto(
        string AccessToken,
        string RefreshToken,
        DateTimeOffset AccessTokenExpiresAt,
        string UserId,
        string DisplayName,
        string Email);

    /// <summary>
    /// Resposta do cadastro. Sem tokens de propósito: a conta existe, mas ainda não entra.
    /// <paramref name="EmailSent"/> falso significa que o SMTP não está configurado — o código
    /// foi para o log do servidor, e a tela precisa dizer isso em vez de mandar esperar um e-mail
    /// que não vem.
    /// </summary>
    public sealed record RegistrationDto(string Email, bool EmailSent, string Message);

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/auth").WithTags("Auth");

        g.MapPost("/register",
                async Task<Results<Ok<RegistrationDto>, Conflict<string>, ValidationProblem, ForbidHttpResult>> (
                    RegisterBody body, AuthService auth, CancellationToken ct) =>
                {
                    var result = await auth.RegisterAsync(
                        body.Email, body.Password, body.DisplayName, body.UserName, ct);

                    return result.Failure switch
                    {
                        AuthFailure.RegistrationClosed => TypedResults.Forbid(),
                        AuthFailure.EmailTaken => TypedResults.Conflict(
                            result.Detail ?? "Já existe uma conta com este e-mail."),
                        AuthFailure.WeakPassword => TypedResults.ValidationProblem(
                            new Dictionary<string, string[]> { ["password"] = [result.Detail ?? "Senha fraca."] }),
                        _ => TypedResults.Ok(new RegistrationDto(
                            result.Email!,
                            result.EmailSent,
                            result.EmailSent
                                ? "Enviamos um código de seis dígitos para o seu e-mail."
                                : "Conta criada, mas o envio de e-mail não está configurado neste servidor. O código está no log da API."))
                    };
                })
            .WithSummary("Cria a conta e envia o código de validação. Não devolve sessão.");

        g.MapPost("/confirm",
                async Task<Results<Ok<SessionDto>, UnauthorizedHttpResult>> (
                    ConfirmBody body, AuthService auth, HttpContext http, CancellationToken ct) =>
                {
                    var result = await auth.ConfirmEmailAsync(body.Email, body.Code, Device(http), ct);
                    return result.Succeeded
                        ? TypedResults.Ok(ToDto(result.Tokens!))
                        : TypedResults.Unauthorized();
                })
            .WithSummary("Valida a conta com o código de seis dígitos e já devolve a sessão.");

        g.MapPost("/resend",
                async (ResendBody body, AuthService auth, CancellationToken ct) =>
                {
                    await auth.ResendConfirmationAsync(body.Email, ct);
                    // Sempre 204: distinguir "conta não existe" de "já confirmada" transformaria
                    // este endpoint num verificador de quem tem conta.
                    return TypedResults.NoContent();
                })
            .WithSummary("Reenvia o código. Responde igual em todos os casos, de propósito.");

        g.MapPost("/login",
                async Task<Results<Ok<SessionDto>, UnauthorizedHttpResult, ProblemHttpResult>> (
                    LoginBody body, AuthService auth, HttpContext http, CancellationToken ct) =>
                {
                    var result = await auth.LoginAsync(body.Identifier, body.Password, Device(http), ct);

                    if (result.Succeeded) return TypedResults.Ok(ToDto(result.Tokens!));

                    // 403 e não 401 para conta por confirmar: as credenciais estavam certas, e a
                    // tela precisa distinguir "senha errada" de "falta validar o e-mail".
                    return result.Failure == AuthFailure.EmailNotConfirmed
                        ? TypedResults.Problem(
                            detail: result.Detail,
                            statusCode: StatusCodes.Status403Forbidden,
                            title: "E-mail ainda não validado")
                        : TypedResults.Unauthorized();
                })
            .WithSummary("Autentica por e-mail ou nome de usuário e devolve o par de tokens.");

        g.MapPost("/refresh",
                async Task<Results<Ok<SessionDto>, UnauthorizedHttpResult>> (
                    RefreshBody body, AuthService auth, HttpContext http, CancellationToken ct) =>
                {
                    var result = await auth.RefreshAsync(body.RefreshToken, Device(http), ct);
                    return result.Succeeded
                        ? TypedResults.Ok(ToDto(result.Tokens!))
                        : TypedResults.Unauthorized();
                })
            .WithSummary("Troca o refresh token por um par novo. O antigo é consumido.");

        g.MapPost("/logout",
                async (RefreshBody body, AuthService auth, CancellationToken ct) =>
                {
                    await auth.LogoutAsync(body.RefreshToken, ct);
                    return TypedResults.NoContent();
                })
            .WithSummary("Encerra a sessão. Idempotente: sair duas vezes não é erro.");
    }

    /// <summary>
    /// Rótulo do aparelho, só para diagnóstico ("que dispositivos estão logados"). Truncado porque
    /// o User-Agent é entrada de fora e não deve dimensionar coluna nenhuma.
    /// </summary>
    private static string? Device(HttpContext http)
    {
        var ua = http.Request.Headers.UserAgent.ToString();
        return string.IsNullOrWhiteSpace(ua) ? null : ua[..Math.Min(ua.Length, 200)];
    }

    private static SessionDto ToDto(AuthTokens t) => new(
        t.AccessToken, t.RefreshToken, t.AccessTokenExpiresAt, t.UserId.ToString(), t.DisplayName, t.Email);
}
