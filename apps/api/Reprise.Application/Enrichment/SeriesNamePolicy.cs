using System.Text;

namespace Reprise.Application.Enrichment;

/// <summary>
/// Qual nome exibir para uma série.
///
/// A regra é: o <b>título original</b> manda — é como a série é conhecida e como o usuário
/// a procura. Mas título original só serve se der para ler: "ナルト- 疾風伝" não ajuda ninguém
/// que não lê japonês. Então, quando o original não está em alfabeto latino, cai para o
/// título em inglês, que é o nome pelo qual anime, dorama e série russa circulam por aqui.
///
/// O nome traduzido para português fica de fora de propósito: era o que vinha antes
/// ("Como Eu Conheci Sua Mãe") e é justamente o que se quis evitar.
/// </summary>
public static class SeriesNamePolicy
{
    /// <param name="originalName">`original_name` do TMDB — sempre no idioma de origem.</param>
    /// <param name="englishName">`name` consultado em en-US. Só é usado se o original não for legível.</param>
    /// <param name="fallback">Último recurso quando os dois vierem vazios (o nome provisório do export).</param>
    public static string Choose(string? originalName, string? englishName, string fallback)
    {
        if (IsLatinScript(originalName)) return originalName!.Trim();
        if (!string.IsNullOrWhiteSpace(englishName)) return englishName.Trim();
        if (!string.IsNullOrWhiteSpace(originalName)) return originalName.Trim();
        return fallback;
    }

    /// <summary>
    /// True quando o texto tem letras e TODAS elas são latinas. Acentos, cedilha e Ø contam
    /// como latinas; kana, hanzi, hangul, cirílico, grego, árabe e hebraico não.
    /// Dígitos, pontuação e espaço são ignorados — "3%" e "9-1-1" não têm letra nenhuma e
    /// caem no caminho do inglês, que para eles dá no mesmo.
    /// </summary>
    public static bool IsLatinScript(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;

        var sawLetter = false;
        foreach (var rune in text.EnumerateRunes())
        {
            if (!Rune.IsLetter(rune)) continue;
            sawLetter = true;
            if (!IsLatinLetter(rune)) return false;
        }

        return sawLetter;
    }

    private static bool IsLatinLetter(Rune rune) =>
        rune.Value switch
        {
            <= 0x024F => true,   // Basic Latin + Latin-1 Supplement + Latin Extended-A/B
            >= 0x1E00 and <= 0x1EFF => true, // Latin Extended Additional (vietnamita, por ex.)
            _ => false,
        };
}
