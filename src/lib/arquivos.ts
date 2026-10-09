import { supabase } from './supabase';

/**
 * Arquivos públicos (fotos de membros e anexos) ficam no Cloudflare R2, servidos
 * pelo Worker `dbvplus-arquivos` (workers/arquivos.js), e não no Storage do
 * Supabase — o download de arquivo é o que mais consumia o egresso do plano
 * grátis. Os buckets privados (documentos, backup do ranking, requisitos)
 * continuam no Supabase.
 */
export type BucketPublico = 'fotos_membros' | 'atividades';

export const ARQUIVOS_URL = (
  process.env.EXPO_PUBLIC_ARQUIVOS_URL ?? 'https://dbvplus-arquivos.slowgithub.workers.dev'
).replace(/\/+$/, '');

function caminhoCodificado(caminho: string) {
  return caminho.split('/').map(encodeURIComponent).join('/');
}

export function urlPublicaArquivo(bucket: BucketPublico, caminho: string): string {
  return `${ARQUIVOS_URL}/${bucket}/${caminhoCodificado(caminho)}`;
}

async function tokenAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

interface OpcoesEnvio {
  upsert?: boolean;
  contentType: string;
}

/**
 * Envia um arquivo e devolve a URL pública. Se o Worker estiver fora do ar
 * (falha de rede ou erro 5xx), cai no Storage do Supabase para o envio não
 * quebrar; erros de permissão/validação (4xx) são repassados como estão.
 */
export async function enviarArquivo(
  bucket: BucketPublico,
  caminho: string,
  corpo: Blob | ArrayBuffer | ArrayBufferView,
  { upsert = false, contentType }: OpcoesEnvio,
): Promise<string> {
  const token = await tokenAtual();
  if (!token) throw new Error('Sessão expirada. Entre novamente para enviar arquivos.');

  let resposta: Response | null = null;
  try {
    resposta = await fetch(`${urlPublicaArquivo(bucket, caminho)}${upsert ? '?upsert=1' : ''}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: corpo as any,
    });
  } catch {
    resposta = null;
  }

  if (resposta?.ok) return urlPublicaArquivo(bucket, caminho);

  if (resposta && resposta.status < 500) {
    let mensagem = `Falha ao enviar o arquivo (${resposta.status}).`;
    try {
      const json = await resposta.json();
      if (json?.error) mensagem = String(json.error);
    } catch {
      // mantém a mensagem padrão
    }
    throw new Error(mensagem);
  }

  // Worker indisponível: usa o Supabase como reserva.
  const { data, error } = await supabase.storage.from(bucket).upload(caminho, corpo as any, { upsert, contentType });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
}

/** Remove arquivos (R2 e, se existirem lá, também os antigos do Supabase). */
export async function removerArquivos(bucket: BucketPublico, caminhos: string[]): Promise<void> {
  if (caminhos.length === 0) return;
  const token = await tokenAtual();
  if (!token) throw new Error('Sessão expirada. Entre novamente.');

  let falhou: string | null = null;
  await Promise.all(
    caminhos.map(async (caminho) => {
      try {
        const r = await fetch(urlPublicaArquivo(bucket, caminho), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) falhou = `Falha ao remover o arquivo (${r.status}).`;
      } catch (e: any) {
        falhou = e?.message ?? 'Falha ao remover o arquivo.';
      }
    }),
  );
  // Cópia antiga no Supabase (arquivos anteriores à migração); erro aqui não importa.
  await supabase.storage.from(bucket).remove(caminhos).catch(() => null);
  if (falhou) throw new Error(falhou);
}

/**
 * Caminho do arquivo a partir de uma URL pública, seja a nova (Worker) ou a
 * antiga (Supabase). Devolve null se a URL não é de um arquivo desse bucket.
 */
export function caminhoDaUrlPublica(bucket: BucketPublico, url: string): string | null {
  for (const marcador of [`${ARQUIVOS_URL}/${bucket}/`, `/storage/v1/object/public/${bucket}/`]) {
    const inicio = url.indexOf(marcador);
    if (inicio >= 0) return decodeURIComponent(url.slice(inicio + marcador.length).split('?')[0]);
  }
  return null;
}

/**
 * Se a imagem veio do Worker e ele falhou, a mesma imagem no Storage público do Supabase
 * (de onde o Worker a copia). Devolve null se a URL não é do Worker.
 */
export function urlAlternativaSupabase(url: string): string | null {
  const base = `${ARQUIVOS_URL}/`;
  const supabase = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://enoacjmlcznsrvynnamf.supabase.co';
  if (!supabase || !url.startsWith(base)) return null;
  return `${supabase.replace(/\/$/, '')}/storage/v1/object/public/${url.slice(base.length)}`;
}
