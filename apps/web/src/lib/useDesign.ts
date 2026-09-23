import { useSyncExternalStore } from 'react'
import { design, type DesignId } from './DesignController'

/** O design atual, reativo: trocar em Conta redesenha a tela na hora, sem recarregar. */
export function useDesign(): DesignId {
  return useSyncExternalStore(design.subscribe, design.getSnapshot)
}

/**
 * Escolhe, entre as versões de uma peça, a do design atual. Cada tela declara as suas três
 * versões num mapa — `Record` obriga a ter todas, então um design novo que esqueça uma tela não
 * compila.
 *
 * As versões são ELEMENTOS (`<HomeSessao model={m} />`), não componentes: escolher um componente
 * num gancho é, para o React, criar componente durante a renderização. Montar três elementos e
 * usar um custa três objetos — só o escolhido é renderizado.
 */
export function useDesigned<T>(versions: Record<DesignId, T>): T {
  return versions[useDesign()]
}
