/**
 * A marca do Reprise, como geometria compartilhada.
 *
 * <b>Por que geometria, e não dois arquivos de imagem.</b> Web e app precisam do mesmo símbolo, e
 * duas cópias divergem no primeiro ajuste — foi exatamente o que aconteceu com metade da interface
 * antes desta rodada. Aqui a forma é a fonte única; cada cliente a desenha com o que a plataforma
 * dele sabe fazer (HTML inline no web, `react-native-svg` no Android).
 *
 * <b>O desenho.</b> Quatro barras verticais de alturas crescentes: é a trilha de rewatch do
 * próprio app — um bloco por exibição, altura proporcional a quantas vezes você voltou. Um arco
 * sai do topo da barra mais alta e volta ao pé da primeira, fazendo o gesto de repetição sem
 * desenhar uma seta: voltar ao começo é o que o nome quer dizer. Nada de "play" em círculo, que é
 * o que todo aplicativo de vídeo já usa e não diz nada sobre reassistir.
 */

export const LOGO_VIEWBOX = '0 0 28 28';

export interface LogoBar {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A rampa de alturas, na mesma proporção da trilha de episódios: intensidade 1 a 4. */
export const LOGO_BARS: readonly LogoBar[] = [
  { x: 3, y: 18, width: 4, height: 7 },
  { x: 9, y: 14, width: 4, height: 11 },
  { x: 15, y: 10, width: 4, height: 15 },
  { x: 21, y: 6, width: 4, height: 19 },
];

/**
 * O arco de retorno. É a única curva num símbolo de retas, que é o que faz o olho notá-la.
 */
export const LOGO_RETURN_ARC = 'M23 5 A 11 11 0 0 0 3 9';

/**
 * As cores das barras, do mesmo jeito nos dois clientes: a rampa da trilha de rewatch, do passo
 * mais fraco ao mais forte. É a rampa que os blocos de episódio já usam, então a marca é
 * literalmente um pedaço da interface.
 *
 * O web passa as variáveis CSS (que respondem ao tema sozinhas) e o Android passa os valores do
 * tema resolvido — mesma rampa, mecanismos diferentes.
 */
export const LOGO_WEB_BAR_COLORS: readonly string[] = [
  'var(--track-1)',
  'var(--track-2)',
  'var(--track-3)',
  'var(--track-4)',
];

export interface LogoOptions {
  /** Cor do arco. Padrão: `currentColor`, para herdar o texto ao redor. */
  readonly color?: string;
  /** Uma cor por barra, na ordem. Faltando alguma, cai em `color`. */
  readonly barColors?: readonly string[];
  readonly size?: number;
  /** Rótulo para leitor de tela. Vazio deixa o símbolo decorativo. */
  readonly title?: string;
}

/** O SVG completo, para onde HTML puro é aceito. */
export function repriseLogoSvg(options: LogoOptions = {}): string {
  const { color = 'currentColor', barColors, size = 32, title } = options;

  const bars = LOGO_BARS.map((b, i) => {
    const fill = barColors?.[i] ?? color;
    return `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="1.2" fill="${fill}"/>`;
  }).join('');

  const arc =
    `<path d="${LOGO_RETURN_ARC}" fill="none" stroke="${color}" ` +
    `stroke-width="2" stroke-linecap="round" opacity="0.55"/>`;

  const a11y = title
    ? `role="img" aria-label="${title}"`
    : 'role="presentation" aria-hidden="true" focusable="false"';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="${LOGO_VIEWBOX}" ${a11y}>${arc}${bars}</svg>`
  );
}
