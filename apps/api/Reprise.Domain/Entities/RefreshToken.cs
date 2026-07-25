using System.Security.Cryptography;

namespace Reprise.Domain.Entities;

/// <summary>
/// Uma sessão de longa duração. Existe para que o token de acesso possa ser curto.
///
/// <para>
/// Sem isto, a escolha seria entre um JWT de meia hora (que faria o app pedir senha no meio da
/// série) e um JWT de trinta dias (que, uma vez vazado, vale trinta dias e não há como revogar,
/// porque JWT não se consulta — se verifica). O par resolve os dois: o acesso expira rápido e a
/// renovação é uma linha de banco que dá para apagar.
/// </para>
///
/// <para>
/// <b>O token não é guardado.</b> Só o hash SHA-256 dele. Um vazamento do banco não entrega
/// sessão de ninguém — é o mesmo raciocínio que se aplica a senha, e um refresh token vale tanto
/// quanto uma.
/// </para>
///
/// <para>
/// <b>Rotação a cada uso.</b> Renovar consome o token e emite outro. Se um token já usado
/// reaparecer, ou ele foi roubado ou o app perdeu a resposta e está repetindo — nos dois casos a
/// resposta segura é a mesma: recusar e obrigar a autenticar de novo.
/// </para>
/// </summary>
public class RefreshToken
{
    public long Id { get; set; }

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>SHA-256 do token, em hexadecimal. O valor original só existe no cliente.</summary>
    public string TokenHash { get; set; } = null!;

    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }

    /// <summary>De onde veio — diagnóstico de "que aparelhos estão logados".</summary>
    public string? Device { get; set; }

    public bool IsActive(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now;

    private RefreshToken() { }

    /// <summary>
    /// Gera um token novo. Devolve o valor <b>em claro</b> (que vai para o cliente e nunca mais é
    /// visto pelo servidor) junto da entidade, que guarda só o hash.
    /// </summary>
    public static (RefreshToken Entity, string PlainToken) Issue(
        Guid userId, TimeSpan lifetime, string? device, DateTimeOffset now)
    {
        var plain = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');

        var entity = new RefreshToken
        {
            UserId = userId,
            TokenHash = Hash(plain),
            ExpiresAt = now + lifetime,
            CreatedAt = now,
            Device = device
        };

        return (entity, plain);
    }

    public static string Hash(string plainToken)
        => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(plainToken)));
}
