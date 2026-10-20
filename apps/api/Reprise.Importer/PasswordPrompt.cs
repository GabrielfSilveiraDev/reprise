using System.Text;

namespace Reprise.Importer;

/// <summary>
/// Pergunta a senha no terminal, sem mostrá-la — para o <c>passwd</c> rodar sem <c>--password</c>.
///
/// <para>
/// A senha na linha de comando fica no histórico do terminal e aparece na lista de processos da
/// máquina. Perguntada, ela só passa pelo teclado. Com a entrada redirecionada (um script mandando
/// a senha por pipe), não há teclado: lê linhas, sem máscara.
/// </para>
/// </summary>
public sealed class PasswordPrompt
{
    private readonly TextReader _input;
    private readonly TextWriter _output;
    private readonly bool _interactive;

    public PasswordPrompt(TextReader input, TextWriter output, bool interactive)
    {
        _input = input;
        _output = output;
        _interactive = interactive;
    }

    /// <summary>O console de verdade: interativo quando a entrada não vem de um pipe.</summary>
    public static PasswordPrompt FromConsole()
        => new(Console.In, Console.Out, interactive: !Console.IsInputRedirected);

    /// <summary>A senha digitada duas vezes, ou <c>null</c> quando as duas não conferem ou vêm vazias.</summary>
    public string? AskTwice()
    {
        var first = Ask("Nova senha: ");
        var second = Ask("Repita a senha: ");
        return string.IsNullOrEmpty(first) || first != second ? null : first;
    }

    private string Ask(string label)
    {
        _output.Write(label);
        if (!_interactive) return _input.ReadLine() ?? "";

        var typed = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) break;
            if (key.Key == ConsoleKey.Backspace)
            {
                if (typed.Length == 0) continue;
                typed.Length--;
                _output.Write("\b \b");
            }
            else if (!char.IsControl(key.KeyChar))
            {
                typed.Append(key.KeyChar);
                _output.Write('*');
            }
        }
        _output.WriteLine();
        return typed.ToString();
    }
}
