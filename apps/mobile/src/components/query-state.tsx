import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import { FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Carregando / erro / conteúdo, num lugar só.
 *
 * A mensagem de erro fala do que aconteceu de verdade — "não deu para falar com a API" —
 * porque neste app a causa quase sempre é o endereço da API estar apontando para a rede errada,
 * e "algo deu errado" não ajudaria ninguém a consertar isso.
 */
export function QueryState<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  const t = useTheme();

  if (query.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.center}>
        <Text style={[styles.title, { color: t.fg }]}>Não deu para falar com a API</Text>
        <Text style={[styles.body, { color: t.fgMuted }]}>
          Nada em cache para mostrar ainda. Confira em Ajustes o endereço da API — o celular
          precisa do IP da máquina na rede, não de localhost — e, se ela estiver exposta por
          túnel, o token de acesso.
        </Text>
        <Text style={[styles.detail, { color: t.fgSubtle }]}>{String(query.error)}</Text>
      </View>
    );
  }

  return <>{children(query.data)}</>;
}

const styles = StyleSheet.create({
  center: { padding: Spacing[6], gap: Spacing[3] },
  title: { fontSize: FontSize.lg, fontWeight: '700' },
  body: { fontSize: FontSize.base, lineHeight: 22 },
  detail: { fontSize: FontSize.xs, fontFamily: 'monospace' },
});
