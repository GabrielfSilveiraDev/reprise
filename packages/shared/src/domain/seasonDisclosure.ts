/**
 * Quais temporadas aparecem abertas na tela de uma série.
 *
 * <b>Por que existe.</b> A escolha tem duas metades que só fazem sentido juntas: um padrão para
 * quem nunca mexeu, e a memória de quem mexeu. Sem o padrão, uma série de dez temporadas abre com
 * tudo fechado e a pessoa tem de procurar onde parou; sem a memória, ela recolhe uma temporada,
 * navega para outra tela, volta e encontra tudo aberto de novo — o app esquece o que ela acabou de
 * pedir.
 *
 * <b>Por que aqui, e não em cada cliente.</b> O app já abria a primeira temporada com episódio por
 * assistir; o web abria todas, porque nem recolhia. Reescrever a regra dos dois lados daria duas
 * telas que discordam sobre onde a pessoa parou. O que fica em cada cliente é só o <i>meio de
 * guardar</i> — `localStorage` no navegador, SQLite no aparelho —, que é legitimamente diferente.
 *
 * <b>Preferência guardada é por série.</b> Recolher a temporada 1 de uma série não diz nada sobre
 * a temporada 1 de outra.
 */

/** O bastante de uma temporada para decidir se ela abre. Os clientes passam o DTO inteiro. */
export interface DisclosableSeason {
  seasonNumber: number;
  isSpecials: boolean;
  episodes: readonly { watchCount: number }[];
}

/**
 * O que ficou guardado, por número de temporada. Chave em texto porque o destino é JSON — em
 * `localStorage` e no SQLite do app, um mapa com chave numérica volta com chave de texto de
 * qualquer jeito, e fingir o contrário só adianta o erro para o momento da leitura.
 */
export type SeasonDisclosureState = Readonly<Record<string, boolean>>;

export class SeasonDisclosure {
  /**
   * A temporada que abre sozinha quando não há preferência guardada: a primeira <b>regular</b>
   * com episódio por assistir.
   *
   * Especiais nunca disputam esse posto — ninguém retoma uma série por um especial. Sem nenhuma
   * pendência (série em dia ou completa), abre a primeira regular; e se só houver especiais,
   * abre o que houver, porque uma tela inteiramente fechada não ajuda ninguém.
   */
  static defaultOpen(seasons: readonly DisclosableSeason[]): number | null {
    if (seasons.length === 0) return null;

    const pendente = seasons.find(
      (s) => !s.isSpecials && s.episodes.some((e) => e.watchCount === 0),
    );
    if (pendente) return pendente.seasonNumber;

    // O `?? null` não é decorativo: com `noUncheckedIndexedAccess`, `seasons[0]` é opcional para o
    // compilador mesmo depois da guarda de lista vazia lá em cima.
    const primeira = seasons.find((s) => !s.isSpecials) ?? seasons[0];
    return primeira?.seasonNumber ?? null;
  }

  /**
   * Esta temporada está aberta?
   *
   * <b>O guardado vence o padrão, inclusive quando o guardado é `false`.</b> É o ponto todo da
   * memória: quem fechou a temporada que abriria sozinha pediu para ela ficar fechada, e reabri-la
   * na próxima visita seria desfazer a ação da pessoa. Por isso o teste é de presença da chave, e
   * não da veracidade do valor.
   */
  static isOpen(
    seasonNumber: number,
    stored: SeasonDisclosureState | null | undefined,
    seasons: readonly DisclosableSeason[],
  ): boolean {
    const guardado = stored?.[String(seasonNumber)];
    if (typeof guardado === 'boolean') return guardado;

    return seasonNumber === SeasonDisclosure.defaultOpen(seasons);
  }

  /** O estado novo depois de abrir ou fechar uma temporada. Não modifica o que recebeu. */
  static toggle(
    stored: SeasonDisclosureState | null | undefined,
    seasonNumber: number,
    open: boolean,
  ): SeasonDisclosureState {
    return { ...(stored ?? {}), [String(seasonNumber)]: open };
  }

  /**
   * Lê o que veio do armazenamento, descartando o que não for utilizável.
   *
   * Um `localStorage` corrompido, um formato de versão anterior ou um `null` de chave inexistente
   * não podem derrubar a tela da série — o pior que deve acontecer é a preferência ser esquecida e
   * o padrão valer.
   */
  static parse(raw: string | null | undefined): SeasonDisclosureState {
    if (!raw) return {};

    try {
      const lido: unknown = JSON.parse(raw);
      if (typeof lido !== 'object' || lido === null || Array.isArray(lido)) return {};

      const limpo: Record<string, boolean> = {};
      for (const [chave, valor] of Object.entries(lido)) {
        if (typeof valor === 'boolean') limpo[chave] = valor;
      }
      return limpo;
    } catch {
      return {};
    }
  }
}
