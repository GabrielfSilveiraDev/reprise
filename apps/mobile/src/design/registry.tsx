/**
 * Qual design está no ar, e como trocar.
 *
 * <b>A escolha mora no SQLite, não na memória.</b> É o que faz "trocar, fechar o app e abrir de
 * novo" manter o design — o requisito inteiro depende disso. O mesmo `LocalStore` que guarda o
 * endereço da API guarda esta chave, e nenhum dado seu passa por aqui: design é preferência de
 * tela, não conteúdo.
 *
 * <b>Cai para o clássico quando não reconhece.</b> Chave corrompida, design removido numa versão
 * futura, valor escrito à mão no banco — em todos os casos o app abre no desenho que sempre
 * existiu, em vez de numa tela branca. Um seletor de tema que pode deixar o app inacessível é pior
 * do que não ter seletor.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { LocalStore } from '@/offline/local-store';
import { TOKENS } from './tokens';
import type { DesignId, DesignTokens } from './tokens';

const SETTING = 'appDesign';
const PADRAO: DesignId = 'classico';

export const DESIGNS: ReadonlyArray<{
  readonly id: DesignId;
  readonly nome: string;
  readonly descricao: string;
}> = [
  {
    id: 'classico',
    nome: 'Clássico',
    descricao: 'O desenho original: prateleiras, pôsteres médios e tom âmbar da marca.',
  },
  {
    id: 'cinema',
    nome: 'Cinematográfico',
    descricao: 'Preto de sala escura. A capa sangra até a borda e o texto sai da frente.',
  },
  {
    id: 'editorial',
    nome: 'Editorial',
    descricao: 'Papel e tipografia. Muito respiro, fio de cabelo no lugar de caixa, quase sem cor.',
  },
  {
    id: 'painel',
    nome: 'Painel denso',
    descricao: 'Ferramenta. Tudo encolhe, o número vem antes da imagem e cabe muito por tela.',
  },
];

export function isDesignId(v: unknown): v is DesignId {
  return typeof v === 'string' && DESIGNS.some((d) => d.id === v);
}

interface DesignContexto {
  readonly design: DesignId;
  /** `false` até o disco responder — evita o pisca do clássico antes do design escolhido. */
  readonly pronto: boolean;
  readonly escolher: (id: DesignId) => Promise<void>;
}

const Ctx = createContext<DesignContexto>({
  design: PADRAO,
  pronto: false,
  escolher: async () => {},
});

export function DesignProvider({ children }: { children: ReactNode }) {
  const [design, setDesign] = useState<DesignId>(PADRAO);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let vivo = true;
    LocalStore.open()
      .then((store) => store.getSetting(SETTING))
      .then((salvo) => {
        if (!vivo) return;
        if (isDesignId(salvo)) setDesign(salvo);
        setPronto(true);
      })
      .catch(() => {
        // Banco local indisponível não pode impedir o app de abrir: segue no padrão.
        if (vivo) setPronto(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const valor = useMemo<DesignContexto>(
    () => ({
      design,
      pronto,
      escolher: async (id) => {
        // Estado primeiro: a tela responde ao toque na hora, e o disco alcança depois.
        setDesign(id);
        const store = await LocalStore.open();
        await store.setSetting(SETTING, id);
      },
    }),
    [design, pronto],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useDesign(): DesignContexto {
  return useContext(Ctx);
}

/**
 * Os tokens do design ativo, no tema do sistema.
 *
 * Substitui o `useTheme()` nas telas dos designs. O `useTheme()` original continua existindo e
 * continua servindo aos componentes compartilhados — este devolve um objeto que satisfaz o mesmo
 * contrato, então os dois convivem sem conversão.
 */
export function useTokens(): DesignTokens {
  const { design } = useDesign();
  const escuro = useColorScheme() === 'dark';
  return TOKENS[design][escuro ? 'dark' : 'light'];
}
