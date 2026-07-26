/**
 * Tokens do Reprise no Android — os **mesmos valores** do `tokens.css` do web, não uma
 * paleta paralela. Já foram medidos para passar em AA (4,5:1 texto, 3:1 objeto gráfico) nos
 * dois temas; recolorir aqui significaria remedir tudo e conviver com duas identidades.
 *
 * Claro e escuro são nativos: cada tema tem seus próprios valores, nenhum deriva do outro.
 */

import type { TextStyle } from 'react-native';

/**
 * O contrato de um tema. Declarado antes da tabela para que claro e escuro sejam o **mesmo**
 * tipo — sem isso, `as const` daria a cada tema um tipo de literais próprios e trocar de tema
 * viraria erro de compilação.
 */
export interface Theme {
  readonly bg: string;
  readonly bgRaised: string;
  readonly bgSunken: string;
  readonly bgHover: string;

  readonly border: string;
  readonly borderStrong: string;

  readonly fg: string;
  readonly fgMuted: string;
  readonly fgSubtle: string;

  readonly accent: string;
  readonly accentFg: string;
  readonly accentQuiet: string;

  readonly focus: string;
  readonly danger: string;

  readonly trackEmpty: string;
  /** Rampa de 4 passos da trilha de exibições, do menos ao mais assistido. */
  readonly track: readonly string[];

  /**
   * Estado da série — três cores para três respostas diferentes a "já acabou?".
   *
   * <b>Não é a rampa da trilha.</b> A rampa é sequencial (mede intensidade de rewatch); isto é
   * categórico: "faltam episódios", "vi tudo mas vem mais" e "vi tudo e acabou" não são graus da
   * mesma coisa. Usar a rampa faria "finalizada" parecer só "mais em progresso".
   *
   * <b>Não é verde.</b> Verde para "concluída" seria o óbvio e foi a primeira tentativa, mas
   * âmbar × verde dá ΔE 3,9 em protanopia — indistinguíveis para quem não enxerga vermelho.
   * Âmbar/azul/rosa passa em todos os pares, pior caso ΔE 10,7.
   *
   * Os mesmos valores do web, em `tokens.css`. Cor é sempre reforço: o estado também aparece por
   * texto no selo e no rótulo.
   */
  readonly state: {
    readonly progress: string;
    readonly upToDate: string;
    readonly finished: string;
    /** Texto sobre os selos preenchidos. */
    readonly fg: string;
  };
}

export const Colors: { readonly light: Theme; readonly dark: Theme } = {
  light: {
    bg: '#fbfaf8',
    bgRaised: '#ffffff',
    bgSunken: '#f2efea',
    bgHover: '#ece8e1',

    border: '#ded8cf',
    borderStrong: '#978d7d',

    fg: '#1a1815',
    fgMuted: '#5c554a',
    fgSubtle: '#736c60',

    accent: '#9a5b00',
    accentFg: '#ffffff',
    accentQuiet: '#f0e2cd',

    focus: '#1b4fa8',
    danger: '#a12a1c',

    trackEmpty: '#e6e1d9',
    track: ['#b8831f', '#9e6c14', '#82550a', '#653f02'],
    state: { progress: '#9a5b00', upToDate: '#1b4fa8', finished: '#8c2d6b', fg: '#ffffff' },
  },
  dark: {
    bg: '#14130f',
    bgRaised: '#1d1b16',
    bgSunken: '#0e0d0a',
    bgHover: '#292620',

    border: '#35312a',
    borderStrong: '#6a6350',

    fg: '#f2eee6',
    fgMuted: '#b3aa99',
    fgSubtle: '#8d8474',

    accent: '#e8b25f',
    accentFg: '#14130f',
    accentQuiet: '#3a2f1a',

    focus: '#7fa8f0',
    danger: '#e8836f',

    trackEmpty: '#2a271f',
    track: ['#8f713a', '#b08c45', '#cfa552', '#e8b25f'],
    state: { progress: '#e8b25f', upToDate: '#7fa8f0', finished: '#e07aab', fg: '#14130f' },
  },
};

/** Escala de 4px, igual à do web. */
export const Spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  8: 48,
} as const;

export const Radius = { sm: 2, md: 4, lg: 8 } as const;

/**
 * O rótulo pequeno em versalete que abre cada tela ("Próximos", "Acervo", "Perfil").
 *
 * A caixa alta vem do **estilo**, nunca do texto. Escrever `PRÓXIMOS` no JSX mudaria o conteúdo
 * de verdade, e leitor de tela costuma soletrar palavra inteiramente maiúscula — "P-R-Ó-X..." em
 * vez de "próximos". O web já fazia certo com `text-transform: uppercase` no CSS; isto é o
 * equivalente aqui, e é o que mantém as duas plataformas dizendo a mesma coisa.
 */
export const EyebrowStyle: TextStyle = {
  fontSize: 12,
  letterSpacing: 1.2,
  fontWeight: '700',
  textTransform: 'uppercase',
};

export const FontSize = {
  xs: 12,
  sm: 13,
  base: 15,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Alvo mínimo de toque. A WCAG 2.2 AA (2.5.8) pede 24px e o Material pede 48dp; ficamos com 48,
 * que é o mais exigente dos dois — a lista de episódios é feita de linhas coladas e o dedo erra.
 */
export const TouchTarget = 48;
