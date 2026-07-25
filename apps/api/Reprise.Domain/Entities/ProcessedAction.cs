namespace Reprise.Domain.Entities;

/// <summary>
/// Registro de uma ação de escrita já aplicada, endereçada por uma chave que o <b>cliente</b> gera.
///
/// Existe por causa do app offline. Num CRUD comum, reenviar uma requisição que já chegou é inofensivo —
/// o PUT é idempotente por natureza. Aqui não: marcar duas vezes o mesmo episódio <i>significa</i> que você
/// assistiu duas vezes. Um POST que o servidor processou mas cuja resposta se perdeu no elevador viraria,
/// na retentativa, um rewatch que nunca aconteceu — exatamente o dado que este projeto existe para guardar.
///
/// O cliente gera um UUID por ação enfileirada e o reenvia em toda retentativa; a unicidade de
/// <c>(user_id, client_key)</c> no banco é a garantia real (o pré-teste no serviço é só para evitar
/// o custo da exceção no caso comum).
/// </summary>
public class ProcessedAction
{
    public long Id { get; set; }

    public Guid UserId { get; set; }

    /// <summary>UUID gerado no dispositivo, estável entre retentativas da mesma ação.</summary>
    public string ClientKey { get; set; } = null!;

    /// <summary>Que ação foi aplicada — diagnóstico e auditoria; não participa da chave.</summary>
    public string Kind { get; set; } = null!;

    public DateTimeOffset AppliedAt { get; set; }

    private ProcessedAction() { }

    public static ProcessedAction Create(Guid userId, string clientKey, string kind)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(clientKey);
        return new ProcessedAction
        {
            UserId = userId,
            ClientKey = clientKey,
            Kind = kind,
            AppliedAt = DateTimeOffset.UtcNow
        };
    }
}
