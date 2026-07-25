using Microsoft.AspNetCore.Http.HttpResults;
using Reprise.Infrastructure.Auth;

namespace Reprise.Api.Endpoints;

public static class AuthEndpoints
{
    public sealed record RegisterBody(string Email, string Password, string DisplayName);
    public sealed record LoginBody(string Email, string Password);
    public sealed record RefreshBody(string RefreshToken);

    /// <summary>O que o cliente guarda depois de autenticar.</summary>
    public sealed record SessionDto(
        string AccessToken,
        string RefreshToken,
        DateTimeOffset AccessTokenExpiresAt,
        string UserId,
        string DisplayName,
        string Email);

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/auth").WithTags("Auth");

        g.MapPost("/register",
                async Task<Results<Ok<SessionDto>, Conflict<string>, ValidationProblem, ForbidHttpResult>> (
                    RegisterBody body, AuthService auth, HttpContext http, CancellationToken ct) =>
                {
                    var result = await auth.RegisterAsync(
                        body.Email, body.Password, body.DisplayName, Device(http), ct);

                    return result.Failure switch
                    {
                        AuthFailure.RegistrationClosed => TypedResults.Forbid(),
                        AuthFailure.EmailTaken => TypedResults.Conflict("Já existe uma conta com este e-mail."),
                        AuthFailure.WeakPassword => TypedResults.ValidationProblem(
                            new Dictionary<string, string[]> { ["password"] = [result.Detail ?? "Senha fraca."] }),
                        _ => TypedResults.Ok(ToDto(result.Tokens!))
                    };
                })
            .WithSummary("Cria uma conta. Recusado quando o cadastro está fechado (o padrão).");

        g.MapPost("/login",
                async Task<Results<Ok<SessionDto>, UnauthorizedHttpResult>> (
                    LoginBody body, AuthService auth, HttpContext http, CancellationToken ct) =>
                {
                    var result = await auth.LoginAsync(body.Email, body.Password, Device(http), ct);
                    return result.Succeeded
                        ? TypedResults.Ok(ToDto(result.Tokens!))
                        : TypedResults.Unauthorized();
                })
            .WithSummary("Autentica e devolve o par de tokens.");

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
