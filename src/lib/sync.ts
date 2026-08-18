import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { getDB } from './database';
import { supabase } from './supabase';
import { useSincroniaStore } from '../stores/sincroniaStore';

async function temConexao() {
  if (Platform.OS === 'web') return typeof navigator === 'undefined' ? true : navigator.onLine;
  const state = await NetInfo.fetch();
  return !!state.isConnected;
}

/**
 * O download era um bloco único com 16 tabelas: nada aparecia até TUDO chegar,
 * e as tabelas pesadas (documentos e imagens) seguravam as leves. Agora cada
 * grupo é independente e roda na ordem de utilidade — nomes e pontuação
 * primeiro, fichas e documentos por último.
 */
async function gravar(escrever: (db: import('expo-sqlite').SQLiteDatabase) => Promise<void>) {
  const db = await getDB();
  // Transação normal (não exclusiva): em modo WAL as telas continuam lendo.
  await db.withTransactionAsync(async () => { await escrever(db); });
}

/** Teto de linhas por requisição no PostgREST. */
const PAGINA_SUPABASE = 1000;

/**
 * Baixa a tabela INTEIRA, em páginas. Um `select()` simples devolve no máximo
 * mil linhas: tabelas grandes (pontuação, respostas de atividades) vinham
 * truncadas, e o aparelho ficava com um retrato parcial sem nenhum aviso.
 */
async function buscarTudo(
  tabela: string,
  colunas = '*',
  ordenarPor?: string,
): Promise<any[]> {
  const todas: any[] = [];
  for (let pagina = 0; ; pagina++) {
    let consulta = supabase
      .from(tabela)
      .select(colunas)
      .range(pagina * PAGINA_SUPABASE, pagina * PAGINA_SUPABASE + PAGINA_SUPABASE - 1);
    if (ordenarPor) consulta = consulta.order(ordenarPor);
    const { data, error } = await consulta;
    if (error) throw error;
    const lote = data ?? [];
    todas.push(...lote);
    if (lote.length < PAGINA_SUPABASE) return todas;
  }
}

/**
 * Apaga as linhas locais que não existem mais no servidor. Sem isto, tudo o que
 * era excluído em outro aparelho (ou na Web) continuava vivo neste celular para
 * sempre — reaparecendo nas telas como se ainda existisse.
 *
 * Só é seguro com a lista COMPLETA do servidor (ver `buscarTudo`): com uma
 * página só, apagaria dados válidos. O que ainda está na fila de envio é
 * preservado — são linhas que o servidor legitimamente ainda não conhece.
 */
async function removerOrfaos(
  db: import('expo-sqlite').SQLiteDatabase,
  tabela: string,
  linhasDoServidor: any[],
  /** Coluna local que guarda o id do servidor. As filhas de atividades usam `supabase_id`. */
  colunaLocal = 'id',
) {
  const idsServidor = linhasDoServidor
    .map((linha) => linha?.id)
    .filter((id) => id != null);

  const pendentes = await db.getAllAsync<{ dados: string }>(
    'SELECT dados FROM fila_sync WHERE tabela = ?',
    [tabela],
  );
  const idsPendentes: any[] = [];
  for (const pendente of pendentes) {
    try {
      const id = JSON.parse(pendente.dados)?.id;
      if (id != null) idsPendentes.push(id);
    } catch { /* linha ilegível: ignora */ }
  }

  const manter = [...idsServidor, ...idsPendentes];
  if (manter.length === 0) {
    // Nada veio do servidor. Pode ser uma tabela realmente vazia, mas também
    // pode ser sessão expirada ou permissão negada — casos em que a consulta
    // volta vazia sem erro. Apagar aqui limparia o aparelho inteiro à toa, então
    // preferimos manter o que já existe e tentar de novo no próximo download.
    return;
  }
  const marcadores = manter.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM ${tabela} WHERE ${colunaLocal} NOT IN (${marcadores})`, manter);
}

/** 1 — Nomes dos membros e unidades. É o que destrava quase todas as telas. */
export async function puxarMembros(): Promise<boolean> {
  if (!(await temConexao())) return false;
  try {
    const [unidades, desbravadores] = await Promise.all([
      buscarTudo('unidades'),
      buscarTudo('desbravadores', '*', 'idx'),
    ]);

    await gravar(async (db) => {
      if (unidades) {
        for (const u of unidades) {
          await db.runAsync(
            'INSERT OR REPLACE INTO unidades (id, nome, cor, codigo_clube, senha_unidade) VALUES (?,?,?,?,?)',
            [u.id, u.nome, u.cor ?? corUnidadePadrao(u.nome), u.codigo_clube, u.senha_unidade]
          );
        }
      }
      await garantirUnidadesLocais(db);

      if (desbravadores) {
        // Membro excluído na Web precisa sumir do celular também.
        await removerOrfaos(db, 'desbravadores', desbravadores);
        for (const d of desbravadores) {
          await db.runAsync(
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
      await garantirUnidadesLocais(db);
    });
    return true;
  } catch (e) {
    console.error('Erro ao puxar membros:', e);
    return false;
  }
}

/** 2 — Pontuação, pontos extras e configuração da grade. */
export async function puxarPontuacoes(): Promise<boolean> {
  if (!(await temConexao())) return false;
  try {
    const [
      { data: configPontuacao },
      configItens,
      pontuacoes,
      pontuacoesCustom,
      pontuacoesUnidades,
    ] = await Promise.all([
      supabase.from('config_pontuacao').select('*').eq('id', 1).maybeSingle(),
      // Espelha `pontuacao_itens` (tabela que web e app leem online) na local legada.
      buscarTudo('pontuacao_itens', '*', 'ordem'),
      buscarTudo('pontuacoes', '*', 'data'),
      buscarTudo('pontuacoes_custom', '*', 'data'),
      buscarTudo('pontuacoes_unidades', '*', 'data'),
    ]);

    await gravar(async (db) => {
      if (configPontuacao) {
        await db.runAsync(
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
        await db.runAsync('DELETE FROM config_pontuacao_itens');
        for (const item of configItens) {
          await db.runAsync(
            `INSERT OR REPLACE INTO config_pontuacao_itens
             (id, nome, valor, ativo, created_at, updated_at)
             VALUES (?,?,?,?,?,?)`,
            [item.id, item.titulo ?? item.nome, item.valor ?? 0, item.ativo ? 1 : 0,
             item.created_at ?? null, item.updated_at ?? null]
          );
        }
      }

      if (pontuacoes) {
        await removerOrfaos(db, 'pontuacoes', pontuacoes);
        for (const p of pontuacoes) {
          await db.runAsync(
            `INSERT OR REPLACE INTO pontuacoes
             (id, dbv_id, data, presenca, pontualidade, material, uniforme,
              presenca_pts, pontualidade_pts, material_pts, uniforme_pts,
              bom_biblia, pontos_extras, classe_biblica, especialidade, pgm_especial,
              atividade_unidade, observacao, lancado_por, created_at, updated_at, sincronizado)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
            [
              p.id, p.dbv_id, p.data,
              p.presenca ? 1 : 0, p.pontualidade ? 1 : 0, p.material ? 1 : 0, p.uniforme ? 1 : 0,
              p.presenca_pts ?? null, p.pontualidade_pts ?? null,
              p.material_pts ?? null, p.uniforme_pts ?? null,
              p.bom_biblia ?? 0, p.pontos_extras ?? 0, p.classe_biblica ?? 0,
              p.especialidade ?? 0, p.pgm_especial ?? 0, p.atividade_unidade ?? 0,
              p.observacao ?? null, p.lancado_por ?? null,
              p.created_at ?? null, p.updated_at ?? null,
            ]
          );
        }
      }

      if (pontuacoesCustom) {
        await removerOrfaos(db, 'pontuacoes_custom', pontuacoesCustom);
        for (const pc of pontuacoesCustom) {
          await db.runAsync(
            `INSERT OR REPLACE INTO pontuacoes_custom
             (id, dbv_id, data, item_id, item_nome, item_valor, quantidade, pontos, updated_at, sincronizado)
             VALUES (?,?,?,?,?,?,?,?,?,1)`,
            [pc.id, pc.dbv_id, pc.data, pc.item_id, pc.item_nome ?? null,
             pc.item_valor ?? null, pc.quantidade ?? 0, pc.pontos ?? 0, pc.updated_at ?? null]
          );
        }
      }

      if (pontuacoesUnidades) {
        await removerOrfaos(db, 'pontuacoes_unidades', pontuacoesUnidades);
        for (const pu of pontuacoesUnidades) {
          await db.runAsync(
            `INSERT OR REPLACE INTO pontuacoes_unidades
             (id, clube_id, programa_id, unidade_id, unidade_nome, data, pontos, descricao, lancado_por, created_at, updated_at, sincronizado)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`,
            [pu.id, pu.clube_id ?? null, pu.programa_id ?? null, pu.unidade_id ?? null,
             pu.unidade_nome, pu.data, pu.pontos ?? 0, pu.descricao ?? '',
             pu.lancado_por ?? null, pu.created_at ?? null, pu.updated_at ?? null]
          );
        }
      }
    });
    return true;
  } catch (e) {
    console.error('Erro ao puxar pontuações:', e);
    return false;
  }
}

/** 3 — Progresso de classes e especialidades conquistadas. */
export async function puxarClassesEspecialidades(): Promise<boolean> {
  if (!(await temConexao())) return false;
  try {
    const [progresso, especialidades] = await Promise.all([
      buscarTudo('progresso_classes'),
      buscarTudo('especialidades', '*', 'dbv_id'),
    ]);

    await gravar(async (db) => {
      if (progresso) {
        await removerOrfaos(db, 'progresso_classes', progresso);
        for (const p of progresso) {
          await db.runAsync(
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

      if (especialidades) {
        // Especialidade removida de um membro precisa sumir do celular também.
        await removerOrfaos(db, 'especialidades', especialidades);
        for (const esp of especialidades) {
          await db.runAsync(
            `INSERT OR REPLACE INTO especialidades
             (id, dbv_id, nome, status, atividade_origem_id, atividade_origem_titulo,
              atividade_origem_excluida, atividade_origem_excluida_em, plano_formativo_id)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [esp.id, esp.dbv_id, esp.nome, esp.status,
             esp.atividade_origem_id ?? null, esp.atividade_origem_titulo ?? null,
             esp.atividade_origem_excluida ? 1 : 0, esp.atividade_origem_excluida_em ?? null,
             esp.plano_formativo_id ?? null]
          );
        }
      }
    });
    return true;
  } catch (e) {
    console.error('Erro ao puxar classes/especialidades:', e);
    return false;
  }
}

/** 4 — Avisos e agenda. */
export async function puxarComunicacao(): Promise<boolean> {
  if (!(await temConexao())) return false;
  try {
    const [mensagens, eventos] = await Promise.all([
      buscarTudo('mensagens_clube', '*', 'created_at'),
      buscarTudo('eventos', '*', 'data'),
    ]);

    await gravar(async (db) => {
      if (mensagens) {
        // Aviso excluído para todos precisa sumir do celular também.
        await removerOrfaos(db, 'mensagens_clube', mensagens);
        for (const msg of mensagens) {
          await db.runAsync(
            `INSERT OR REPLACE INTO mensagens_clube (id, titulo, corpo, enviado_por, lida, created_at)
             VALUES (?,?,?,?,?,?)`,
            [msg.id, msg.titulo, msg.corpo, msg.enviado_por ?? null, msg.lida ? 1 : 0, msg.created_at ?? null]
          );
        }
      }

      if (eventos) {
        // Evento cancelado na agenda precisa sumir do celular também.
        await removerOrfaos(db, 'eventos', eventos);
        for (const e of eventos) {
          await db.runAsync(
            `INSERT OR REPLACE INTO eventos (id, data, horario, local, atividade, responsavel, apoio, material, observacoes, semestre)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [e.id, e.data, e.horario, e.local, e.atividade, e.responsavel,
             e.apoio ?? null, e.material ?? null, e.observacoes ?? null, e.semestre ?? 1]
          );
        }
      }
    });
    return true;
  } catch (e) {
    console.error('Erro ao puxar avisos/agenda:', e);
    return false;
  }
}

/** 5 — Campori (pouco usado no dia a dia). */
export async function puxarCampori(): Promise<boolean> {
  if (!(await temConexao())) return false;
  try {
    const [{ data: configCampori }, parcelasCampori, pagamentosCampori] = await Promise.all([
      supabase.from('config_campori').select('*').eq('id', 1).maybeSingle(),
      buscarTudo('parcelas_campori_config', '*', 'numero'),
      buscarTudo('pagamentos_campori', '*', 'dbv_id'),
    ]);

    await gravar(async (db) => {
      if (configCampori) {
        await db.runAsync(
          `INSERT OR REPLACE INTO config_campori (id, num_parcelas, data_vencimento_dia, updated_at)
           VALUES (?,?,?,?)`,
          [configCampori.id ?? 1, configCampori.num_parcelas ?? 4,
           configCampori.data_vencimento_dia ?? 10, configCampori.updated_at ?? null]
        );
      }

      if (parcelasCampori) {
        await db.runAsync('DELETE FROM parcelas_campori_config');
        for (const parcela of parcelasCampori) {
          await db.runAsync(
            `INSERT OR REPLACE INTO parcelas_campori_config (id, numero, valor, descricao)
             VALUES (?,?,?,?)`,
            [parcela.id, parcela.numero, parcela.valor, parcela.descricao ?? null]
          );
        }
      }

      if (pagamentosCampori) {
        await removerOrfaos(db, 'pagamentos_campori', pagamentosCampori);
        for (const pg of pagamentosCampori) {
          await db.runAsync(
            `INSERT OR REPLACE INTO pagamentos_campori
             (id, dbv_id, parcela_numero, valor_pago, data_pagamento, pago, observacao, updated_at, sincronizado)
             VALUES (?,?,?,?,?,?,?,?,1)`,
            [pg.id, pg.dbv_id, pg.parcela_numero, pg.valor_pago ?? 0,
             pg.data_pagamento ?? null, pg.pago ? 1 : 0, pg.observacao ?? null, pg.updated_at ?? null]
          );
        }
      }
    });
    return true;
  } catch (e) {
    console.error('Erro ao puxar campori:', e);
    return false;
  }
}

/**
 * 6 — Fichas e documentos dos membros. É o grupo mais pesado (uma linha por
 * membro em `documentos` e várias imagens por membro), por isso fica por
 * último: nenhuma tela principal depende dele para abrir.
 */
export async function puxarDocumentos(): Promise<boolean> {
  if (!(await temConexao())) return false;
  try {
    const [documentos, documentoImagens] = await Promise.all([
      buscarTudo('documentos'),
      buscarTudo('documento_imagens', '*', 'dbv_id'),
    ]);

    await gravar(async (db) => {
      if (documentos) {
        await removerOrfaos(db, 'documentos', documentos);
        for (const doc of documentos) {
          await db.runAsync(
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
        // O SERVIDOR MANDA. Antes só fazíamos INSERT OR REPLACE, o que deixava
        // dois problemas graves: (1) anexos apagados no servidor nunca sumiam
        // daqui, então uma foto removida "ressuscitava" ao reabrir o app; e
        // (2) a linha gravada localmente (id do autoincrement local) convivia
        // com a mesma linha vinda do servidor (id do servidor), duplicando o
        // anexo. Regravar a tabela inteira a partir do servidor resolve os dois.
        //
        // O que ainda está na fila de envio é preservado: são anexos que o
        // servidor ainda não conhece e sumiriam da tela até o próximo envio.
        const pendentes = await db.getAllAsync<{ dados: string }>(
          "SELECT dados FROM fila_sync WHERE tabela = 'documento_imagens' AND operacao = 'INSERT'"
        );
        await db.runAsync('DELETE FROM documento_imagens');
        for (const img of documentoImagens) {
          await db.runAsync(
            `INSERT OR REPLACE INTO documento_imagens (id, dbv_id, campo, url, created_at)
             VALUES (?,?,?,?,?)`,
            [img.id, img.dbv_id, img.campo, img.url, img.created_at ?? null]
          );
        }
        for (const pendente of pendentes) {
          try {
            const dados = JSON.parse(pendente.dados);
            const jaVeioDoServidor = documentoImagens.some(
              (img: any) => Number(img.dbv_id) === Number(dados.dbv_id)
                && img.campo === dados.campo && img.url === dados.url
            );
            if (jaVeioDoServidor) continue;
            await db.runAsync(
              'INSERT INTO documento_imagens (dbv_id, campo, url) VALUES (?,?,?)',
              [dados.dbv_id, dados.campo, dados.url]
            );
          } catch { /* linha da fila ilegível: ignora */ }
        }
      }
    });
    return true;
  } catch (e) {
    console.error('Erro ao puxar documentos:', e);
    return false;
  }
}

/**
 * Sincronização completa, na ordem de prioridade. Continua existindo para as
 * telas que pedem "atualizar tudo"; a carga inicial chama os grupos separados
 * para poder liberar o app assim que o essencial chegar.
 */
export async function puxarDeSupabase(): Promise<boolean> {
  if (!(await temConexao())) return false;
  const resultados = [
    await puxarMembros(),
    await puxarPontuacoes(),
    await puxarClassesEspecialidades(),
    await puxarComunicacao(),
    await puxarCampori(),
    await puxarDocumentos(),
  ];
  try {
    await puxarAtividades();
  } catch {
    return false;
  }
  return resultados.every(Boolean);
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
    const [atividades, planos, alvos, anexos, respostas] = await Promise.all([
      buscarTudo('atividades'),
      buscarTudo('planos_formativos'),
      buscarTudo('atividades_alvos'),
      buscarTudo('atividades_anexos'),
      buscarTudo('atividades_respostas'),
    ]);

    await db.withTransactionAsync(async () => {
      if (atividades) {
        await removerOrfaos(db, 'atividades', atividades);
        for (const a of atividades) {
          await db.runAsync(
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
        await removerOrfaos(db, 'planos_formativos', planos);
        for (const plano of planos) {
          await db.runAsync(
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
        await removerOrfaos(db, 'atividades_alvos', alvos, 'supabase_id');
        for (const alvo of alvos) {
          await db.runAsync(
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
        await removerOrfaos(db, 'atividades_anexos', anexos, 'supabase_id');
        for (const anexo of anexos) {
          await db.runAsync(
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
        await removerOrfaos(db, 'atividades_respostas', respostas, 'supabase_id');
        for (const resposta of respostas) {
          await db.runAsync(
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
  // Faltava aqui: o pagamento criado offline subia com o id do celular e podia
  // sobrescrever o pagamento de OUTRO membro que já ocupasse esse id lá.
  'pagamentos_campori',
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

/** Campos que nunca entram na comparação: mudam a cada gravação por natureza. */
const CAMPOS_IGNORADOS_NA_COMPARACAO = new Set(['id', 'updated_at', 'created_at', 'sincronizado']);

/**
 * Compara um valor local com o do servidor tolerando as diferenças de formato
 * entre SQLite e Postgres: booleano vira 1/0 no SQLite, número pode voltar como
 * texto, e vazio pode ser null ou string vazia.
 */
function equivalente(local: unknown, servidor: unknown): boolean {
  if (local === servidor) return true;

  const vazio = (v: unknown) => v === null || v === undefined || v === '';
  if (vazio(local) && vazio(servidor)) return true;

  if (typeof local === 'boolean' || typeof servidor === 'boolean') {
    const paraBool = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true';
    return paraBool(local) === paraBool(servidor);
  }

  const nLocal = Number(local);
  const nServidor = Number(servidor);
  if (!Number.isNaN(nLocal) && !Number.isNaN(nServidor) && local !== '' && servidor !== '') {
    return nLocal === nServidor;
  }

  return String(local).trim() === String(servidor).trim();
}

/**
 * Devolve só os campos que realmente mudaram em relação ao que já está no
 * servidor. Evita reescrever linha inteira à toa — e, quando nada difere,
 * o envio pode ser descartado.
 */
function camposDiferentes(
  local: Record<string, unknown>,
  servidor: Record<string, unknown>
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(local)) {
    if (CAMPOS_IGNORADOS_NA_COMPARACAO.has(campo)) continue;
    if (!(campo in servidor)) continue;
    if (!equivalente(valor, servidor[campo])) diff[campo] = valor;
  }
  return diff;
}

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
  const sincronia = useSincroniaStore.getState();
  if (!(await temConexao())) return { sucesso: false, motivo: 'sem_internet' };

  const db = await getDB();
  const fila = await db.getAllAsync<{
    id: string;
    tabela: string;
    operacao: string;
    dados: string;
  }>('SELECT * FROM fila_sync ORDER BY created_at ASC');

  if (fila.length === 0) return { sucesso: true, erros: [] };

  sincronia.marcarEnviando();
  const erros: string[] = [];
  let ignorados = 0;

  for (const op of fila) {
    try {
      const dados = JSON.parse(op.dados);

      // Antes de reescrever, confere o que o servidor já tem: se estiver tudo
      // igual, não há o que enviar; se algo mudou, manda só o que difere.
      if (op.operacao === 'UPDATE' && dados.id != null) {
        const { data: noServidor } = await supabase
          .from(op.tabela)
          .select('*')
          .eq('id', dados.id)
          .maybeSingle();
        if (noServidor) {
          const diff = camposDiferentes(dados, noServidor as Record<string, unknown>);
          if (Object.keys(diff).length === 0) {
            ignorados += 1;
            await db.runAsync('DELETE FROM fila_sync WHERE id = ?', [op.id]);
            continue;
          }
          const { error } = await supabase
            .from(op.tabela)
            .update({ ...diff, updated_at: new Date().toISOString() })
            .eq('id', dados.id);
          if (error) throw error;
          await db.runAsync('DELETE FROM fila_sync WHERE id = ?', [op.id]);
          continue;
        }
      }

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
        // Tabelas sem id reconciliado com o servidor (ex.: documento_imagens)
        // apagam pelos campos que identificam a linha, não pelo id local.
        if (dados.id != null) {
          await supabase.from(op.tabela).delete().eq('id', dados.id);
        } else {
          await supabase.from(op.tabela).delete().match(dados);
        }
      }
      await db.runAsync('DELETE FROM fila_sync WHERE id = ?', [op.id]);
    } catch (e) {
      erros.push(op.id);
    }
  }

  if (erros.length > 0) {
    sincronia.marcarErro();
  } else {
    sincronia.marcarConcluido(ignorados);
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
  const totalPendente = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) as total FROM fila_sync');
  useSincroniaStore.getState().marcarLocal(totalPendente?.total ?? 1);
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
