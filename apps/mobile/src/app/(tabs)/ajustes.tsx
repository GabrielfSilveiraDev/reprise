import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { formatEpisodeCode, formatWatchedAt } from '@reprise/shared';
import { AccessToken, ApiEndpoint } from '@/api/client';
import { syncEngine, useDeadLetters, usePendingActions } from '@/api/queries';
import { FontSize, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { useTheme } from '@/hooks/use-theme';

/**
 * Ajustes é onde o app confessa o que não conseguiu fazer.
 *
 * O endereço da API mora aqui porque o celular precisa do IP da máquina na rede e esse IP muda —
 * exigir recompilação para trocar de rede seria absurdo num app pessoal. As cartas mortas também:
 * uma marcação que a API recusou some da fila, e se ela sumisse da tela junto o app estaria
 * mentindo sobre o que registrou.
 */
export default function SettingsScreen() {
  const t = useTheme();
  const status = useAutoSync();
  const qc = useQueryClient();

  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [tokenSalvo, setTokenSalvo] = useState(false);
  const pending = usePendingActions();
  const deadLetters = useDeadLetters();

  useEffect(() => {
    ApiEndpoint.read().then((value) => {
      setUrl(value);
      setSaved(value);
    });
    // O token nunca é lido de volta para a tela — só se sabe se existe. Reexibir um segredo
    // para conferência é o tipo de conveniência que acaba num print de tela em algum lugar.
    AccessToken.has().then(setTokenSalvo);
  }, []);

  const save = async () => {
    const normalized = ApiEndpoint.normalize(url);
    await ApiEndpoint.write(normalized);
    setUrl(normalized);
    setSaved(normalized);
    await qc.invalidateQueries();
  };

  const saveToken = async () => {
    await AccessToken.write(token);
    setTokenSalvo(token.trim().length > 0);
    setToken('');
    await qc.invalidateQueries();
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: t.fgSubtle }]}>AJUSTES</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.fg }]}>Endereço da API</Text>
          <Text style={[styles.hint, { color: t.fgMuted }]}>
            O celular não enxerga o localhost do PC. Use o IP da máquina na rede — algo como
            http://192.168.x.x:5156. A API precisa estar escutando em 0.0.0.0.
          </Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="url"
            style={[styles.input, { color: t.fg, borderColor: t.borderStrong, backgroundColor: t.bgRaised }]}
            accessibilityLabel="Endereço da API"
          />
          <Pressable
            onPress={save}
            disabled={ApiEndpoint.normalize(url) === saved}
            style={[
              styles.button,
              {
                backgroundColor: t.accent,
                opacity: ApiEndpoint.normalize(url) === saved ? 0.5 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Salvar endereço da API"
          >
            <Text style={[styles.buttonText, { color: t.accentFg }]}>Salvar</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.fg }]}>Token de acesso</Text>
          <Text style={[styles.hint, { color: t.fgMuted }]}>
            Só é necessário quando a API está exposta fora da sua rede — por túnel, por exemplo.
            Em casa, deixe vazio. Fica guardado no cofre do sistema e não é exibido de volta.
          </Text>
          <TextInput
            value={token}
            onChangeText={setToken}
            placeholder={tokenSalvo ? 'um token está salvo — digite para trocar' : 'sem token'}
            placeholderTextColor={t.fgSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={[styles.input, { color: t.fg, borderColor: t.borderStrong, backgroundColor: t.bgRaised }]}
            accessibilityLabel="Token de acesso da API"
          />
          <View style={styles.buttonRow}>
            <Pressable
              onPress={saveToken}
              disabled={token.trim().length === 0}
              style={[
                styles.button,
                styles.buttonGrow,
                { backgroundColor: t.accent, opacity: token.trim().length === 0 ? 0.5 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Salvar token de acesso"
            >
              <Text style={[styles.buttonText, { color: t.accentFg }]}>Salvar token</Text>
            </Pressable>
            {tokenSalvo ? (
              <Pressable
                onPress={async () => {
                  await AccessToken.write('');
                  setTokenSalvo(false);
                  await qc.invalidateQueries();
                }}
                style={[styles.button, styles.buttonGrow, { borderColor: t.borderStrong, borderWidth: 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Remover token de acesso"
              >
                <Text style={[styles.buttonText, { color: t.fg }]}>Remover</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.fg }]}>Sincronização</Text>
          <Row label="Conexão" value={status.online ? 'conectado' : 'sem rede'} />
          <Row label="Na fila" value={String(pending.data?.length ?? 0)} />
          <Pressable
            onPress={status.flushNow}
            disabled={status.syncing || (pending.data?.length ?? 0) === 0}
            style={[
              styles.button,
              {
                borderColor: t.borderStrong,
                borderWidth: 1,
                opacity: status.syncing || (pending.data?.length ?? 0) === 0 ? 0.5 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Sincronizar agora"
          >
            <Text style={[styles.buttonText, { color: t.fg }]}>
              {status.syncing ? 'Sincronizando…' : 'Sincronizar agora'}
            </Text>
          </Pressable>
        </View>

        {(deadLetters.data?.length ?? 0) > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: t.danger }]}>Marcações recusadas</Text>
            <Text style={[styles.hint, { color: t.fgMuted }]}>
              A API recusou estas de forma definitiva — reenviar não resolveria. Elas não foram
              registradas no seu histórico.
            </Text>
            {deadLetters.data?.map((dead) => (
              <View key={dead.action.clientKey} style={[styles.dead, { borderColor: t.border }]}>
                <Text style={[styles.deadTitle, { color: t.fg }]}>
                  {describe(dead.action)}
                </Text>
                <Text style={[styles.deadMeta, { color: t.fgSubtle }]}>
                  {dead.error} · {formatWatchedAt(dead.queuedAt)}
                </Text>
              </View>
            ))}
            <Pressable
              onPress={async () => {
                await (await syncEngine()).queue.discardDeadLetters();
                await qc.invalidateQueries();
              }}
              style={[styles.button, { borderColor: t.borderStrong, borderWidth: 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Descartar marcações recusadas"
            >
              <Text style={[styles.buttonText, { color: t.fg }]}>Descartar</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: t.border }]}>
      <Text style={[styles.rowLabel, { color: t.fgMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: t.fg }]}>{value}</Text>
    </View>
  );
}

function describe(action: { kind: string; [k: string]: unknown }): string {
  switch (action.kind) {
    case 'watch':
      return `Marcar episódio ${action.episodeId}`;
    case 'unwatch':
      return `Desmarcar episódio ${action.episodeId}`;
    case 'watch-season':
      return `Marcar temporada ${action.seasonNumber} da série ${action.seriesId}`;
    case 'watch-up-to':
      return `Marcar até ${formatEpisodeCode(Number(action.seasonNumber), Number(action.episodeNumber))} da série ${action.seriesId}`;
    default:
      return action.kind;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing[4], paddingBottom: Spacing[8], gap: Spacing[5] },
  eyebrow: { fontSize: FontSize.xs, letterSpacing: 1.2, fontWeight: '700' },
  section: { gap: Spacing[2] },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  hint: { fontSize: FontSize.sm, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    fontSize: FontSize.base,
    minHeight: TouchTarget,
  },
  button: {
    minHeight: TouchTarget,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[4],
  },
  buttonText: { fontSize: FontSize.base, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: Spacing[2] },
  buttonGrow: { flex: 1 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: TouchTarget,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: FontSize.sm },
  rowValue: { fontSize: FontSize.sm, fontWeight: '700' },

  dead: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing[3], gap: 2 },
  deadTitle: { fontSize: FontSize.sm, fontWeight: '600' },
  deadMeta: { fontSize: FontSize.xs },
});
