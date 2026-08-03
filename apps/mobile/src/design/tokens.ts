/**
 * Os tokens de cada design.
 *
 * <b>Estende {@link Theme}, não substitui.</b> Componentes que já existem — `episode-row`,
 * `calendar-heatmap`, `series-card` — leem as cores pelo contrato do tema. Se um design trouxesse
 * uma paleta de forma diferente, cada um deles teria de ser reescrito quatro vezes. Herdando o
 * contrato, um design novo é uma tabela de valores, não uma refatoração.
 *
 * <b>Cada design traz claro E escuro.</b> O tema segue o do sistema (ver `useTheme`), e um design
 * que só existisse no escuro apareceria quebrado para quem usa o aparelho no claro.
 *
 * <b>Contraste é requisito, não gosto.</b> Os pares de texto sobre fundo aqui foram escolhidos
 * para ficar acima de 4,5:1, e os de objeto gráfico acima de 3:1. Um design pode ser sóbrio,
 * denso ou dramático; nenhum pode ser ilegível.
 */
import type { TextStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import type { Theme } from '@/constants/theme';

/** O que um design controla além das cores. É aqui que "denso" e "arejado" viram números. */
export interface DesignShape {
  /** Escala de espaçamento. O design denso encolhe; o editorial estica. */
  readonly space: (n: 1 | 2 | 3 | 4 | 5 | 6 | 8) => number;
  /** Cantos. `0` no cinematográfico (imagem sangra), generoso no tátil. */
  readonly radius: { readonly sm: number; readonly md: number; readonly lg: number };
  readonly font: {
    readonly xs: number;
    readonly sm: number;
    readonly base: number;
    readonly lg: number;
    readonly xl: number;
    readonly xxl: number;
  };
  /** O rótulo pequeno que abre cada tela. Muda de caráter entre designs. */
  readonly eyebrow: TextStyle;
  /** Título de tela. */
  readonly title: TextStyle;
  /** Cabeçalho de seção dentro da tela. */
  readonly section: TextStyle;
  /** Proporção da capa nas listas: `2/3` é o pôster; `16/9` vira faixa. */
  readonly posterAspect: number;
  /** Cartões têm borda visível? O editorial usa fio de cabelo; o tátil usa sombra e nenhuma. */
  readonly cardBorder: boolean;
  /** Elevação dos cartões (Android). Zero na maioria; o tátil usa. */
  readonly elevation: number;
}

export interface DesignTokens extends Theme {
  readonly shape: DesignShape;
}

/** Escala de 4px — a base de todos, esticada ou encolhida por design. */
function escala(fator: number) {
  const base = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 8: 48 } as const;
  return (n: 1 | 2 | 3 | 4 | 5 | 6 | 8) => Math.round(base[n] * fator);
}

/* ── clássico ──────────────────────────────────────────────────────────────────────────────── */

const formaClassico: DesignShape = {
  space: escala(1),
  radius: { sm: 2, md: 4, lg: 8 },
  font: { xs: 12, sm: 13, base: 15, lg: 18, xl: 24, xxl: 32 },
  eyebrow: { fontSize: 12, letterSpacing: 1.2, fontWeight: '700', textTransform: 'uppercase' },
  title: { fontSize: 24, fontWeight: '700' },
  section: { fontSize: 15, fontWeight: '700' },
  posterAspect: 2 / 3,
  cardBorder: true,
  elevation: 0,
};

/* ── cinematográfico ───────────────────────────────────────────────────────────────────────── */
/*
 * Preto de sala escura, imagem sangrando até a borda e quase nenhum enfeite.
 *
 * Cantos em zero de propósito: capa arredondada vira "cartão", e a aposta deste design é que a
 * imagem NÃO é um elemento de interface — é o conteúdo. O acento é âmbar quente, o mesmo da marca,
 * porque vermelho sobre preto num app de séries seria imitar o serviço de streaming óbvio.
 */
const cinemaEscuro: DesignTokens = {
  bg: '#000000',
  bgRaised: '#0b0b0c',
  bgSunken: '#000000',
  bgHover: '#17171a',

  border: '#232327',
  borderStrong: '#6f6f77',

  fg: '#ffffff',
  fgMuted: '#b6b6bd',
  fgSubtle: '#8a8a93',

  accent: '#f0b429',
  accentFg: '#000000',
  accentQuiet: '#3d2f0c',

  focus: '#8ab4ff',
  danger: '#ff6f5e',

  trackEmpty: '#1c1c20',
  track: ['#7a5d18', '#a37a1e', '#cb9826', '#f0b429'],
  state: { progress: '#f0b429', upToDate: '#8ab4ff', finished: '#ef7fb4', fg: '#000000' },

  shape: {
    space: escala(1),
    radius: { sm: 0, md: 0, lg: 0 },
    font: { xs: 11, sm: 13, base: 15, lg: 20, xl: 28, xxl: 40 },
    eyebrow: { fontSize: 11, letterSpacing: 3, fontWeight: '700', textTransform: 'uppercase' },
    title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    section: { fontSize: 13, letterSpacing: 2, fontWeight: '700', textTransform: 'uppercase' },
    posterAspect: 2 / 3,
    cardBorder: false,
    elevation: 0,
  },
};

/** No claro vira galeria: paredes brancas, imagem ainda mandando. */
const cinemaClaro: DesignTokens = {
  ...cinemaEscuro,
  bg: '#ffffff',
  bgRaised: '#f6f6f7',
  bgSunken: '#ececee',
  bgHover: '#e2e2e5',

  border: '#dcdce0',
  borderStrong: '#8a8a93',

  fg: '#0a0a0b',
  fgMuted: '#4a4a52',
  fgSubtle: '#6c6c75',

  accent: '#8a5a00',
  accentFg: '#ffffff',
  accentQuiet: '#f3e6cc',

  focus: '#1b4fa8',
  danger: '#a12a1c',

  trackEmpty: '#e4e4e7',
  track: ['#c69a3c', '#a87d24', '#8a6110', '#6b4805'],
  state: { progress: '#8a5a00', upToDate: '#1b4fa8', finished: '#8c2d6b', fg: '#ffffff' },
};

/* ── editorial ─────────────────────────────────────────────────────────────────────────────── */
/*
 * Papel. Muito respiro, fio de cabelo no lugar de caixa, e hierarquia feita por TAMANHO e PESO de
 * texto — não por cor nem por fundo colorido.
 *
 * A cor quase não trabalha aqui: só o acento (tinta vermelha de revisão) e o preto do texto. Um
 * design que hierarquiza por tipografia é o único do conjunto que continua legível impresso em
 * preto e branco, e essa é a prova de que a hierarquia é real.
 */
const editorialClaro: DesignTokens = {
  bg: '#faf8f4',
  bgRaised: '#ffffff',
  bgSunken: '#f1ede5',
  bgHover: '#eae5db',

  border: '#ded8cc',
  borderStrong: '#8c8477',

  fg: '#14120f',
  fgMuted: '#57514a',
  fgSubtle: '#7d7669',

  accent: '#9e2b25',
  accentFg: '#ffffff',
  accentQuiet: '#f2dedd',

  focus: '#1b4fa8',
  danger: '#9e2b25',

  trackEmpty: '#e7e2d8',
  track: ['#b3a58c', '#8f8570', '#6d6455', '#3f3a31'],
  state: { progress: '#9e2b25', upToDate: '#1b4fa8', finished: '#3f3a31', fg: '#ffffff' },

  shape: {
    space: escala(1.5),
    radius: { sm: 0, md: 2, lg: 2 },
    font: { xs: 12, sm: 14, base: 17, lg: 22, xl: 34, xxl: 46 },
    eyebrow: { fontSize: 11, letterSpacing: 2.4, fontWeight: '600', textTransform: 'uppercase' },
    title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.8 },
    section: { fontSize: 12, letterSpacing: 2, fontWeight: '700', textTransform: 'uppercase' },
    posterAspect: 2 / 3,
    cardBorder: false,
    elevation: 0,
  },
};

const editorialEscuro: DesignTokens = {
  ...editorialClaro,
  bg: '#12110f',
  bgRaised: '#1a1917',
  bgSunken: '#0c0b0a',
  bgHover: '#252320',

  border: '#302d29',
  borderStrong: '#6f6a60',

  fg: '#f5f1e8',
  fgMuted: '#b5aea1',
  fgSubtle: '#8b8478',

  accent: '#e8756c',
  accentFg: '#12110f',
  accentQuiet: '#3a221f',

  focus: '#7fa8f0',
  danger: '#e8756c',

  trackEmpty: '#26241f',
  track: ['#4f4a40', '#6d6656', '#8f8570', '#b3a58c'],
  state: { progress: '#e8756c', upToDate: '#7fa8f0', finished: '#c9c0ad', fg: '#12110f' },
};

/* ── painel denso ──────────────────────────────────────────────────────────────────────────── */
/*
 * Ferramenta, não vitrine. Tudo encolhe, tudo ganha borda, e o número vem antes da imagem.
 *
 * Cinza neutro em vez do âmbar da marca porque aqui a cor precisa estar disponível para SIGNIFICAR
 * — progresso, atraso, conclusão. Uma interface já colorida não tem onde destacar o dado.
 */
const painelEscuro: DesignTokens = {
  bg: '#0f1115',
  bgRaised: '#161920',
  bgSunken: '#0a0c0f',
  bgHover: '#1f232c',

  border: '#272c36',
  borderStrong: '#5d6675',

  fg: '#e8ecf2',
  fgMuted: '#9aa3b2',
  fgSubtle: '#78818f',

  accent: '#4c9aff',
  accentFg: '#0a0c0f',
  accentQuiet: '#16283f',

  focus: '#4c9aff',
  danger: '#ff6f5e',

  trackEmpty: '#1c2029',
  track: ['#24486f', '#2f6299', '#3b7cc4', '#4c9aff'],
  state: { progress: '#4c9aff', upToDate: '#43c08a', finished: '#b489f0', fg: '#0a0c0f' },

  shape: {
    space: escala(0.75),
    radius: { sm: 2, md: 3, lg: 4 },
    font: { xs: 10, sm: 12, base: 13, lg: 15, xl: 19, xxl: 26 },
    eyebrow: { fontSize: 10, letterSpacing: 1.6, fontWeight: '700', textTransform: 'uppercase' },
    title: { fontSize: 19, fontWeight: '700' },
    section: { fontSize: 11, letterSpacing: 1.4, fontWeight: '700', textTransform: 'uppercase' },
    // Faixa larga em vez de pôster: numa lista densa o 2/3 come a altura de três linhas de dado.
    posterAspect: 1,
    cardBorder: true,
    elevation: 0,
  },
};

const painelClaro: DesignTokens = {
  ...painelEscuro,
  bg: '#f4f6f9',
  bgRaised: '#ffffff',
  bgSunken: '#e8ecf1',
  bgHover: '#dde3ea',

  border: '#d3d9e2',
  borderStrong: '#7c8697',

  fg: '#11151b',
  fgMuted: '#4d5666',
  fgSubtle: '#6b7484',

  accent: '#1257c2',
  accentFg: '#ffffff',
  accentQuiet: '#dbe7fb',

  focus: '#1257c2',
  danger: '#b3261e',

  trackEmpty: '#e2e7ee',
  track: ['#9dbdec', '#6b9ade', '#3b78ce', '#1257c2'],
  state: { progress: '#1257c2', upToDate: '#136c47', finished: '#6b3fa0', fg: '#ffffff' },
};

/* ── tabela ────────────────────────────────────────────────────────────────────────────────── */

export type DesignId = 'classico' | 'cinema' | 'editorial' | 'painel';

export const TOKENS: Record<DesignId, { readonly light: DesignTokens; readonly dark: DesignTokens }> =
  {
    classico: {
      light: { ...Colors.light, shape: formaClassico },
      dark: { ...Colors.dark, shape: formaClassico },
    },
    cinema: { light: cinemaClaro, dark: cinemaEscuro },
    editorial: { light: editorialClaro, dark: editorialEscuro },
    painel: { light: painelClaro, dark: painelEscuro },
  };
