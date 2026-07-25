/**
 * A marca do Reprise, como SVG gerado em código.
 *
 * <b>Por que aqui, e não dois arquivos de imagem.</b> Web e app precisam do mesmo símbolo, e duas
 * cópias divergem no primeiro ajuste — foi exatamente o que aconteceu com metade da interface
 * antes desta rodada. Sendo função, o símbolo é um só e cada cliente pede o tamanho e a cor que
 * couberem.
 *
 * <b>O desenho.</b> Quatro barras verticais de alturas crescentes: é a trilha de rewatch do
 * próprio app — um bloco por exibição, altura proporcional a quantas vezes você voltou. A quarta
 * barra dobra para a esquerda, formando a seta de repetição sem desenhar uma seta: o gesto de
 * voltar ao começo é o que o nome quer dizer. Nada de "play" em círculo, que é o que todo
 * aplicativo de vídeo já usa e não diz nada sobre reassistir.
 */
export interface LogoOptions {
  /** Cor das barras. Padrão: `currentColor`, para herdar o texto ao redor. */
  readonly color?: string;
  /** Cor do traço de retorno. Padrão: a mesma das barras, com opacidade menor. */
  readonly accent?: string;
  readonly size?: number;
  /** Rótulo para leitor de tela. Vazio deixa o símbolo decorativo (`aria-hidden`). */
  readonly title?: string;
}

/** A rampa de alturas, na mesma proporção da trilha de episódios: 1, 2, 3, 4 de intensidade. */
const BARS = [
  { x: 3, h: 7 },
  { x: 9, h: 11 },
  { x: 15, h: 15 },
  { x: 21, h: 19 },
] as const;

export function repriseLogoSvg(options: LogoOptions = {}): string {
  const { color = 'currentColor', accent, size = 32, title } = options;
  const stroke = accent ?? color;

  const bars = BARS.map(
    (b) => `<rect x="${b.x}" y="${25 - b.h}" width="4" height="${b.h}" rx="1.2" fill="${color}"/>`,
  ).join('');

  // O arco de retorno: sai do topo da barra mais alta e volta ao pé da primeira. É o "re" de
  // reprise — a única linha curva num símbolo de retas, que é o que faz o olho notá-la.
  const arc =
    `<path d="M23 5 A 11 11 0 0 0 3 9" fill="none" stroke="${stroke}" ` +
    `stroke-width="2" stroke-linecap="round" opacity="0.55"/>`;

  const a11y = title
    ? `role="img" aria-label="${title}"`
    : 'role="presentation" aria-hidden="true" focusable="false"';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 28 28" ${a11y}>${arc}${bars}</svg>`
  );
}

/** Uma data URI, para onde só cabe uma `src` de imagem. */
export function repriseLogoDataUri(options: LogoOptions = {}): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(repriseLogoSvg(options))}`;
}
