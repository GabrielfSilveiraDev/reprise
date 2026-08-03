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
import { AccessToken, ApiEndpoint } from '@/api/client';
import { Logo } from '@/components/logo';
import { FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Entrar · criar conta · digitar o código que valida a conta recém-criada. */
type Step = 'login' | 'register' | 'confirm';

/**
 * Autenticação.
 *
 * O endereço da API fica aqui, e não só em Ajustes, porque Ajustes está do outro lado do login:
 * quem chega com o endereço errado ficaria preso numa tela sem como consertá-la.
 *
 * <b>O token de acesso está aqui pelo mesmo motivo, e faltava.</b> Quando a API sobe atrás de um
 * túnel, o cadeado recusa TODA requisição sem o token — inclusive a de login. O aplicativo lia
 * esse 401 como credencial errada e mandava conferir usuário e senha, que estavam certos; e o
 * único campo capaz de resolver morava em Ajustes, atrás do login que não passava. Era um
 * trancamento completo: a tela pedia a correção exata que ela mesma impedia de fazer.
 */
export default function LoginScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('login');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [token, setToken] = useState('');
  /** Só se sabe SE existe um token guardado, nunca qual: ele não volta do cofre para a tela. */
  const [temToken, setTemToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    ApiEndpoint.read().then(setApiUrl);
    AccessToken.has().then(setTemToken);
  }, []);

  const entrar = async () => {
    await qc.invalidateQueries();
    router.replace('/');
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await ApiEndpoint.write(apiUrl);

      // Antes de qualquer chamada: o cadeado da API é conferido no primeiro byte da requisição,
      // então um token digitado agora precisa já estar no cofre quando o login sair.
      if (token.trim().length > 0) {
        await AccessToken.write(token);
        setTemToken(true);
        setToken('');
      }

      if (step === 'login') {
        await Auth.login(identifier.trim(), password);
        await entrar();
        return;
      }

      if (step === 'register') {
        const r = await Auth.register(email.trim(), password, displayName.trim(), identifier.trim());
        setInfo(r.message);
        setStep('confirm');
        return;
      }

      await Auth.confirm(email.trim(), code.trim());
      await entrar();
    } catch (cause) {
      const motivo = cause instanceof Error ? cause.message : 'Não deu para continuar.';

      /*
        Sem token configurado, "credencial recusada" é um palpite — e foi o palpite errado que
        custou caro: o cadeado da API recusa a requisição ANTES de olhar usuário e senha, com o
        mesmo 401. Não dá para distinguir os dois casos pela resposta, então a tela para de afirmar
        qual dos dois foi e apresenta o segundo, que é o único com conserto visível aqui.
      */
      const podeSerOCadeado = !temToken && token.trim().length === 0;
      setError(
        podeSerOCadeado
          ? `${motivo} Se esta API está exposta por túnel, ela também exige o token de acesso abaixo.`
          : motivo,
      );
    } finally {
      setBusy(false);
    }
  };

  const podeEnviar =
    step === 'login'
      ? identifier.trim().length > 2 && password.length >= 10
      : step === 'register'
        ? email.trim().includes('@') &&
          password.length >= 10 &&
          identifier.trim().length > 2 &&
          displayName.trim().length > 0
        : code.trim().length === 6;

  const rotuloBotao =
    step === 'login' ? 'Entrar' : step === 'register' ? 'Criar conta' : 'Validar conta';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <View style={styles.brand}>
              <Logo size={34} />
              <Text style={[styles.wordmark, { color: t.fg }]}>Reprise</Text>
            </View>
            {/*
              A mesma frase de abertura do web.
              Aqui estava o credo do projeto — "uma exibição é um evento, não um booleano" —, que
              é uma afirmação sobre modelagem de dados dita a alguém que ainda não sabe o que o
              app faz. Ele continua no rodapé, onde lê como divisa e não como explicação.
            */}
            <Text style={[styles.tagline, { color: t.fgMuted }]}>
              Onde você parou, e quantas vezes já voltou.
            </Text>
          </View>

          <View style={styles.form}>
            {step === 'confirm' ? (
              <>
                {info ? (
                  <View style={[styles.info, { backgroundColor: t.accentQuiet }]}>
                    <Text style={[styles.infoText, { color: t.fg }]}>{info}</Text>
                  </View>
                ) : null}

                <Field
                  label="Código de seis dígitos"
                  value={code}
                  onChange={setCode}
                  inputMode="numeric"
                  hint={`Enviado para ${email}.`}
                />

                <Pressable
                  onPress={async () => {
                    await Auth.resend(email.trim());
                    setInfo('Código reenviado.');
                  }}
                  style={styles.switch}
                  accessibilityRole="button"
                >
                  <Text style={[styles.switchText, { color: t.focus }]}>Reenviar código</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Field
                  label={step === 'login' ? 'Usuário ou e-mail' : 'Nome de usuário'}
                  value={identifier}
                  onChange={setIdentifier}
                  autoComplete="username"
                />

                {step === 'register' ? (
                  <>
                    <Field label="E-mail" value={email} onChange={setEmail} inputMode="email" />
                    <Field
                      label="Como quer ser chamado"
                      value={displayName}
                      onChange={setDisplayName}
                    />
                  </>
                ) : null}

                <Field
                  label="Senha"
                  value={password}
                  onChange={setPassword}
                  secure
                  hint={step === 'register' ? 'Mínimo de 10 caracteres.' : undefined}
                />
              </>
            )}

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
              accessibilityLabel={rotuloBotao}
            >
              {busy ? (
                <ActivityIndicator color={t.accentFg} />
              ) : (
                <Text style={[styles.primaryText, { color: t.accentFg }]}>{rotuloBotao}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setStep((s) => (s === 'login' ? 'register' : 'login'));
                setError(null);
                setInfo(null);
              }}
              style={styles.switch}
              accessibilityRole="button"
            >
              <Text style={[styles.switchText, { color: t.focus }]}>
                {step === 'login' ? 'Criar uma conta' : 'Já tenho conta'}
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

            <Field
              label="Token de acesso"
              value={token}
              onChange={setToken}
              secure
              placeholder={temToken ? 'já há um token ativo — digite para trocar' : 'sem token'}
              hint={
                temToken
                  ? 'Guardado no cofre do sistema e não exibido de volta. Deixe vazio para manter.'
                  : 'Só quando a API está exposta fora da sua rede, por túnel. Em casa, deixe vazio.'
              }
            />
          </View>

          <Text style={[styles.credo, { color: t.fgSubtle }]}>
            Uma exibição é um evento, não um booleano.
          </Text>
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  hint?: string;
  autoComplete?: 'username';
  inputMode?: 'email' | 'url' | 'numeric';
  placeholder?: string;
}) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      {/* Caixa alta pelo estilo, não por `toUpperCase()`: o rótulo que o leitor de tela associa
          ao campo tem de continuar sendo "Senha", não "S-E-N-H-A". */}
      <Text style={[styles.label, { color: t.fgSubtle }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        placeholderTextColor={t.fgSubtle}
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
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  wordmark: { fontSize: FontSize.xxl, fontWeight: '700', letterSpacing: -0.5 },
  tagline: { fontSize: FontSize.sm },

  form: { gap: Spacing[4] },
  field: { gap: Spacing[1] },
  label: { fontSize: 10, letterSpacing: 1, fontWeight: '700', textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    fontSize: FontSize.base,
    minHeight: TouchTarget,
  },
  hint: { fontSize: FontSize.xs },

  info: { padding: Spacing[3], borderRadius: Radius.md },
  infoText: { fontSize: FontSize.sm, lineHeight: 20 },

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

  // `gap` porque o bloco passou a ter dois campos: sem ele, endereço e token se encostam.
  server: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[4], gap: Spacing[4] },
  credo: { fontSize: FontSize.xs, fontStyle: 'italic', textAlign: 'center' },
});
