import { Auth } from './auth';
import { WebSession } from './session';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export interface ExportSummary {
  readonly fileName: string;
  readonly bytes: number;
  readonly series: number;
  readonly watchEvents: number;
}

/**
 * Baixa o export e entrega ao navegador como arquivo.
 *
 * <b>`fetch` cru, não o cliente gerado.</b> O gerado desserializaria 3 MB em objetos só para a
 * gente reserializar em texto; aqui o corpo vai da resposta para o arquivo praticamente como veio.
 *
 * <b>Blob e âncora sintética</b> em vez de um link direto para `/export`: o endpoint exige o
 * cabeçalho de autorização, e navegação por link não carrega cabeçalho nenhum. O `revokeObjectURL`
 * no fim libera a memória — sem ele, cada export deixaria 3 MB presos até a aba fechar.
 */
export async function downloadExport(): Promise<ExportSummary> {
  let session = WebSession.read();
  if (session && WebSession.isExpired(session)) session = await Auth.refresh();
  if (!session) throw new Error('Entre na sua conta para exportar.');

  const response = await fetch(`${BASE_URL}/export`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });

  if (!response.ok) throw new Error(`A API respondeu ${response.status}.`);

  const body = await response.text();
  const parsed = JSON.parse(body) as { series?: unknown[]; watchEvents?: unknown[] };
  const fileName = `reprise-${new Date().toISOString().slice(0, 10)}.json`;

  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }

  return {
    fileName,
    bytes: body.length,
    series: parsed.series?.length ?? 0,
    watchEvents: parsed.watchEvents?.length ?? 0,
  };
}
