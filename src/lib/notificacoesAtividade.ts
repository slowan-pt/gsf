import { buscarPaginado } from './supabasePaginado';
import { supabase } from './supabase';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push';
const CABECALHOS = { 'Content-Type': 'application/json', Accept: 'application/json' };
const LIMITE_RECIBO_MS = 24 * 60 * 60 * 1000;
type RetornoExpo = { status: 'ok' | 'error'; id?: string; details?: { error?: string } };

export interface RegistroPushAtividade {
  id: string;
  membros: number;
  sem_aparelho: number;
  falhas: number;
  tickets: string[];
  recibos: Record<string, string>;
  criado_em: string;
}

async function expo(caminho: 'send' | 'getReceipts', dados: unknown) {
  const resp = await fetch(`${EXPO_PUSH}/${caminho}`, {
    method: 'POST', headers: CABECALHOS, body: JSON.stringify(dados),
  });
  if (!resp.ok) throw new Error(`Expo Push retornou HTTP ${resp.status}.`);
  return resp.json();
}

export async function enviarPushAtividade(clubeId: number, atividadeId: number, destinatarios: number[], titulo: string, corpo: string) {
  const membros = [...new Set(destinatarios)];
  const membrosPorConta = new Map<string, Set<number>>();
  const registrarConta = (id: string, membro: number) => {
    const ids = membrosPorConta.get(id) ?? new Set<number>();
    ids.add(membro);
    membrosPorConta.set(id, ids);
  };
  const tickets: string[] = [];
  const comAparelho = new Set<number>();
  let falhas = 0;
  let consultaComErro = false;
  try {
    for (let i = 0; i < membros.length; i += 100) {
      const lote = membros.slice(i, i + 100);
      const [vinculos, legados] = await Promise.all([
        buscarPaginado<{ usuario_id: string; membro_id: number }>((q) => q.eq('clube_id', clubeId)
          .eq('ativo', true).neq('perfil', 'usuario_pais').in('membro_id', lote), 'usuario_clubes', 'usuario_id,membro_id', 'id'),
        buscarPaginado<{ id: string; dbv_id: number }>((q) => q.in('dbv_id', lote), 'usuarios', 'id,dbv_id', 'id'),
      ]);
      vinculos.forEach((v) => registrarConta(v.usuario_id, v.membro_id));
      legados.forEach((u) => registrarConta(u.id, u.dbv_id));
    }
    const tokens = new Set<string>();
    const contas = [...membrosPorConta.keys()];
    for (let i = 0; i < contas.length; i += 100) {
      const linhas = await buscarPaginado<{ user_id: string; token: string }>(
        (q) => q.in('user_id', contas.slice(i, i + 100)), 'push_tokens', 'user_id,token', 'id',
      );
      for (const linha of linhas) {
        if (!/^(?:ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(linha.token)) continue;
        tokens.add(linha.token);
        membrosPorConta.get(linha.user_id)?.forEach((m) => comAparelho.add(m));
      }
    }
    const aparelhos = [...tokens];
    for (let i = 0; i < aparelhos.length; i += 100) {
      const lote = aparelhos.slice(i, i + 100);
      try {
        const retorno = await expo('send', lote.map((to) => ({
          to, title: titulo, body: corpo, sound: 'default', channelId: 'default', priority: 'high',
          data: { tela: 'atividades', atividadeId: String(atividadeId) },
        })));
        const enviados: RetornoExpo[] = Array.isArray(retorno?.data) ? retorno.data : retorno?.data ? [retorno.data] : [];
        for (const [indice] of lote.entries()) {
          const ticket = enviados[indice];
          if (ticket?.status === 'ok' && typeof ticket.id === 'string') tickets.push(ticket.id);
          else falhas++;
        }
      } catch {
        falhas += lote.length;
      }
    }
  } catch (erro) {
    consultaComErro = true;
    console.warn('[atividades] não foi possível consultar os aparelhos', erro);
  }

  const registro = { clube_id: clubeId, atividade_id: atividadeId, membros: membros.length,
    sem_aparelho: consultaComErro ? 0 : membros.length - comAparelho.size, falhas, tickets, consulta_com_erro: consultaComErro };
  const { error } = await supabase.from('atividades_push').insert(registro);
  if (error) throw error;
  return registro;
}

export async function consultarPushAtividade(clubeId: number, atividadeId: number, verificar: boolean) {
  const { data, error } = await supabase.from('atividades_push')
    .select('id,membros,sem_aparelho,falhas,tickets,recibos,criado_em,consulta_com_erro')
    .eq('clube_id', clubeId).eq('atividade_id', atividadeId).order('criado_em', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const registro = data as RegistroPushAtividade & { consulta_com_erro: boolean };
  if (!verificar) return registro;
  const pendentes = registro.tickets.filter((id) => !registro.recibos[id]);
  if (pendentes.length === 0) return registro;
  const novos: Record<string, string> = {};
  if (Date.now() - Date.parse(registro.criado_em) >= LIMITE_RECIBO_MS) {
    for (const id of pendentes) novos[id] = 'expirado';
  } else {
    for (let i = 0; i < pendentes.length; i += 1000) {
      const ids = pendentes.slice(i, i + 1000);
      const retorno = await expo('getReceipts', { ids });
      if (retorno?.errors?.length || !retorno?.data) throw new Error('A Expo não retornou os recibos desta vez.');
      const recibos = retorno.data as Record<string, RetornoExpo | undefined>;
      for (const id of ids) {
        const recibo = recibos[id];
        if (recibo?.status === 'ok') novos[id] = 'confirmado_provedor';
        if (recibo?.status === 'error') novos[id] = recibo.details?.error || 'recusado_provedor';
      }
    }
  }
  if (!Object.keys(novos).length) return registro;
  const { data: atualizados, error: erroAtualizar } = await supabase.rpc('registrar_recibos_atividade', {
    p_clube_id: clubeId, p_registro_id: registro.id, p_recibos: novos,
  });
  if (erroAtualizar) throw erroAtualizar;
  return { ...registro, recibos: atualizados as RegistroPushAtividade['recibos'] };
}
