/**
 * "Já acabou?" é duas perguntas, não uma.
 *
 * Uma série pode estar **encerrada** (a produção terminou) e outra pode estar apenas **em dia**
 * (você viu tudo o que existe, mas vem mais). Da lista de séries as duas parecem idênticas —
 * 100% assistido nas duas — e é justamente a diferença que decide se dá para arquivar e seguir
 * a vida ou se ainda vale esperar a próxima temporada.
 *
 * A regra mora aqui, e não em cada tela, porque web e Android precisam dizer a mesma coisa sobre
 * a mesma série.
 */

/** Situação da produção como o TMDB reporta, para as séries que já foram enriquecidas. */
const ENDED_PRODUCTION = new Set(['Ended', 'Canceled', 'Cancelled']);

export type CompletionState =
  /** Nenhum episódio visto. */
  | 'not-started'
  /** Falta episódio já lançado para assistir. */
  | 'behind'
  /** Você viu tudo o que existe, mas a série continua produzindo. */
  | 'up-to-date'
  /** Você viu tudo e a produção acabou: não vem mais nada. */
  | 'finished';

export interface CompletionInput {
  readonly productionStatus?: string | null;
  readonly episodesTotal: number;
  /**
   * Destes, quantos já foram ao ar. Ausente = todos, que é o comportamento de antes desta
   * distinção existir e continua correto para as séries sem episódio agendado.
   */
  readonly episodesAired?: number | null;
  readonly episodesWatched: number;
}

export class SeriesCompletion {
  readonly state: CompletionState;
  readonly episodesTotal: number;
  readonly episodesAired: number;
  readonly episodesWatched: number;

  private constructor(state: CompletionState, total: number, aired: number, watched: number) {
    this.state = state;
    this.episodesTotal = total;
    this.episodesAired = aired;
    this.episodesWatched = watched;
  }

  static of(input: CompletionInput): SeriesCompletion {
    const total = Math.max(0, input.episodesTotal);
    const aired = Math.min(Math.max(0, input.episodesAired ?? total), total);
    // O catálogo pode ter encolhido depois de um reprocessamento; assistido nunca passa do total.
    const watched = Math.min(Math.max(0, input.episodesWatched), total);

    return new SeriesCompletion(
      SeriesCompletion.resolve(input, total, aired, watched),
      total,
      aired,
      watched,
    );
  }

  private static resolve(
    input: CompletionInput,
    total: number,
    aired: number,
    watched: number,
  ): CompletionState {
    // Série sem catálogo ainda (stub do import, sem enriquecimento) não tem o que concluir.
    if (total === 0) return 'not-started';
    if (watched === 0) return 'not-started';

    // <b>O denominador de "estou atrasado?" é o que já foi ao ar, não o catálogo inteiro.</b>
    // A Silo tem seis episódios agendados até setembro: contá-los como pendência dizia que eu
    // estava devendo algo que ainda não existe — e, pior, oferecia o botão de marcá-los.
    if (watched < aired) return 'behind';

    // Assistiu tudo o que estreou. Se ainda vem episódio marcado no calendário, a série está em
    // dia por definição — nem precisa perguntar ao status da produção, que não teria como dizer
    // "encerrada" com estreia agendada.
    if (aired < total) return 'up-to-date';

    // Status ausente (série não casada no TMDB) é tratado como indefinido, não como encerrado —
    // anunciar "finalizada" sem saber seria pior do que não anunciar.
    return SeriesCompletion.hasEndedProduction(input.productionStatus) ? 'finished' : 'up-to-date';
  }

  static hasEndedProduction(productionStatus?: string | null): boolean {
    return productionStatus !== null && productionStatus !== undefined
      ? ENDED_PRODUCTION.has(productionStatus.trim())
      : false;
  }

  /** Quantos dá para assistir agora — nunca inclui o que ainda vai estrear. */
  get remaining(): number {
    return Math.max(0, this.episodesAired - this.episodesWatched);
  }

  /** Quantos já estão no calendário e ainda não foram ao ar. */
  get upcoming(): number {
    return Math.max(0, this.episodesTotal - this.episodesAired);
  }

  get ratio(): number {
    return this.episodesTotal === 0 ? 0 : this.episodesWatched / this.episodesTotal;
  }

  /** Verdadeiro quando não há mais nada por vir — o caso que merece destaque na lista. */
  get isFinished(): boolean {
    return this.state === 'finished';
  }

  /** Rótulo curto, para o selo na grade de pôsteres. */
  get badge(): string | null {
    switch (this.state) {
      case 'finished':
        return 'Finalizada';
      case 'up-to-date':
        return 'Em dia';
      default:
        return null;
    }
  }

  /**
   * Frase completa, para a lista e para leitor de tela. Sempre carrega o número: o selo sozinho
   * diz o estado, mas não diz o quanto falta.
   */
  get label(): string {
    switch (this.state) {
      case 'finished':
        return 'Finalizada — você viu tudo';
      case 'up-to-date':
        // Com estreia marcada, a data é a informação; sem ela, o que há a dizer é que não há
        // nada a dizer ainda.
        if (this.upcoming === 1) return 'Em dia — mais 1 episódio a caminho';
        if (this.upcoming > 1) return `Em dia — mais ${this.upcoming} episódios a caminho`;
        return 'Em dia — aguardando novos episódios';
      case 'behind':
        return this.remaining === 1 ? 'Falta 1 episódio' : `Faltam ${this.remaining} episódios`;
      case 'not-started':
        return 'Não começada';
    }
  }
}
