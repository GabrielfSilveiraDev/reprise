using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Reprise.Domain.Entities;
using Reprise.Infrastructure.Persistence;

namespace Reprise.Infrastructure.Auth;

public sealed record AuthTokens(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset AccessTokenExpiresAt,
    Guid UserId,
    string DisplayName,
    string Email);

/// <summary>Por que uma tentativa de autenticação falhou, do ponto de vista de quem chama.</summary>
public enum AuthFailure
{
    None = 0,
    InvalidCredentials,
    EmailTaken,
    RegistrationClosed,
    WeakPassword,
    InvalidRefreshToken
}

public sealed record AuthResult(AuthTokens? Tokens, AuthFailure Failure, string? Detail = null)
{
    public bool Succeeded => Tokens is not null;
    public static AuthResult Ok(AuthTokens tokens) => new(tokens, AuthFailure.None);
    public static AuthResult Fail(AuthFailure failure, string? detail = null) => new(null, failure, detail);
}

/// <summary>
/// Cadastro, login e renovação.
///
/// <para>
/// O hash de senha vem do <see cref="IPasswordHasher{TUser}"/> do Identity, não de código próprio:
/// ele já resolve algoritmo, fator de trabalho, salt e migração de formato quando o padrão mudar.
/// Escrever isso à mão é o exemplo canônico de reinventar a roda numa área onde errar é caro.
/// </para>
/// </summary>
public sealed class AuthService
{
    private readonly RepriseDbContext _db;
    private readonly UserManager<User> _users;
    private readonly JwtOptions _options;
    private readonly TimeProvider _clock;

    public AuthService(
        RepriseDbContext db, UserManager<User> users, IOptions<JwtOptions> options, TimeProvider clock)
    {
        _db = db;
        _users = users;
        _options = options.Value;
        _clock = clock;
    }

    public async Task<AuthResult> RegisterAsync(
        string email, string password, string displayName, string? device, CancellationToken ct = default)
    {
        if (!_options.AllowRegistration)
            return AuthResult.Fail(AuthFailure.RegistrationClosed);

        if (await _users.FindByEmailAsync(email) is not null)
            return AuthResult.Fail(AuthFailure.EmailTaken);

        var user = new User
        {
            Id = Guid.CreateVersion7(),
            UserName = email,
            Email = email,
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? email.Split('@')[0] : displayName.Trim(),
            CreatedAt = _clock.GetUtcNow()
        };

        var created = await _users.CreateAsync(user, password);
        if (!created.Succeeded)
        {
            var detail = string.Join(' ', created.Errors.Select(e => e.Description));
            return AuthResult.Fail(AuthFailure.WeakPassword, detail);
        }

        return AuthResult.Ok(await IssueAsync(user, device, ct));
    }

    public async Task<AuthResult> LoginAsync(
        string email, string password, string? device, CancellationToken ct = default)
    {
        var user = await _users.FindByEmailAsync(email);

        // Mesma resposta para "não existe" e "senha errada": distingui-las entrega a lista de
        // quem tem conta a quem só tem a URL.
        if (user is null || !await _users.CheckPasswordAsync(user, password))
            return AuthResult.Fail(AuthFailure.InvalidCredentials);

        return AuthResult.Ok(await IssueAsync(user, device, ct));
    }

    /// <summary>
    /// Troca um refresh token por um par novo, consumindo o antigo.
    ///
    /// A rotação é o que limita o estrago de um token roubado: ele só vale até o dono legítimo
    /// renovar, e a partir daí a apresentação do token velho falha.
    /// </summary>
    public async Task<AuthResult> RefreshAsync(string refreshToken, string? device, CancellationToken ct = default)
    {
        var now = _clock.GetUtcNow();
        var hash = RefreshToken.Hash(refreshToken);

        var stored = await _db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.TokenHash == hash, ct);

        if (stored is null || !stored.IsActive(now))
            return AuthResult.Fail(AuthFailure.InvalidRefreshToken);

        stored.RevokedAt = now;
        var tokens = await IssueAsync(stored.User, device ?? stored.Device, ct);
        return AuthResult.Ok(tokens);
    }

    /// <summary>Encerra uma sessão. Idempotente: sair duas vezes não é erro.</summary>
    public async Task LogoutAsync(string refreshToken, CancellationToken ct = default)
    {
        var hash = RefreshToken.Hash(refreshToken);
        var stored = await _db.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == hash, ct);
        if (stored is { RevokedAt: null })
        {
            stored.RevokedAt = _clock.GetUtcNow();
            await _db.SaveChangesAsync(ct);
        }
    }

    private async Task<AuthTokens> IssueAsync(User user, string? device, CancellationToken ct)
    {
        var now = _clock.GetUtcNow();
        var (entity, plain) = RefreshToken.Issue(user.Id, _options.RefreshTokenLifetime, device, now);

        _db.RefreshTokens.Add(entity);

        // Faxina oportunista: sessões mortas não precisam de rotina agendada num app deste tamanho.
        var dead = await _db.RefreshTokens
            .Where(r => r.UserId == user.Id && (r.ExpiresAt < now || r.RevokedAt != null))
            .Where(r => r.CreatedAt < now.AddDays(-90))
            .ToListAsync(ct);
        _db.RefreshTokens.RemoveRange(dead);

        await _db.SaveChangesAsync(ct);

        var expires = now + _options.AccessTokenLifetime;
        return new AuthTokens(
            CreateAccessToken(user, expires), plain, expires, user.Id, user.DisplayName, user.Email ?? string.Empty);
    }

    private string CreateAccessToken(User user, DateTimeOffset expiresAt)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Secret));

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims:
            [
                // `sub` é o id do tenant: é dele que o filtro global do EF Core se alimenta.
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
                new Claim("name", user.DisplayName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.CreateVersion7().ToString())
            ],
            expires: expiresAt.UtcDateTime,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
