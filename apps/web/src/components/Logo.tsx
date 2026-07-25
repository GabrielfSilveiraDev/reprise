import { repriseLogoSvg } from '@reprise/shared';

/**
 * A marca, inline.
 *
 * <b>`dangerouslySetInnerHTML` aqui é seguro e deliberado.</b> O SVG vem de uma função nossa em
 * `@reprise/shared`, sem nenhuma entrada de fora — não há string de usuário no caminho. Inline, e
 * não `<img>`, porque assim o símbolo herda `currentColor` e acompanha o tema sem duas versões.
 */
export function Logo({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <span
      className="logo"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: repriseLogoSvg({ size, title }) }}
    />
  );
}
