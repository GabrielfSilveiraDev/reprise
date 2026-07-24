namespace Reprise.Domain.Entities;

/// <summary>
/// Dono dos dados (tenant). Hoje há uma única linha semente; a fundação já é multi-tenant.
/// Na fase da API, o ASP.NET Identity passa a governar esta tabela (IdentityUser&lt;Guid&gt;
/// mapeado para o mesmo <c>users</c>), mantendo <see cref="Id"/> estável como chave de tenant.
/// </summary>
public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}
