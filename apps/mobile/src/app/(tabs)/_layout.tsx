import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import type { ColorValue } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Quatro abas, com ícone e rótulo.
 *
 * <b>Por que agora tem ícone.</b> Antes não tinha, e o argumento era que "próximos" e "séries" não
 * têm pictograma óbvio. O argumento continua verdadeiro isoladamente e ainda assim leva à conclusão
 * errada: numa barra de cinco alvos só de texto, todos com o mesmo peso e altura, achar a aba certa
 * exige LER as cinco. Ícone e rótulo juntos dão duas pistas para o mesmo destino — a forma serve à
 * varredura periférica, o texto desfaz a ambiguidade. Nenhum dos dois sozinho faz o trabalho, e é
 * por isso que rótulo continua aqui: ícone sem texto é adivinhação.
 *
 * <b>Contorno quando inativo, preenchido quando ativo.</b> A aba atual muda de FORMA, não só de cor,
 * pelo mesmo motivo que os selos deste app são texto e não bolinha colorida: quem não distingue as
 * duas cores precisa de outro sinal. Somado ao peso do rótulo, são três pistas para o mesmo estado.
 *
 * <b>A ordem.</b> Da esquerda para a direita, por frequência de uso decrescente — que é a ordem em
 * que se espera encontrá-las e a que põe o destino mais comum no alcance mais curto do polegar:
 *
 *   Próximos  o que o app existe para responder: o que assisto agora
 *   Séries    o acervo, para navegar sem pressa
 *   Buscar    acrescentar ao acervo, um ato deliberado e ocasional
 *   Perfil    identidade, estatísticas e — agora — ajustes
 *
 * Perfil por último é convenção forte o bastante para ser expectativa: conta e configuração vivem
 * na ponta oposta da ação principal em praticamente todo app com barra inferior. Contrariar isso
 * custaria mais do que qualquer ganho de ordenação.
 *
 * <b>Ajustes saiu daqui.</b> Era a quinta aba e concorria em tamanho com as quatro que se usa todo
 * dia, quando é a que se abre uma vez por mês — para trocar o endereço da API ou ver uma carta
 * morta. Virou um destino dentro do Perfil, onde já moram identidade e conta. De quebra, quatro
 * alvos são maiores que cinco na mesma largura de tela.
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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Próximos',
          tabBarIcon: icon('play-circle'),
          tabBarLabel: label('Próximos'),
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          title: 'Séries',
          tabBarIcon: icon('albums'),
          tabBarLabel: label('Séries'),
        }}
      />
      <Tabs.Screen
        name="buscar"
        options={{
          title: 'Buscar',
          // A lupa é o único pictograma verdadeiramente universal desta barra — não precisa de
          // aprendizado e não compete com nenhum outro significado.
          tabBarIcon: icon('search'),
          tabBarLabel: label('Buscar'),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: icon('person-circle'),
          tabBarLabel: label('Perfil'),
        }}
      />
    </Tabs>
  );
}

/**
 * O ícone, com a variante de contorno quando a aba não é a atual.
 *
 * `aria-hidden` porque o rótulo ao lado já é o nome acessível da aba: anunciar os dois faria o
 * leitor de tela dizer "Séries, Séries" em cada parada.
 */
function icon(name: 'play-circle' | 'albums' | 'search' | 'person-circle') {
  return ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons
      name={focused ? name : (`${name}-outline` as const)}
      size={size}
      color={color as string}
      aria-hidden
    />
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
