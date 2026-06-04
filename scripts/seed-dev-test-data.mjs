import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Informe EXPO_PUBLIC_SUPABASE_URL/SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SENHA_PADRAO = '123';
const PROJECT_REF = new URL(url).hostname.split('.')[0];

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function execSql(sql) {
  const pat = process.env.SUPABASE_PAT;
  if (!pat) throw new Error('SUPABASE_PAT é necessário para ajustar senha fraca em usuário existente.');
  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!resp.ok) {
    throw new Error(`Falha ao executar SQL administrativo: ${resp.status} ${await resp.text()}`);
  }
}

async function forcarSenhaDev(userId) {
  await execSql(`
    UPDATE auth.users
    SET encrypted_password = crypt(${sqlString(SENHA_PADRAO)}, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = ${sqlString(userId)};
  `);
}

const contas = [
  { email: 'admin@dev', nome: 'Sofia Dev Admin TI', perfil: 'admin_ti' },
  { email: 'sec@dev', nome: 'Helena Dev Secretaria', perfil: 'usuario_secretaria', cargo: 'Secretária', genero: 'F', idade: 34 },
  { email: 'con@dev', nome: 'Marcos Dev Conselheiro', perfil: 'usuario_conselheiro', cargo: 'Conselheiro', genero: 'M', idade: 37 },
  { email: 'dvb@dev', nome: 'Lucas Dev Desbravador', perfil: 'usuario_desbravador', cargo: 'Desbravador', genero: 'M', idade: 12 },
  { email: 'pai@dbv', nome: 'Rafael Dev Responsável', perfil: 'usuario_pais' },
];

const membrosDev = [
  { chave: 'sec@dev', nome: 'Helena Dev Secretaria', cargo: 'Secretária', unidade: 'Diretoria', genero: 'F', nascimento: '1992-04-10', email: 'sec@dev', camisa: 'M', calca: '40' },
  { chave: 'con@dev', nome: 'Marcos Dev Conselheiro', cargo: 'Conselheiro', unidade: 'Unidade Dev Alfa', genero: 'M', nascimento: '1989-08-22', email: 'con@dev', camisa: 'G', calca: '42' },
  { chave: 'dvb@dev', nome: 'Lucas Dev Desbravador', cargo: 'Desbravador', cargo_adicional: 'Capitão de unidade', unidade: 'Unidade Dev Alfa', genero: 'M', nascimento: '2014-02-11', email: 'dvb@dev', camisa: 'P', calca: '36', responsavel: 'Rafael Dev Responsável', contato_responsavel: '(21) 90000-0001' },
  { chave: 'ana-dev', nome: 'Ana Júlia Dev Lima', cargo: 'Desbravadora', unidade: 'Unidade Dev Alfa', genero: 'F', nascimento: '2013-09-03', email: 'ana.dev@teste.local', camisa: 'P', calca: '34', responsavel: 'Marta Dev Lima', contato_responsavel: '(21) 90000-0002' },
  { chave: 'pedro-dev', nome: 'Pedro Henrique Dev Souza', cargo: 'Desbravador', unidade: 'Unidade Dev Beta', genero: 'M', nascimento: '2012-12-18', email: 'pedro.dev@teste.local', camisa: 'M', calca: '38', responsavel: 'Clara Dev Souza', contato_responsavel: '(21) 90000-0003' },
  { chave: 'bia-dev', nome: 'Beatriz Dev Almeida', cargo: 'Desbravadora', unidade: 'Unidade Dev Beta', genero: 'F', nascimento: '2015-06-07', email: 'bia.dev@teste.local', camisa: 'PP', calca: '32', responsavel: 'Jonas Dev Almeida', contato_responsavel: '(21) 90000-0004' },
  { chave: 'dir-dev', nome: 'Daniel Dev Diretor', cargo: 'Diretor', unidade: 'Diretoria', genero: 'M', nascimento: '1985-01-25', email: 'diretor.dev@teste.local', camisa: 'G', calca: '44' },
];

const pontosBase = [
  { dias: -14, presenca: true, pontualidade: true, material: true, uniforme: true },
  { dias: -7, presenca: true, pontualidade: false, material: true, uniforme: true },
  { dias: 0, presenca: true, pontualidade: true, material: false, uniforme: true },
];

function isoDias(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function idadeEm(nascimento) {
  const hoje = new Date();
  const data = new Date(`${nascimento}T00:00:00`);
  let idade = hoje.getFullYear() - data.getFullYear();
  const m = hoje.getMonth() - data.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < data.getDate())) idade--;
  return idade;
}

function sigla(nome) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 5)
    .toUpperCase();
}

async function upsertAuthUser(conta) {
  const { data: lista, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const existente = lista.users.find((u) => u.email?.toLowerCase() === conta.email.toLowerCase());

  if (existente) {
    const { data, error } = await supabase.auth.admin.updateUserById(existente.id, {
      password: SENHA_PADRAO,
      email_confirm: true,
      user_metadata: { nome: conta.nome, perfil: conta.perfil },
    });
    if (error) {
      if (error.code !== 'weak_password') throw error;
      await forcarSenhaDev(existente.id);
      const { data: atualizado, error: metaError } = await supabase.auth.admin.updateUserById(existente.id, {
        user_metadata: { nome: conta.nome, perfil: conta.perfil },
      });
      if (metaError) throw metaError;
      return atualizado.user;
    }
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: conta.email,
    password: SENHA_PADRAO,
    email_confirm: true,
    user_metadata: { nome: conta.nome, perfil: conta.perfil },
  });
  if (error) throw error;
  await forcarSenhaDev(data.user.id);
  return data.user;
}

async function upsertByUnique(table, match, payload) {
  let query = supabase.from(table).select('*');
  for (const [key, value] of Object.entries(match)) {
    query = value === null || value === undefined ? query.is(key, null) : query.eq(key, value);
  }
  const { data: found, error: findError } = await query.maybeSingle();
  if (findError) throw findError;

  if (found?.id) {
    const { data, error } = await supabase.from(table).update(payload).eq('id', found.id).select('*').single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from(table).insert({ ...match, ...payload }).select('*').single();
  if (error) throw error;
  return data;
}

async function main() {
  const { data: clube, error: clubeError } = await supabase
    .from('clubes')
    .select('id, programa_id, nome')
    .ilike('nome', '%Fonseca%')
    .limit(1)
    .single();
  if (clubeError) throw clubeError;

  const clubeId = clube.id;
  const programaId = clube.programa_id;
  const usuarios = new Map();

  for (const conta of contas) {
    const user = await upsertAuthUser(conta);
    usuarios.set(conta.email, user);
  }

  const unidadesDesejadas = [
    { nome: 'Diretoria', cor: '#a855f7' },
    { nome: 'Unidade Dev Alfa', cor: '#0ea5e9' },
    { nome: 'Unidade Dev Beta', cor: '#f97316' },
  ];

  const unidades = new Map();
  for (const u of unidadesDesejadas) {
    const row = await upsertByUnique('unidades', { clube_id: clubeId, nome: u.nome }, {
      cor: u.cor,
      updated_at: new Date().toISOString(),
    });
    unidades.set(u.nome, row);
  }

  const membros = new Map();
  for (const m of membrosDev) {
    const unidade = unidades.get(m.unidade);
    const row = await upsertByUnique('desbravadores', { clube_id: clubeId, email: m.email }, {
      idx: 9000 + membros.size,
      id_sgc: `DEV-${m.chave}`,
      nome: m.nome,
      data_nascimento: m.nascimento,
      idade: idadeEm(m.nascimento),
      genero: m.genero,
      unidade_id: unidade?.id ?? null,
      unidade_nome: m.unidade,
      cargo: m.cargo,
      cargo_adicional: m.cargo_adicional ?? null,
      contato: '(21) 98888-0000',
      camisa: m.camisa,
      calca: m.calca,
      campori_dsa: false,
      nome_responsavel: m.responsavel ?? null,
      contato_responsavel: m.contato_responsavel ?? null,
      ativo: true,
      updated_at: new Date().toISOString(),
    });
    membros.set(m.chave, row);

    await upsertByUnique('documentos', { clube_id: clubeId, dbv_id: row.id }, {
      rg: 'NOK',
      cpf: 'NOK',
      ficha_saude: 'NOK',
      foto: 'NOK',
      updated_at: new Date().toISOString(),
    });
  }

  for (const conta of contas) {
    const user = usuarios.get(conta.email);
    const membro = membros.get(conta.email);
    const unidadeId = membro?.unidade_id ?? null;
    await supabase.from('usuarios').upsert({
      id: user.id,
      email: conta.email,
      nome: conta.nome,
      perfil: conta.perfil,
      unidade_id: unidadeId,
      dbv_id: membro?.id ?? null,
    });

    if (conta.perfil !== 'usuario_pais') {
      await upsertByUnique('usuario_clubes', {
        usuario_id: user.id,
        clube_id: clubeId,
        perfil: conta.perfil,
        membro_id: membro?.id ?? null,
        unidade_id: unidadeId,
      }, {
        ativo: true,
        updated_at: new Date().toISOString(),
      });
    }
  }

  const pai = usuarios.get('pai@dbv');
  const filho = membros.get('dvb@dev');
  await supabase.from('usuarios').upsert({
    id: pai.id,
    email: 'pai@dbv',
    nome: 'Rafael Dev Responsável',
    perfil: 'usuario_pais',
    unidade_id: filho.unidade_id,
    dbv_id: filho.id,
  });
  await upsertByUnique('responsavel_membros', {
    usuario_id: pai.id,
    membro_id: filho.id,
  }, {
    clube_id: clubeId,
    programa_id: programaId,
    parentesco: 'Pai',
    responsavel_principal: true,
    pode_visualizar: true,
    pode_visualizar_documentos: false,
    pode_enviar_documentos: true,
    pode_responder_atividades: true,
    ativo: true,
    updated_at: new Date().toISOString(),
  });

  const itensPontuacao = [
    { titulo: 'Presença', sigla: 'PR', valor: 25, ordem: 1, padrao: true },
    { titulo: 'Pontualidade', sigla: 'PO', valor: 100, ordem: 2, padrao: true },
    { titulo: 'Material', sigla: 'MA', valor: 25, ordem: 3, padrao: true },
    { titulo: 'Uniforme', sigla: 'UN', valor: 25, ordem: 4, padrao: true },
    { titulo: 'DEV Bíblia decorada', sigla: 'BD', valor: 40, ordem: 90, padrao: false },
    { titulo: 'DEV Serviço comunitário', sigla: 'SC', valor: 60, ordem: 91, padrao: false },
  ];

  const itens = new Map();
  for (const item of itensPontuacao) {
    const row = await upsertByUnique('pontuacao_itens', { clube_id: clubeId, titulo: item.titulo }, {
      programa_id: programaId,
      sigla: item.sigla || sigla(item.titulo),
      valor: item.valor,
      ativo: true,
      ordem: item.ordem,
      padrao: item.padrao,
      updated_at: new Date().toISOString(),
    });
    itens.set(item.titulo, row);
  }

  const membrosPontuaveis = [
    membros.get('dvb@dev'),
    membros.get('ana-dev'),
    membros.get('pedro-dev'),
    membros.get('bia-dev'),
    membros.get('con@dev'),
  ].filter(Boolean);

  for (let idx = 0; idx < membrosPontuaveis.length; idx++) {
    const membro = membrosPontuaveis[idx];
    for (const p of pontosBase) {
      const data = isoDias(p.dias);
      const presencaPts = p.presenca ? 25 : 0;
      const pontualidadePts = p.pontualidade ? 100 : 0;
      const materialPts = p.material ? 25 : 0;
      const uniformePts = p.uniforme ? 25 : 0;
      await upsertByUnique('pontuacoes', { clube_id: clubeId, dbv_id: membro.id, data }, {
        presenca: p.presenca,
        pontualidade: p.pontualidade,
        material: p.material,
        uniforme: p.uniforme,
        presenca_pts: presencaPts,
        pontualidade_pts: pontualidadePts,
        material_pts: materialPts,
        uniforme_pts: uniformePts,
        pontos_extras: idx * 10,
        observacao: `Seed dev ${data}`,
        lancado_por: 'seed-dev',
        updated_at: new Date().toISOString(),
      });
    }

    const customItem = idx % 2 === 0 ? itens.get('DEV Bíblia decorada') : itens.get('DEV Serviço comunitário');
    await upsertByUnique('pontuacoes_custom', {
      clube_id: clubeId,
      dbv_id: membro.id,
      data: isoDias(-3),
      item_id: customItem.id,
    }, {
      quantidade: 1,
      pontos: customItem.valor,
      item_nome: customItem.titulo,
      item_valor: customItem.valor,
      updated_at: new Date().toISOString(),
    });
  }

  await supabase.from('eventos').insert([
    {
      clube_id: clubeId,
      data: isoDias(2),
      horario: '09:00',
      local: 'IASD Dev',
      atividade: 'DEV Reunião de unidade',
      responsavel: 'Helena Dev Secretaria',
      observacoes: 'Evento de teste do ambiente de desenvolvimento',
      semestre: 1,
      updated_at: new Date().toISOString(),
    },
    {
      clube_id: clubeId,
      data: isoDias(9),
      horario: '08:30',
      local: 'Praça Dev',
      atividade: 'DEV Especialidade de natureza',
      responsavel: 'Marcos Dev Conselheiro',
      observacoes: 'Levar material de anotação',
      semestre: 1,
      updated_at: new Date().toISOString(),
    },
  ]);

  const resumo = {
    clube: clube.nome,
    usuarios: contas.map((c) => ({ email: c.email, perfil: c.perfil })),
    membros_dev: Array.from(membros.values()).map((m) => ({ id: m.id, nome: m.nome, unidade: m.unidade_nome, cargo: m.cargo })),
    unidades_dev: Array.from(unidades.values()).map((u) => ({ id: u.id, nome: u.nome })),
  };
  console.log(JSON.stringify(resumo, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
