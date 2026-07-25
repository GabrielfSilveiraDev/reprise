import { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useIsDark, useTheme } from '@/hooks/use-theme';

/**
 * `retry: false` de propósito. A retentativa de leitura já existe, uma camada abaixo: o
 * `SyncEngine` tenta a rede e cai para o cache em SQLite. Repetir aqui só atrasaria a tela
 * antes de mostrar o dado de ontem, que é justamente o que o usuário quer ver sem rede.
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export default function RootLayout() {
  const t = useTheme();
  const isDark = useIsDark();

  // O tema de navegação do expo-router é montado a partir dos MESMOS tokens do resto do app,
  // senão o cabeçalho ficaria com a paleta padrão do React Navigation e destoaria.
  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: t.accent,
        background: t.bg,
        card: t.bgRaised,
        text: t.fg,
        border: t.border,
      },
    };
  }, [isDark, t]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerTitleStyle: { fontWeight: '700' } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="series/[id]" options={{ title: '' }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
