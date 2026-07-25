namespace Reprise.Application.Abstractions;

/// <summary>
/// Envio de e-mail. Uma interface, e não `SmtpClient` espalhado, porque quem manda o código de
/// validação não deveria saber o que é SMTP — e porque sem isso não há como testar o cadastro
/// sem um servidor de e-mail no caminho.
/// </summary>
public interface IEmailSender
{
    /// <summary>
    /// Devolve <c>false</c> quando o envio não aconteceu. <b>Não lança:</b> um e-mail que não sai
    /// não pode derrubar o cadastro — a conta já foi criada, e o usuário precisa da tela de
    /// "digite o código", não de um erro 500.
    /// </summary>
    Task<bool> SendAsync(string toEmail, string subject, string body, CancellationToken cancellationToken = default);

    /// <summary>
    /// Se há para onde mandar. Falso quando o SMTP não está configurado — a API então registra o
    /// código no log em vez de fingir que enviou.
    /// </summary>
    bool IsConfigured { get; }
}
