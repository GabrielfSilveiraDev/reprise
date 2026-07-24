namespace Reprise.Application.Abstractions;

/// <summary>
/// Provê o tenant atual. Hoje resolve para o usuário-semente; na fase da API,
/// resolve o <c>sub</c> do JWT. É o que alimenta o filtro global de tenant do EF Core.
/// </summary>
public interface ICurrentUser
{
    Guid UserId { get; }
}
