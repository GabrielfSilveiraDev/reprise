using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Reprise.Application.Abstractions;
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
    InvalidRefreshToken,
    /// <summary>Credenciais certas, mas o e-mail nunca foi validado.</summary>
    EmailNotConfirmed,
    /// <summary>Código de validação errado, vencido ou já usado.</summary>
    InvalidCode
}

public sealed record AuthResult(AuthTokens? Tokens, AuthFailure Failure, string? Detail = null)
{
    public bool Succeeded => Tokens is not null;
    public static AuthResult Ok(AuthTokens tokens) => new(tokens, AuthFailure.None);
    public static AuthResult Fail(AuthFailure failure, string? detail = null) => new(null, failure, detail);
}

/// <summary>
/// O que o cadastro devolve. Repare que <b>não há tokens</b>: a conta recém-criada ainda não
/// entra, porque o e-mail não foi validado. Entregar sessão aqui esvaziaria a validação.
/// </summary>
public sealed record RegistrationResult(
    AuthFailure Failure,
    string? Email = null,
    bool EmailSent = false,
    string? Detail = null)
{
    public bool Succeeded => Failure == AuthFailure.None;
}

/// <summary>
/// Cadastro, login, validação de e-mail e renovação.
///
/// <para>
/// O hash de senha vem do <see cref="IPasswordHasher{TUser}"/> do Identity, não de código próprio:
/// ele já resolve algoritmo, fator de trabalho, salt e migração de formato quando o padrão mudar.
/// Escrever isso à mão é o exemplo canônico de reinventar a roda numa área onde errar é caro.
/// </para>
/// </summary>
public sealed class AuthService
{
    /// <summary>
    /// Propósito do código, no vocabulário do Identity. Um token gerado para confirmar e-mail não
    /// vale para redefinir senha — é o próprio Identity que amarra o propósito ao código.
    /// </summary>
    private const string ConfirmEmailPurpose = "EmailConfirmation";

    private readonly RepriseDbContext _db;
    private readonly UserManager<User> _users;
    private readonly IEmailSender _email;
    private readonly JwtOptions _options;
    private readonly TimeProvider _clock;

    public AuthService(
        RepriseDbContext db,
        UserManager<User> users,
        IEmailSender email,
        IOptions<JwtOptions> options,
        TimeProvider clock)
    {
        _db = db;
        _users = users;
        _email = email;
        _options = options.Value;
        _clock = clock;
    }

    /// <summary>
    /// Cria a conta e manda o código de validação. <b>Não devolve sessão</b>: a conta nasce com o
    /// e-mail por confirmar e só entra depois de o código ser conferido.
    /// </summary>
    public async Task<RegistrationResult> RegisterAsync(
        string? email, string? password, string? displayName, string? userName, CancellationToken ct = default)
    {
        if (!_options.AllowRegistration)
            return new RegistrationResult(AuthFailure.RegistrationClosed);

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrEmpty(password))
            return new RegistrationResult(AuthFailure.WeakPassword, Detail: "E-mail e senha são obrigatórios.");

        if (await _users.FindByEmailAsync(email) is not null)
            return new RegistrationResult(AuthFailure.EmailTaken);

        var login = string.IsNullOrWhiteSpace(userName) ? email : userName.Trim();
        if (await _users.FindByNameAsync(login) is not null)
            return new RegistrationResult(AuthFailure.EmailTaken, Detail: "Este nome de usuário já está em uso.");

        var user = new User
        {
            Id = Guid.CreateVersion7(),
            UserName = login,
            Email = email,
            EmailConfirmed = false,
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? login : displayName.Trim(),
            CreatedAt = _clock.GetUtcNow()
        };

        var created = await _users.CreateAsync(user, password);
        if (!created.Succeeded)
        {
            var detail = string.Join(' ', created.Errors.Select(e => e.Description));
            return new RegistrationResult(AuthFailure.WeakPassword, Detail: detail);
        }

        var sent = await SendConfirmationCodeAsync(user, ct);
        return new RegistrationResult(AuthFailure.None, email, sent);
    }

    /// <summary>
    /// Gera e envia um código de seis dígitos.
    ///
    /// <para>
    /// O código vem do <c>EmailTokenProvider</c> do Identity, que é TOTP por baixo: curto,
    /// numérico, com validade própria e amarrado ao <c>SecurityStamp</c> do usuário — trocar a
    /// senha invalida os códigos pendentes de graça. Sortear seis dígitos à mão e guardá-los numa
    /// tabela seria reimplementar isso pior.
    /// </para>
    /// </summary>
    private async Task<bool> SendConfirmationCodeAsync(User user, CancellationToken ct)
    {
        var code = await _users.GenerateUserTokenAsync(
            user, TokenOptions.DefaultEmailProvider, ConfirmEmailPurpose);

        var corpo =
            $"{code}\n\n" +
            $"Este é o código para validar a conta {user.UserName} no Reprise.\n" +
            "Ele vale por poucos minutos e só serve uma vez.\n\n" +
            "Se não foi você quem criou a conta, ignore esta mensagem.";

        return await _email.SendAsync(user.Email!, "Seu código do Reprise", corpo, ct);
    }

    /// <summary>Confere o código e libera a conta, já devolvendo a sessão.</summary>
    public async Task<AuthResult> ConfirmEmailAsync(
        string? email, string? code, string? device, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
            return AuthResult.Fail(AuthFailure.InvalidCode);

        var user = await _users.FindByEmailAsync(email.Trim());
        if (user is null) return AuthResult.Fail(AuthFailure.InvalidCode);

        // Já confirmada: reapresentar o código não é erro, é repetição. Devolver a sessão evita
        // que um toque duplicado no botão vire tela de erro.
        if (user.EmailConfirmed) return AuthResult.Ok(await IssueAsync(user, device, ct));

        var valid = await _users.VerifyUserTokenAsync(
            user, TokenOptions.DefaultEmailProvider, ConfirmEmailPurpose, code.Trim());

        if (!valid) return AuthResult.Fail(AuthFailure.InvalidCode);

        user.EmailConfirmed = true;
        await _users.UpdateAsync(user);

        return AuthResult.Ok(await IssueAsync(user, device, ct));
    }

    /// <summary>
    /// Manda o código de novo. Responde igual para conta inexistente e conta já confirmada: um
    /// endpoint de reenvio que distingue os casos vira um verificador de quem tem conta.
    /// </summary>
    public async Task<bool> ResendConfirmationAsync(string? email, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;

        var user = await _users.FindByEmailAsync(email.Trim());
        if (user is null || user.EmailConfirmed) return false;
        return await SendConfirmationCodeAsync(user, ct);
    }

    /// <summary>
    /// Entra com <b>e-mail ou nome de usuário</b>. Aceitar os dois é o mínimo que se espera de um
    /// campo chamado "usuário": quem cadastrou um apelido não deveria precisar lembrar qual dos
    /// dois o formulário quer.
    /// </summary>
    public async Task<AuthResult> LoginAsync(
        string? identifier, string? password, string? device, CancellationToken ct = default)
    {
        // Campo vazio ou ausente é credencial inválida, não erro do servidor. Sem esta guarda,
        // um corpo malformado — um cliente desatualizado mandando outro nome de campo, por
        // exemplo — vira exceção não tratada e HTTP 500. Entrada de fora nunca deve derrubar.
        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrEmpty(password))
            return AuthResult.Fail(AuthFailure.InvalidCredentials);

        var user = await FindByIdentifierAsync(identifier);

        // Mesma resposta para "não existe" e "senha errada": distingui-las entrega a lista de
        // quem tem conta a quem só tem a URL.
        if (user is null || !await _users.CheckPasswordAsync(user, password))
            return AuthResult.Fail(AuthFailure.InvalidCredentials);

        // Conta sem e-mail confirmado não entra — é o que dá sentido ao código de validação.
        // Contas anteriores à verificação já nascem confirmadas, então ninguém fica de fora.
        if (!user.EmailConfirmed)
            return AuthResult.Fail(AuthFailure.EmailNotConfirmed, user.Email);

        return AuthResult.Ok(await IssueAsync(user, device, ct));
    }

    private async Task<User?> FindByIdentifierAsync(string identifier)
    {
        var trimmed = identifier.Trim();
        return trimmed.Contains('@')
            ? await _users.FindByEmailAsync(trimmed)
            : await _users.FindByNameAsync(trimmed);
    }

    /// <summary>
    /// Troca um refresh token por um par novo, consumindo o antigo.
    ///
    /// A rotação é o que limita o estrago de um token roubado: ele só vale até o dono legítimo
    /// renovar, e a partir daí a apresentação do token velho falha.
    /// </summary>
    public async Task<AuthResult> RefreshAsync(string? refreshToken, string? device, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
            return AuthResult.Fail(AuthFailure.InvalidRefreshToken);

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
    public async Task LogoutAsync(string? refreshToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken)) return;

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
