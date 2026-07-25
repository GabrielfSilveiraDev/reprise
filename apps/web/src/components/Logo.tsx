import { LOGO_WEB_BAR_COLORS, repriseLogoSvg } from '@reprise/shared';

/**
 * A marca, inline.
 *
 * <b>`dangerouslySetInnerHTML` aqui é seguro e deliberado.</b> O SVG vem de uma função nossa em
 * `@reprise/shared`, sem nenhuma entrada de fora — não há string de usuário no caminho. Inline, e
 * não `<img>`, porque assim o símbolo herda `currentColor` e as variáveis de tema resolvem
 * sozinhas: uma única marca serve o tema claro e o escuro, sem duas versões do arquivo.
 */
export function Logo({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <span
      className="logo"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{
        __html: repriseLogoSvg({ size, title, barColors: LOGO_WEB_BAR_COLORS }),
      }}
    />
  );
}
