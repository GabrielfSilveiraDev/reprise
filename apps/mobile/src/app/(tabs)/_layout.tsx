import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import type { ColorValue } from 'react-native';
import { FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Três abas, sem ícone.
 *
 * Ícone abstrato num app de nicho custa mais do que rende — "próximos" e "séries" não têm
 * pictograma óbvio, e um mal escolhido só ocupa espaço acima do rótulo que resolve. Rótulo em
 * texto também é o que o leitor de tela lê, sem precisar de `accessibilityLabel` paralelo.
 * O estado ativo combina peso e cor, nunca só cor.
 */
export default function TabsLayout() {
  const t = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.fgMuted,
        tabBarStyle: { backgroundColor: t.bgRaised, borderTopColor: t.border },
        tabBarLabel: undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Próximos', tabBarIcon: () => null, tabBarLabel: label('Próximos') }}
      />
      <Tabs.Screen
        name="series"
        options={{ title: 'Séries', tabBarIcon: () => null, tabBarLabel: label('Séries') }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{ title: 'Ajustes', tabBarIcon: () => null, tabBarLabel: label('Ajustes') }}
      />
    </Tabs>
  );
}

function label(text: string) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Text style={[styles.label, { color, fontWeight: focused ? '700' : '500' }]}>{text}</Text>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: FontSize.sm },
});
