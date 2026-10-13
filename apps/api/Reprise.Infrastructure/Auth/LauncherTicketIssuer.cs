using System.Linq.Expressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Reprise.Domain.Entities;
using Reprise.Infrastructure.Persistence;

namespace Reprise.Infrastructure.Auth;

/// <summary>O passe emitido, ou o motivo de não haver passe — dito para quem vai ler o log.</summary>
public sealed record LauncherTicket(string? Token, string? Problem)
{
    public bool Issued => Token is not null;
    public static LauncherTicket Ok(string token) => new(token, null);
    public static LauncherTicket Refused(string problem) => new(null, problem);
}

/// <summary>
/// O passe de entrada do launcher do Windows: um refresh token de <b>uso único e vida curta</b>
/// para o dono da instalação, emitido por quem alcança o banco — a CLI, que o launcher chama.
///
/// <para>
/// <b>Por que existe.</b> A janela do launcher tem perfil próprio, e a sessão dela se perde com um
/// "Sair" ou com a troca da origem (aconteceu na mudança de :5173 para :8080). Aí o dono, que
/// nunca digitou a senha desde que a sessão começou, fica na tela de login sem saber o que pôr.
/// O launcher pede um passe, abre a janela em <c>#entrar=&lt;passe&gt;</c>, e o web o troca pelo
/// <c>/auth/refresh</c> de sempre.
/// </para>
///
/// <para>
/// <b>Por que uma linha de refresh token.</b> Ela já tem tudo o que o passe precisa: é
/// aleatória, fica só como hash, expira, e o consumo é atômico e único (ver
/// <see cref="AuthService.RefreshAsync"/>). Mas o passe é trocado por uma rota SÓ DELE
/// (<c>/auth/launcher</c>), que recusa refresh token comum — e o <c>/auth/refresh</c> recusa passe.
/// Com uma rota só, qualquer pessoa com conta na instância mandaria um link
/// <c>#entrar=&lt;o refresh token dela&gt;</c>, e quem o abrisse entraria na conta dela sem perceber.
/// </para>
///
/// <para>
/// <b>Por que não um JWT assinado pelo launcher com o <c>Jwt:Secret</c>.</b> Foi o primeiro
/// desenho, e caiu por três motivos: (1) um segredo vazado viraria sessão de 60 dias que
/// sobrevive à troca do segredo — hoje trocá-lo encerra o estrago; (2) a validade seria julgada
/// com o relógio do Windows contra o da VM do Docker, que atrasa depois de o PC dormir; (3) o uso
/// único dependeria de cache em memória. Aqui o segredo do JWT fica fora do caminho, um relógio
/// só (o dos containers, na VM do Docker) decide, e o uso único mora no banco.
/// </para>
///
/// <para>
/// <b>Confiança.</b> Emitir exige alcançar o banco, e quem alcança o banco já lê e altera tudo —
/// inclusive define senha pela própria CLI (<c>passwd</c>). O passe não dá poder novo a ninguém;
/// só tira a senha do caminho de quem já é dono da máquina.
/// </para>
/// </summary>
public sealed class LauncherTicketIssuer
{
    /// <summary>
    /// Do pedido até a janela trocar o passe vão alguns segundos — o Chrome abrindo a frio e a
    /// página carregando. Cinco minutos sobram para isso e para um PC lento, e o passe que ninguém
    /// usou morre sozinho.
    /// </summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);

    /// <summary>Rótulo do passe na tabela de sessões. A sessão trocada ganha o do navegador.</summary>
    public const string DeviceLabel = "launcher do Windows";

    /// <summary>
    /// O que distingue um passe de uma sessão. O rótulo sozinho não bastaria — o de uma sessão vem
    /// do User-Agent, que quem faz login escolhe —, mas a vida curta só quem emite passe dá: toda
    /// sessão vive o <see cref="JwtOptions.RefreshTokenLifetime"/>, de dias.
    /// </summary>
    public static readonly Expression<Func<RefreshToken, bool>> IsTicket =
        r => r.Device == DeviceLabel && r.ExpiresAt - r.CreatedAt <= Lifetime;

    public static readonly Expression<Func<RefreshToken, bool>> IsNotTicket =
        r => !(r.Device == DeviceLabel && r.ExpiresAt - r.CreatedAt <= Lifetime);

    private readonly RepriseDbContext _db;
    private readonly UserManager<User> _users;
    private readonly TimeProvider _clock;

    public LauncherTicketIssuer(RepriseDbContext db, UserManager<User> users, TimeProvider clock)
    {
        _db = db;
        _users = users;
        _clock = clock;
    }

    /// <summary>
    /// Emite o passe para a conta do <paramref name="email"/> ou, sem ele, para a única conta
    /// confirmada. Com mais de uma conta e nenhum e-mail, recusa: adivinhar entregaria o histórico
    /// de uma pessoa a outra.
    /// </summary>
    public async Task<LauncherTicket> IssueAsync(string? email, CancellationToken ct = default)
    {
        User? owner;
        if (!string.IsNullOrWhiteSpace(email))
        {
            owner = await _users.FindByEmailAsync(email.Trim());
            if (owner is null) return LauncherTicket.Refused($"Nenhuma conta com o e-mail {email.Trim()}.");
            if (!owner.EmailConfirmed) return LauncherTicket.Refused($"A conta {owner.Email} ainda não validou o e-mail.");
        }
        else
        {
            var confirmed = await _db.Users.Where(u => u.EmailConfirmed).Take(2).ToListAsync(ct);
            if (confirmed.Count == 0)
                return LauncherTicket.Refused("Nenhuma conta confirmada neste banco. Crie a sua com o comando passwd.");
            if (confirmed.Count > 1)
                return LauncherTicket.Refused("Há mais de uma conta confirmada: diga qual entra direto (REPRISE_AUTOLOGIN_EMAIL no .env, ou --email).");
            owner = confirmed[0];
        }

        var (entity, plain) = RefreshToken.Issue(owner.Id, Lifetime, DeviceLabel, _clock.GetUtcNow());
        _db.RefreshTokens.Add(entity);
        await _db.SaveChangesAsync(ct);
        return LauncherTicket.Ok(plain);
    }
}
