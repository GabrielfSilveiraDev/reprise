using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Reprise.Application.Abstractions;

namespace Reprise.Infrastructure.Email;

public sealed class SmtpOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string User { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromAddress { get; set; } = string.Empty;
    public string FromName { get; set; } = "Reprise";
    public bool UseSsl { get; set; } = true;

    public bool IsComplete =>
        !string.IsNullOrWhiteSpace(Host) && !string.IsNullOrWhiteSpace(FromAddress);
}

/// <summary>
/// Envio por SMTP, com um comportamento deliberado quando não há SMTP configurado.
///
/// <para>
/// <b>Sem configuração, o código vai para o log em vez de sumir.</b> A alternativa seria recusar
/// o cadastro numa instalação sem servidor de e-mail — o que impediria alguém de rodar o Reprise
/// em casa só por não ter SMTP. Devolver o código na resposta HTTP também não serve: aí qualquer
/// um confirma a conta de qualquer e-mail. O log é o meio-termo honesto: quem tem acesso ao
/// servidor consegue o código; quem só tem a URL, não.
/// </para>
///
/// <para>
/// Usa <see cref="SmtpClient"/>, obsoleto e limitado (sem OAuth, sem MIME rico). Para um código de
/// seis dígitos em texto puro isso basta, e trazer MailKit para enviar uma frase seria peso sem
/// contrapartida. Quando o e-mail passar a ter HTML ou anexo, a troca é de uma classe só — a
/// interface já isola.
/// </para>
/// </summary>
public sealed class SmtpEmailSender : IEmailSender
{
    private readonly SmtpOptions _options;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IOptions<SmtpOptions> options, ILogger<SmtpEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public bool IsConfigured => _options.IsComplete;

    public async Task<bool> SendAsync(
        string toEmail, string subject, string body, CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            _logger.LogWarning(
                "SMTP não configurado. E-mail para {To} NÃO enviado. Assunto: {Subject}. Corpo:\n{Body}",
                toEmail, subject, body);
            return false;
        }

        try
        {
            using var client = new SmtpClient(_options.Host, _options.Port) { EnableSsl = _options.UseSsl };

            if (!string.IsNullOrWhiteSpace(_options.User))
                client.Credentials = new NetworkCredential(_options.User, _options.Password);

            using var message = new MailMessage
            {
                From = new MailAddress(_options.FromAddress, _options.FromName),
                Subject = subject,
                Body = body,
                IsBodyHtml = false
            };
            message.To.Add(toEmail);

            await client.SendMailAsync(message, cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            // Não relança: a conta já foi criada e o usuário precisa da tela de código, não de um
            // 500. O log guarda a causa, e há um endpoint de reenvio para a segunda tentativa.
            _logger.LogError(ex, "Falha ao enviar e-mail para {To}.", toEmail);
            return false;
        }
    }
}
