import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { getDB } from './database';
import { supabase } from './supabase';

async function temConexao() {
  if (Platform.OS === 'web') return typeof navigator === 'undefined' ? true : navigator.onLine;
  const state = await NetInfo.fetch();
  return !!state.isConnected;
}

// Puxa dados frescos do Supabase para o SQLite local (requer autenticação para desbravadores)
export async function puxarDeSupabase(): Promise<boolean> {
  if (!(await temConexao())) return false;

  try {
    const db = await getDB();

    // Busca tudo do Supabase primeiro (rede é o gargalo aqui, não o SQLite).
    const [
      { data: unidades },
      { data: desbravadores },
      { data: documentos },
      { data: documentoImagens },
      { data: progresso },
      { data: eventos },
      { data: especialidades },
      { data: pontuacoes },
      { data: configPontuacao },
      { data: configItens },
      { data: pontuacoesCustom },
      { data: pontuacoesUnidades },
      { data: configCampori },
      { data: parcelasCampori },
      { data: pagamentosCampori },
      { data: mensagens },
    ] = await Promise.all([
      supabase.from('unidades').select('*'),
      supabase.from('desbravadores').select('*').order('idx'),
      supabase.from('documentos').select('*'),
      supabase.from('documento_imagens').select('*').order('dbv_id'),
      supabase.from('progresso_classes').select('*'),
      supabase.from('eventos').select('*').order('data'),
      supabase.from('especialidades').select('*').order('dbv_id'),
      supabase.from('pontuacoes').select('*').order('data'),
      supabase.from('config_pontuacao').select('*').eq('id', 1).maybeSingle(),
      // Cache offline dos tipos de pontuação: espelha `pontuacao_itens`
      // (a mesma tabela que web e app leem online) na tabela local legada.
      supabase.from('pontuacao_itens').select('*').order('ordem'),
      supabase.from('pontuacoes_custom').select('*').order('data'),
      supabase.from('pontuacoes_unidades').select('*').order('data'),
      supabase.from('config_campori').select('*').eq('id', 1).maybeSingle(),
      supabase.from('parcelas_campori_config').select('*').order('numero'),
      supabase.from('pagamentos_campori').select('*').order('dbv_id'),
      supabase.from('mensagens_clube').select('*').order('created_at'),
    ]);

    // Grava tudo numa unica transacao — antes cada linha era um commit
    // separado (centenas/milhares de gravacoes sequenciais), o que fazia a
    // sincronizacao demorar muito. Agora o SQLite so confirma uma vez no final.
    await db.withExclusiveTransactionAsync(async (txn) => {
      if (unidades) {
        for (const u of unidades) {
          const cor = u.cor ?? corUnidadePadrao(u.nome);
          await txn.runAsync(
            'INSERT OR REPLACE INTO unidades (id, nome, cor, codigo_clube, senha_unidade) VALUES (?,?,?,?,?)',
            [u.id, u.nome, cor, u.codigo_clube, u.senha_unidade]
          );
        }
      }
      await garantirUnidadesLocais(txn);

      if (desbravadores) {
        for (const d of desbravadores) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO desbravadores
             (id, idx, id_sgc, nome, data_nascimento, idade, genero, unidade_id, unidade_nome, cargo, cargo_adicional, contato, email, camisa, calca, campori_dsa, nome_responsavel, contato_responsavel, foto_url, ativo)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [d.id, d.idx, d.id_sgc, d.nome, d.data_nascimento, d.idade, d.genero,
             d.unidade_id, d.unidade_nome, d.cargo, d.cargo_adicional ?? null, d.contato ?? null, d.email ?? null,
             d.camisa ?? null, d.calca ?? null, d.campori_dsa ? 1 : 0,
             d.nome_responsavel ?? null, d.contato_responsavel ?? null, d.foto_url ?? null,
             d.ativo === false ? 0 : 1]
          );
        }
      }
      await garantirUnidadesLocais(txn);

      if (documentos) {
        for (const doc of documentos) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO documentos
             (id, dbv_id, rg, cpf, rg_resp, cartao_sus, cartao_plano, ficha_saude, carteira_vacinacao, laudo_medico, ficha_reg, comp_residencia, aut_saida, aut_viagem, ri_assinado, foto, ant_criminais)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [doc.id, doc.dbv_id, doc.rg, doc.cpf, doc.rg_resp, doc.cartao_sus, doc.cartao_plano,
             doc.ficha_saude, doc.carteira_vacinacao, doc.laudo_medico, doc.ficha_reg,
             doc.comp_residencia, doc.aut_saida, doc.aut_viagem, doc.ri_assinado, doc.foto, doc.ant_criminais]
          );
        }
      }

      if (documentoImagens) {
        for (const img of documentoImagens) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO documento_imagens (id, dbv_id, campo, url, created_at)
             VALUES (?,?,?,?,?)`,
            [img.id, img.dbv_id, img.campo, img.url, img.created_at ?? null]
          );
        }
      }

      if (progresso) {
        for (const p of progresso) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO progresso_classes
             (id, dbv_id, amigo, amigo_nat, companheiro, comp_exc, pesquisador, pesquisador_cb,
              pioneiro, pioneiro_nf, excursionista, exc_mata, guia, guia_exp, agrupada, lider, lider_master, lider_ma)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [p.id, p.dbv_id, p.amigo, p.amigo_nat, p.companheiro, p.comp_exc,
             p.pesquisador, p.pesquisador_cb, p.pioneiro, p.pioneiro_nf, p.excursionista,
             p.exc_mata, p.guia, p.guia_exp, p.agrupada, p.lider, p.lider_master, p.lider_ma]
          );
        }
      }

      if (eventos) {
        for (const e of eventos) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO eventos (id, data, horario, local, atividade, responsavel, apoio, material, observacoes, semestre)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [e.id, e.data, e.horario, e.local, e.atividade, e.responsavel,
             e.apoio ?? null, e.material ?? null, e.observacoes ?? null, e.semestre ?? 1]
          );
        }
      }

      if (especialidades) {
        for (const esp of especialidades) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO especialidades
             (id, dbv_id, nome, status, atividade_origem_id, atividade_origem_titulo,
              atividade_origem_excluida, atividade_origem_excluida_em, plano_formativo_id)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [
              esp.id,
              esp.dbv_id,
              esp.nome,
              esp.status,
              esp.atividade_origem_id ?? null,
              esp.atividade_origem_titulo ?? null,
              esp.atividade_origem_excluida ? 1 : 0,
              esp.atividade_origem_excluida_em ?? null,
              esp.plano_formativo_id ?? null,
            ]
          );
        }
      }

      if (pontuacoes) {
        for (const p of pontuacoes) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO pontuacoes
             (id, dbv_id, data, presenca, pontualidade, material, uniforme,
              presenca_pts, pontualidade_pts, material_pts, uniforme_pts,
              bom_biblia, pontos_extras, classe_biblica, especialidade, pgm_especial,
              atividade_unidade, observacao, lancado_por, created_at, updated_at, sincronizado)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
            [
              p.id, p.dbv_id, p.data,
              p.presenca ? 1 : 0,
              p.pontualidade ? 1 : 0,
              p.material ? 1 : 0,
              p.uniforme ? 1 : 0,
              p.presenca_pts ?? null,
              p.pontualidade_pts ?? null,
              p.material_pts ?? null,
              p.uniforme_pts ?? null,
              p.bom_biblia ?? 0,
              p.pontos_extras ?? 0,
              p.classe_biblica ?? 0,
              p.especialidade ?? 0,
              p.pgm_especial ?? 0,
              p.atividade_unidade ?? 0,
              p.observacao ?? null,
              p.lancado_por ?? null,
              p.created_at ?? null,
              p.updated_at ?? null,
            ]
          );
        }
      }

      if (configPontuacao) {
        await txn.runAsync(
          `INSERT OR REPLACE INTO config_pontuacao
           (id, presenca, pontualidade, material, uniforme, updated_at)
           VALUES (?,?,?,?,?,?)`,
          [
            configPontuacao.id ?? 1,
            configPontuacao.presenca ?? 25,
            configPontuacao.pontualidade ?? 100,
            configPontuacao.material ?? 25,
            configPontuacao.uniforme ?? 25,
            configPontuacao.updated_at ?? null,
          ]
        );
      }

      if (configItens) {
        // Limpa antes: senão itens antigos da tabela legada continuariam
        // aparecendo offline junto com os de `pontuacao_itens`.
        await txn.runAsync('DELETE FROM config_pontuacao_itens');
        for (const item of configItens) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO config_pontuacao_itens
             (id, nome, valor, ativo, created_at, updated_at)
             VALUES (?,?,?,?,?,?)`,
            [
              item.id,
              item.titulo ?? item.nome,
              item.valor ?? 0,
              item.ativo ? 1 : 0,
              item.created_at ?? null,
              item.updated_at ?? null,
            ]
          );
        }
      }

      if (pontuacoesCustom) {
        for (const pc of pontuacoesCustom) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO pontuacoes_custom
             (id, dbv_id, data, item_id, item_nome, item_valor, quantidade, pontos, updated_at, sincronizado)
             VALUES (?,?,?,?,?,?,?,?,?,1)`,
            [
              pc.id,
              pc.dbv_id,
              pc.data,
              pc.item_id,
              pc.item_nome ?? null,
              pc.item_valor ?? null,
              pc.quantidade ?? 0,
              pc.pontos ?? 0,
              pc.updated_at ?? null,
            ]
          );
        }
      }

      if (pontuacoesUnidades) {
        for (const pu of pontuacoesUnidades) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO pontuacoes_unidades
             (id, clube_id, programa_id, unidade_id, unidade_nome, data, pontos, descricao, lancado_por, created_at, updated_at, sincronizado)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`,
            [
              pu.id,
              pu.clube_id ?? null,
              pu.programa_id ?? null,
              pu.unidade_id ?? null,
              pu.unidade_nome,
              pu.data,
              pu.pontos ?? 0,
              pu.descricao ?? '',
              pu.lancado_por ?? null,
              pu.created_at ?? null,
              pu.updated_at ?? null,
            ]
          );
        }
      }

      if (configCampori) {
        await txn.runAsync(
          `INSERT OR REPLACE INTO config_campori (id, num_parcelas, data_vencimento_dia, updated_at)
           VALUES (?,?,?,?)`,
          [
            configCampori.id ?? 1,
            configCampori.num_parcelas ?? 4,
            configCampori.data_vencimento_dia ?? 10,
            configCampori.updated_at ?? null,
          ]
        );
      }

      if (parcelasCampori) {
        await txn.runAsync('DELETE FROM parcelas_campori_config');
        for (const parcela of parcelasCampori) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO parcelas_campori_config (id, numero, valor, descricao)
             VALUES (?,?,?,?)`,
            [parcela.id, parcela.numero, parcela.valor, parcela.descricao ?? null]
          );
        }
      }

      if (pagamentosCampori) {
        for (const pg of pagamentosCampori) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO pagamentos_campori
             (id, dbv_id, parcela_numero, valor_pago, data_pagamento, pago, observacao, updated_at, sincronizado)
             VALUES (?,?,?,?,?,?,?,?,1)`,
            [
              pg.id,
              pg.dbv_id,
              pg.parcela_numero,
              pg.valor_pago ?? 0,
              pg.data_pagamento ?? null,
              pg.pago ? 1 : 0,
              pg.observacao ?? null,
              pg.updated_at ?? null,
            ]
          );
        }
      }

      if (mensagens) {
        for (const msg of mensagens) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO mensagens_clube (id, titulo, corpo, enviado_por, lida, created_at)
             VALUES (?,?,?,?,?,?)`,
            [
              msg.id,
              msg.titulo,
              msg.corpo,
              msg.enviado_por ?? null,
              msg.lida ? 1 : 0,
              msg.created_at ?? null,
            ]
          );
        }
      }

    });

    // Atividades tem seu proprio fetch+transacao (evita transacao aninhada).
    await puxarAtividades(db);

    console.log('✅ Dados sincronizados do Supabase!');
    return true;
  } catch (e) {
    console.error('Erro ao puxar de Supabase:', e);
    return false;
  }
}

function corUnidadePadrao(nome?: string | null) {
  const mapa: Record<string, string> = {
    'Amor Perfeito': '#e91e63',
    'Sempre Viva': '#4caf50',
    'Águia Dourada': '#ff9800',
    'Leões': '#2196f3',
  };
  return nome && mapa[nome] ? mapa[nome] : '#1a3a5c';
}

async function garantirUnidadesLocais(db: import('expo-sqlite').SQLiteDatabase) {
  const defaults = [
    [1, 'Amor Perfeito', '#e91e63'],
    [2, 'Sempre Viva', '#4caf50'],
    [3, 'Águia Dourada', '#ff9800'],
    [4, 'Leões', '#2196f3'],
  ] as const;
  for (const [id, nome, cor] of defaults) {
    const existeNome = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE nome = ?', [nome]);
    if (!existeNome) {
      const existeId = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE id = ?', [id]);
      if (existeId) {
        await db.runAsync('INSERT INTO unidades (nome, cor) VALUES (?,?)', [nome, cor]);
      } else {
        await db.runAsync('INSERT INTO unidades (id, nome, cor) VALUES (?,?,?)', [id, nome, cor]);
      }
    }
  }

  const derivadas = await db.getAllAsync<{ unidade_id: number | null; unidade_nome: string | null }>(
    `SELECT DISTINCT unidade_id, unidade_nome FROM desbravadores
     WHERE unidade_nome IS NOT NULL AND unidade_nome != 'Diretoria'`
  );
  for (const u of derivadas) {
    if (!u.unidade_nome) continue;
    const existeNome = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE nome = ?', [u.unidade_nome]);
    if (existeNome) continue;
    if (u.unidade_id && u.unidade_id > 0) {
      const existeId = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE id = ?', [u.unidade_id]);
      if (existeId) {
        await db.runAsync('INSERT INTO unidades (nome, cor) VALUES (?,?)', [u.unidade_nome, corUnidadePadrao(u.unidade_nome)]);
      } else {
        await db.runAsync('INSERT INTO unidades (id, nome, cor) VALUES (?,?,?)', [u.unidade_id, u.unidade_nome, corUnidadePadrao(u.unidade_nome)]);
      }
    } else {
      await db.runAsync('INSERT INTO unidades (nome, cor) VALUES (?,?)', [u.unidade_nome, corUnidadePadrao(u.unidade_nome)]);
    }
  }
}

export async function puxarAtividades(dbArg?: import('expo-sqlite').SQLiteDatabase): Promise<void> {
  try {
    const db = dbArg ?? await getDB();
    const [
      { data: atividades },
      { data: planos },
      { data: alvos },
      { data: anexos },
      { data: respostas },
    ] = await Promise.all([
      supabase.from('atividades').select('*'),
      supabase.from('planos_formativos').select('*'),
      supabase.from('atividades_alvos').select('*'),
      supabase.from('atividades_anexos').select('*'),
      supabase.from('atividades_respostas').select('*'),
    ]);

    await db.withExclusiveTransactionAsync(async (txn) => {
      if (atividades) {
        for (const a of atividades) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO atividades
             (id, supabase_id, titulo, descricao, data, destino, unidade_id, unidade_nome, dbv_id, dbv_nome, criado_por, avaliador_id, avaliador_nome, item_formativo_tipo, item_formativo_nome, gera_investidura, plano_formativo_id, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [a.id, a.id, a.titulo, a.descricao, a.data, a.destino,
             a.unidade_id, a.unidade_nome, a.dbv_id, a.dbv_nome,
             a.criado_por, a.avaliador_id ?? null, a.avaliador_nome ?? null,
             a.item_formativo_tipo ?? null, a.item_formativo_nome ?? null, a.gera_investidura ? 1 : 0, a.plano_formativo_id ?? null,
             a.created_at]
          );
        }
      }

      if (planos) {
        for (const plano of planos) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO planos_formativos
             (id, clube_id, tipo, item_nome, titulo, avaliacoes_necessarias, ativo, criado_por, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [plano.id, plano.clube_id, plano.tipo, plano.item_nome, plano.titulo,
             plano.avaliacoes_necessarias, plano.ativo ? 1 : 0, plano.criado_por ?? null,
             plano.created_at ?? null, plano.updated_at ?? null]
          );
        }
      }

      if (alvos) {
        for (const alvo of alvos) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO atividades_alvos
             (supabase_id, atividade_id, tipo, unidade_id, membro_id, created_at)
             VALUES (?,?,?,?,?,?)`,
            [
              alvo.id,
              alvo.atividade_id,
              alvo.tipo,
              alvo.unidade_id ?? null,
              alvo.membro_id ?? null,
              alvo.created_at ?? null,
            ]
          );
        }
      }

      if (anexos) {
        for (const anexo of anexos) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO atividades_anexos
             (supabase_id, atividade_id, nome, url, tipo, created_at)
             VALUES (?,?,?,?,?,?)`,
            [
              anexo.id,
              anexo.atividade_id,
              anexo.nome,
              anexo.url,
              anexo.tipo ?? 'outro',
              anexo.created_at ?? null,
            ]
          );
        }
      }

      if (respostas) {
        for (const resposta of respostas) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO atividades_respostas
             (supabase_id, atividade_id, dbv_id, dbv_nome, texto, anexo_url, anexo_nome, status, nota, comentario_avaliador, avaliado_por, avaliado_em, entregue_em, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              resposta.id,
              resposta.atividade_id,
              resposta.dbv_id,
              resposta.dbv_nome ?? null,
              resposta.texto ?? null,
              resposta.anexo_url ?? null,
              resposta.anexo_nome ?? null,
              resposta.status ?? 'entregue',
              resposta.nota ?? null,
              resposta.comentario_avaliador ?? null,
              resposta.avaliado_por ?? null,
              resposta.avaliado_em ?? null,
              resposta.entregue_em ?? resposta.created_at ?? null,
              resposta.created_at ?? null,
              resposta.updated_at ?? null,
            ]
          );
        }
      }
    });
  } catch {
    // Falha silenciosa — offline
  }
}

/**
 * Tabelas cujo id no Supabase é gerado pelo servidor (SERIAL/BIGSERIAL) —
 * o id local (SQLite AUTOINCREMENT) é só um contador do próprio aparelho e
 * NUNCA corresponde ao id real do Supabase. Fazer upsert mandando esse id
 * local causava sobrescrever linhas erradas (ou falhar e travar a fila pra
 * sempre) — em vez disso, insere sem id e reconcilia o id local com o real
 * assim que o Supabase responde.
 */
const TABELAS_ID_GERADO_NO_SERVIDOR = new Set([
  'pontuacoes', 'pontuacoes_custom', 'pontuacoes_unidades', 'config_pontuacao_itens', 'mensagens_clube',
  'desbravadores',
]);

/**
 * Tabelas locais que guardam dbv_id apontando para `desbravadores`. Quando o
 * id local de um membro é reconciliado com o id real do servidor, essas
 * também precisam ser atualizadas — senão ficam órfãs, referenciando um id
 * que já não existe mais localmente.
 */
const TABELAS_FILHAS_DE_DBV_ID = [
  'documentos', 'progresso_classes', 'especialidades', 'pontuacoes', 'pontuacoes_custom',
];

/**
 * Envio em andamento. Chamadas concorrentes reaproveitam a mesma execução em
 * vez de processarem a fila duas vezes (o que reenviaria as mesmas linhas).
 */
let envioEmAndamento: Promise<{ sucesso: boolean; motivo?: string; erros?: string[] }> | null = null;

export async function sincronizarTudo(): Promise<{ sucesso: boolean; motivo?: string; erros?: string[] }> {
  if (envioEmAndamento) return envioEmAndamento;
  envioEmAndamento = executarEnvio();
  try {
    return await envioEmAndamento;
  } finally {
    envioEmAndamento = null;
  }
}

async function executarEnvio(): Promise<{ sucesso: boolean; motivo?: string; erros?: string[] }> {
  if (!(await temConexao())) return { sucesso: false, motivo: 'sem_internet' };

  const db = await getDB();
  const fila = await db.getAllAsync<{
    id: string;
    tabela: string;
    operacao: string;
    dados: string;
  }>('SELECT * FROM fila_sync ORDER BY created_at ASC');

  const erros: string[] = [];

  for (const op of fila) {
    try {
      const dados = JSON.parse(op.dados);
      if (op.operacao === 'INSERT' && TABELAS_ID_GERADO_NO_SERVIDOR.has(op.tabela) && typeof dados.id === 'number') {
        const idLocal = dados.id;
        const { id: _idLocalDescartado, ...semId } = dados;
        const { data: inserido, error } = await supabase.from(op.tabela).insert(semId).select('id').single();
        if (error) throw error;
        if (inserido?.id != null && inserido.id !== idLocal) {
          await db.runAsync(`UPDATE ${op.tabela} SET id = ? WHERE id = ?`, [inserido.id, idLocal]);
          if (op.tabela === 'desbravadores') {
            for (const filha of TABELAS_FILHAS_DE_DBV_ID) {
              await db.runAsync(`UPDATE ${filha} SET dbv_id = ? WHERE dbv_id = ?`, [inserido.id, idLocal]).catch(() => {});
            }
          }
        }
      } else if (op.operacao === 'INSERT' || op.operacao === 'UPDATE') {
        await supabase.from(op.tabela).upsert(dados);
      } else if (op.operacao === 'DELETE') {
        await supabase.from(op.tabela).delete().eq('id', dados.id);
      }
      await db.runAsync('DELETE FROM fila_sync WHERE id = ?', [op.id]);
    } catch (e) {
      erros.push(op.id);
    }
  }

  return { sucesso: erros.length === 0, erros };
}

export async function adicionarFilaSync(
  tabela: string,
  operacao: 'INSERT' | 'UPDATE' | 'DELETE',
  dados: Record<string, unknown>
) {
  const db = await getDB();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.runAsync(
    'INSERT INTO fila_sync (id, tabela, operacao, dados) VALUES (?, ?, ?, ?)',
    [id, tabela, operacao, JSON.stringify(dados)]
  );
  // Empurra pro servidor na hora. Antes a fila só era esvaziada na abertura do
  // app (ou no botão manual da tela inicial), então algo salvo no celular podia
  // demorar horas — até o próximo restart — para aparecer no web.
  agendarEnvioFila();
}

let envioAgendado: ReturnType<typeof setTimeout> | null = null;

/**
 * Agenda o envio da fila. O pequeno atraso agrupa gravações em rajada (ex.: a
 * grade de pontuação salva vários membros seguidos) num único envio.
 */
export function agendarEnvioFila(atrasoMs = 800) {
  if (Platform.OS === 'web') return;
  if (envioAgendado) clearTimeout(envioAgendado);
  envioAgendado = setTimeout(() => {
    envioAgendado = null;
    sincronizarTudo().catch(() => {});
  }, atrasoMs);
}
