import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Auth } from '@/api/auth';
import { ApiEndpoint } from '@/api/client';
import { FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Entrar (ou criar conta).
 *
 * O endereço da API fica aqui, e não só em Ajustes, porque Ajustes está do outro lado do login:
 * quem chega com o endereço errado ficaria preso numa tela que não tem como consertar. Este é o
 * único lugar do app onde a configuração precisa ser alcançável antes de autenticar.
 */
export default function LoginScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ApiEndpoint.read().then(setApiUrl);
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await ApiEndpoint.write(apiUrl);
      if (mode === 'login') await Auth.login(email.trim(), password);
      else await Auth.register(email.trim(), password, displayName.trim());

      // A sessão trocou: o cache de quem estava antes não vale mais nada.
      await qc.invalidateQueries();
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não deu para entrar.');
    } finally {
      setBusy(false);
    }
  };

  const podeEnviar =
    email.trim().length > 3 && password.length >= 10 && (mode === 'login' || displayName.trim().length > 0);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <Text style={[styles.wordmark, { color: t.fg }]}>Reprise</Text>
            <Text style={[styles.tagline, { color: t.fgMuted }]}>
              Uma exibição é um evento, não um booleano.
            </Text>
          </View>

          <View style={styles.form}>
            <Field
              label="E-mail"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              inputMode="email"
            />

            {mode === 'register' ? (
              <Field label="Como quer ser chamado" value={displayName} onChange={setDisplayName} />
            ) : null}

            <Field
              label="Senha"
              value={password}
              onChange={setPassword}
              secure
              hint={mode === 'register' ? 'Mínimo de 10 caracteres.' : undefined}
            />

            {error ? (
              <View style={[styles.error, { backgroundColor: t.bgSunken, borderColor: t.danger }]}>
                <Text style={[styles.errorText, { color: t.fg }]}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={!podeEnviar || busy}
              style={[
                styles.primary,
                { backgroundColor: t.accent, opacity: !podeEnviar || busy ? 0.5 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={mode === 'login' ? 'Entrar' : 'Criar conta'}
            >
              {busy ? (
                <ActivityIndicator color={t.accentFg} />
              ) : (
                <Text style={[styles.primaryText, { color: t.accentFg }]}>
                  {mode === 'login' ? 'Entrar' : 'Criar conta'}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setMode((m) => (m === 'login' ? 'register' : 'login'));
                setError(null);
              }}
              style={styles.switch}
              accessibilityRole="button"
            >
              <Text style={[styles.switchText, { color: t.focus }]}>
                {mode === 'login' ? 'Criar uma conta' : 'Já tenho conta'}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.server, { borderTopColor: t.border }]}>
            <Field
              label="Endereço da API"
              value={apiUrl}
              onChange={setApiUrl}
              inputMode="url"
              hint="O celular precisa do IP da máquina na rede, não de localhost."
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  secure = false,
  hint,
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  hint?: string;
  autoComplete?: 'email';
  inputMode?: 'email' | 'url';
}) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.fgSubtle }]}>{label.toUpperCase()}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        inputMode={inputMode}
        style={[styles.input, { color: t.fg, borderColor: t.borderStrong, backgroundColor: t.bgRaised }]}
        accessibilityLabel={label}
      />
      {hint ? <Text style={[styles.hint, { color: t.fgSubtle }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing[5], gap: Spacing[6], flexGrow: 1, justifyContent: 'center' },

  head: { gap: Spacing[1] },
  wordmark: { fontSize: FontSize.xxl, fontWeight: '700', letterSpacing: -0.5 },
  tagline: { fontSize: FontSize.sm },

  form: { gap: Spacing[4] },
  field: { gap: Spacing[1] },
  label: { fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    fontSize: FontSize.base,
    minHeight: TouchTarget,
  },
  hint: { fontSize: FontSize.xs },

  error: { borderLeftWidth: 3, borderRadius: Radius.md, padding: Spacing[3] },
  errorText: { fontSize: FontSize.sm },

  primary: {
    minHeight: TouchTarget,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: FontSize.base, fontWeight: '700' },
  switch: { minHeight: TouchTarget, alignItems: 'center', justifyContent: 'center' },
  switchText: { fontSize: FontSize.sm, fontWeight: '600' },

  server: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[4] },
});
