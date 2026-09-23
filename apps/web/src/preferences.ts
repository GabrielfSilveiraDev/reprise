import { SeasonDisclosure } from '@reprise/shared';
import type { SeasonDisclosureState } from '@reprise/shared';

/**
 * Preferências de tela guardadas no navegador.
 *
 * <b>Por que `localStorage` e não o servidor.</b> Ter uma temporada recolhida é uma escolha do
 * momento, feita num aparelho — não é dado do acervo. Guardá-la na API custaria uma migração, um
 * endpoint e uma requisição a cada clique num chevron, e ainda faria a preferência do celular
 * mandar no navegador. Aqui ela vive onde foi feita, e some junto com o histórico do navegador
 * sem deixar nada para trás.
 *
 * <b>Toda leitura e escrita é protegida.</b> Em navegação anônima, com armazenamento bloqueado ou
 * com a cota cheia, `localStorage` <i>lança</i> — inclusive na leitura. Uma preferência de
 * interface não pode derrubar a tela da série: o pior que pode acontecer é o app esquecer o que
 * estava recolhido.
 */
export class SeasonPreferences {
  /** Uma chave por série: recolher a temporada 1 de uma não diz nada sobre a de outra. */
  private static key(seriesId: number): string {
    return `reprise.seasons.${seriesId}`;
  }

  static read(seriesId: number): SeasonDisclosureState {
    try {
      return SeasonDisclosure.parse(localStorage.getItem(SeasonPreferences.key(seriesId)));
    } catch {
      return {};
    }
  }

  static write(seriesId: number, state: SeasonDisclosureState): void {
    try {
      localStorage.setItem(SeasonPreferences.key(seriesId), JSON.stringify(state));
    } catch {
      // Sem espaço ou sem permissão: a tela segue funcionando, só não lembra na próxima visita.
    }
  }
}
