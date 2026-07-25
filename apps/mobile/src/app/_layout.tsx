import { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
// O tema de navegação vem do React Navigation, não do expo-router: o reexport que existe nas
// versões mais novas não está no expo-router 6, e depender dele prenderia o app a um SDK.
// Declarado explicitamente no package.json em vez de contar com o hoisting do pnpm.
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, View } from 'react-native';
import { AuthSession } from '@/api/session';
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

  /**
   * Ler o cofre é assíncrono, e renderizar antes da resposta piscaria a tela de login para quem
   * já está logado. Um indicador breve é melhor do que um salto.
   */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    AuthSession.read().then((s) => setSignedIn(s !== null));
  }, []);

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
        {signedIn === null ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
            <ActivityIndicator color={t.accent} />
          </View>
        ) : (
          <Stack
            // A rota inicial depende da sessão: sem ela, o app abre no login e as abas nem
            // chegam a montar — nenhuma tela protegida pisca antes de o redirecionamento ocorrer.
            initialRouteName={signedIn ? '(tabs)' : 'login'}
            screenOptions={{ headerTitleStyle: { fontWeight: '700' } }}
          >
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="series/[id]" options={{ title: '' }} />
          </Stack>
        )}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
