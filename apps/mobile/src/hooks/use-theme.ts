import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';
import type { Theme } from '@/constants/theme';

/** O tema segue o do sistema. Sem alternador próprio: o app não sabe melhor que o Android. */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? Colors.dark : Colors.light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
