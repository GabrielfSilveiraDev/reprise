import { useColorScheme } from 'react-native';
import { useTokens } from '@/design/registry';
import type { Theme } from '@/constants/theme';

/**
 * As cores em vigor: as do design escolhido, no tema do sistema.
 *
 * <b>Por que este hook passou a olhar o design.</b> Ele já era o ponto por onde TODA cor entrava
 * nas telas — `episode-row`, `calendar-heatmap`, `series-card`, `bar-chart`, `premiere-strip`,
 * `sync-bar`. Fazendo-o devolver os tokens do design ativo, essas peças acompanham o design
 * escolhido sem uma linha de mudança em nenhuma delas. A alternativa era manter quatro cópias de
 * cada componente — que é a forma clássica de os designs divergirem em silêncio no dia em que
 * alguém conserta um bug em três dos quatro.
 *
 * O contrato não mudou: `DesignTokens` estende {@link Theme}, então quem só lê cor continua vendo
 * exatamente o que via. Com o design clássico ativo os valores são idênticos aos de antes.
 *
 * O tema continua seguindo o do sistema — o app não sabe melhor que o Android se é dia ou noite.
 */
export function useTheme(): Theme {
  return useTokens();
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
