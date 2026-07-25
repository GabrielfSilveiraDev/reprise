import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ACCESS_TOKEN_HEADER } from '@reprise/shared';
import { AccessToken, ApiEndpoint } from './client';
import { Auth } from './auth';
import { AuthSession } from './session';

export interface ExportSummary {
  readonly fileName: string;
  readonly bytes: number;
  readonly series: number;
  readonly watchEvents: number;
}

/**
 * Baixa o export e entrega ao sistema para o usuário guardar onde quiser.
 *
 * <b>Por que sair do app.</b> Um arquivo salvo na pasta privada do aplicativo some junto com ele
 * — o que faria deste export exatamente o que ele existe para evitar. Passar pela folha de
 * compartilhamento põe o arquivo no Drive, no e-mail ou no armazenamento do aparelho, fora do
 * alcance de uma desinstalação.
 *
 * <b>Por que `fetch` cru.</b> O cliente gerado desserializa a resposta inteira em objetos só para
 * a gente reserializar em texto. Com 3 MB e 10 mil exibições isso é trabalho jogado fora: aqui o
 * corpo vai do socket para o arquivo praticamente como veio.
 */
export class DataExport {
  static async download(): Promise<ExportSummary> {
    const [baseUrl, gateToken] = await Promise.all([ApiEndpoint.read(), AccessToken.read()]);

    let session = await AuthSession.read();
    if (session && AuthSession.isExpired(session)) session = await Auth.refresh();
    if (!session) throw new Error('Entre na sua conta para exportar.');

    const response = await fetch(`${baseUrl}/export`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        ...(gateToken ? { [ACCESS_TOKEN_HEADER]: gateToken } : {}),
      },
    });

    if (!response.ok) throw new Error(`A API respondeu ${response.status}.`);

    const body = await response.text();

    // Só para o resumo na tela — o arquivo gravado é o corpo original, sem reserialização.
    const parsed = JSON.parse(body) as { series?: unknown[]; watchEvents?: unknown[] };

    const fileName = `reprise-${new Date().toISOString().slice(0, 10)}.json`;
    // Cache, e não a pasta de documentos: depois de compartilhado o arquivo já cumpriu seu papel,
    // e deixar cópias de 3 MB acumulando no aparelho não serve a ninguém.
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    file.write(body);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Guardar o export do Reprise',
        UTI: 'public.json',
      });
    }

    return {
      fileName,
      bytes: body.length,
      series: parsed.series?.length ?? 0,
      watchEvents: parsed.watchEvents?.length ?? 0,
    };
  }
}
