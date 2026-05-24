import { Platform } from 'react-native';
import { supabase } from './supabase';
import type { Usuario } from '../types';

export interface TermoLgpd {
  id: number;
  titulo: string;
  conteudo: string;
  versao: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export const TERMO_LGPD_PADRAO = `TERMO DE CONSENTIMENTO E RESPONSABILIDADE PELO TRATAMENTO DE DADOS

Declaro estar ciente de que o Clube de Desbravadores Fonseca trata dados pessoais necessários para organização administrativa, acompanhamento de membros, controle de presença, pontuação, documentos, atividades, comunicação interna e relatórios do clube.

Os dados podem incluir nome, data de nascimento, contatos, unidade, cargo, informações de responsáveis, registros de pontuação, documentos entregues, imagens anexadas e demais informações necessárias ao funcionamento do clube.

Comprometo-me a utilizar as informações acessadas exclusivamente para as finalidades do clube, mantendo sigilo, cuidado e responsabilidade, especialmente quando envolver dados de crianças, adolescentes, responsáveis e documentos pessoais.

Declaro compreender que não devo compartilhar, copiar, divulgar ou utilizar dados pessoais fora das finalidades autorizadas pela direção do clube, assumindo responsabilidade pelo uso indevido das informações acessadas por meio deste sistema.

Ao aceitar este termo, confirmo minha ciência e concordância com o tratamento dos dados pessoais conforme a Lei Geral de Proteção de Dados (LGPD), para as finalidades legítimas de gestão do Clube de Desbravadores Fonseca.`;

export async function buscarTermoAtivo(): Promise<TermoLgpd | null> {
  const { data, error } = await supabase
    .from('lgpd_termos')
    .select('*')
    .eq('ativo', true)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as TermoLgpd | null;
}

export async function usuarioAceitouTermo(usuarioId: string, termoId?: number | null): Promise<boolean> {
  if (!termoId) return true;
  const { data, error } = await supabase
    .from('lgpd_aceites')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('termo_id', termoId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function usuarioPrecisaAceitarTermo(usuarioId: string): Promise<boolean> {
  const termo = await buscarTermoAtivo();
  if (!termo?.id) return false;
  return !(await usuarioAceitouTermo(usuarioId, termo.id));
}

export async function registrarAceiteLgpd(usuario: Usuario, termo: TermoLgpd): Promise<void> {
  const userAgent =
    Platform.OS === 'web' && typeof navigator !== 'undefined'
      ? navigator.userAgent
      : Platform.OS;

  const { error } = await supabase
    .from('lgpd_aceites')
    .upsert(
      {
        termo_id: termo.id,
        usuario_id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        perfil: usuario.perfil,
        user_agent: userAgent,
        accepted_at: new Date().toISOString(),
      },
      { onConflict: 'termo_id,usuario_id' },
    );

  if (error) throw error;
}
