import { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
// O tema de navegação vem do React Navigation, não do expo-router: o reexport que existe nas
// versões mais novas não está no expo-router 6, e depender dele prenderia o app a um SDK.
// Declarado explicitamente no package.json em vez de contar com o hoisting do pnpm.
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, View } from 'react-native';
import { AuthSession } from '@/api/session';
import { DesignProvider } from '@/design/registry';
import { useIsDark, useTheme } from '@/hooks/use-theme';

/**
 * `retry: false` de propósito. A retentativa de leitura já existe, uma camada abaixo: o
 * `SyncEngine` tenta a rede e cai para o cache em SQLite. Repetir aqui só atrasaria a tela
 * antes de mostrar o dado de ontem, que é justamente o que o usuário quer ver sem rede.
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

/**
 * Quem não tem sessão vai para o login; quem tem não fica preso nele.
 *
 * <b>Por que não basta `initialRouteName`.</b> Ele diz qual tela fica na BASE da pilha, e isso
 * responde ao caso do app aberto do zero — só a esse. No navegador a URL É a rota: abrir `/`
 * entra direto nas abas, sem sessão nenhuma, e o resultado é a tela inicial pedindo dados que a
 * API recusa com 401 — "Não deu para falar com a API" no lugar do formulário de login. No Android
 * o mesmo buraco aparece depois de um logout ou de um refresh token vencido: a sessão some e as
 * abas continuam montadas, errando a cada consulta.
 *
 * <b>A releitura a cada navegação é o que fecha o ciclo.</b> Sem ela, o estado seria lido uma vez
 * na montagem e nunca mais — e como o login navega para `/`, o guarda continuaria achando que
 * ninguém entrou e devolveria a pessoa ao login, em laço. Custa pouco: `AuthSession.read()`
 * memoriza, então isto é uma comparação, não uma ida ao cofre.
 */
function useSessionGuard(): boolean | null {
  const segments = useSegments();
  const router = useRouter();

  // `null` = ainda não se sabe. Renderizar antes da resposta piscaria a tela de login para quem
  // já está logado; um indicador breve é melhor do que um salto.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    AuthSession.read().then((s) => {
      if (vivo) setSignedIn(s !== null);
    });
    return () => {
      vivo = false;
    };
  }, [segments]);

  useEffect(() => {
    if (signedIn === null) return;

    const noLogin = segments[0] === 'login';
    if (!signedIn && !noLogin) router.replace('/login');
    else if (signedIn && noLogin) router.replace('/');
  }, [signedIn, segments, router]);

  return signedIn;
}

/**
 * A casca existe só para o {@link DesignProvider} ficar ACIMA de tudo que lê cor.
 *
 * O `useTheme()` passou a devolver os tokens do design escolhido, e um componente não enxerga um
 * contexto que ele mesmo monta. Sem esta separação, a raiz leria o padrão e o app abriria no
 * clássico por um quadro antes de saltar para o design certo.
 */
export default function RootLayout() {
  return (
    <DesignProvider>
      <RootInterno />
    </DesignProvider>
  );
}

function RootInterno() {
  const t = useTheme();
  const isDark = useIsDark();
  const signedIn = useSessionGuard();

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
            // Continua apontando a base da pilha pela sessão: o redirecionamento do guarda
            // acontece depois do primeiro quadro, e sem isto a tela protegida piscaria antes.
            // Quem garante o destino é o guarda; isto só evita o salto.
            initialRouteName={signedIn ? '(tabs)' : 'login'}
            screenOptions={{ headerTitleStyle: { fontWeight: '700' } }}
          >
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="series/[id]" options={{ title: '' }} />
            {/*
              Ajustes saiu da barra de abas e virou destino do Perfil.
              Ao contrário de `series/[id]`, aqui o título fica no cabeçalho: quem chega em Ajustes
              chegou de outra tela e precisa da seta de voltar com um rótulo que diga onde está.
            */}
            <Stack.Screen name="ajustes" options={{ title: 'Ajustes' }} />
          </Stack>
        )}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
