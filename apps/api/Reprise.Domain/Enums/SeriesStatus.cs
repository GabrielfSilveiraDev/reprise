namespace Reprise.Domain.Enums;

/// <summary>
/// Estado do ciclo de vida da relação do usuário com uma série.
/// São mutuamente exclusivos; <see cref="Finished"/> pode ser derivado do progresso
/// (todas as temporadas regulares vistas) ou marcado explicitamente.
/// </summary>
public enum SeriesStatus
{
    Following = 0,
    Archived = 1,
    ForLater = 2,
    Finished = 3
}
