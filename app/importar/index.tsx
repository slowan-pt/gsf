import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { BottomNav } from '../../src/components/BottomNav';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { Botao } from '../../src/components/ui';
import { getContextoAtivo } from '../../src/lib/contextoAtual';
import { invalidarCacheTelas } from '../../src/lib/cacheTela';
import { entregarXlsx, MIME_XLSX } from '../../src/lib/excelRelatorio';
import { carregarCargosModelo } from '../../src/lib/modelosPrograma';
import { usePermissoes } from '../../src/lib/permissoes';
import { clienteCadastroIsolado, supabase } from '../../src/lib/supabase';
import { buscarPaginado } from '../../src/lib/supabasePaginado';
import { registrarAuditoria } from '../../src/lib/auditoria';
import { avisar } from '../../src/stores/avisoStore';
import { useDBVStore } from '../../src/stores/dbvStore';
import { useCores } from '../../src/stores/temaStore';

const MODELOS = {
  membros: {
    aba: 'Dados e Membros', nome: 'modelo-dados-e-membros',
    cabecalho: ['Nome completo', 'ID (SGC)', 'Gênero', 'Data de nascimento', 'Cargo', 'Função adicional', 'Unidade', 'E-mail', 'Senha de login', 'Tipo de acesso', 'Telefone/WhatsApp', 'Tamanho da camisa', 'Tamanho da calça', 'Tipo sanguíneo', 'Fator Rh'],
  },
  agenda: {
    aba: 'Agenda', nome: 'modelo-agenda',
    cabecalho: ['Data', 'Horário', 'Local', 'Atividade', 'Responsável', 'Apoio', 'Material', 'Observações', 'Semestre'],
  },
} as const;

const PERFIS = {
  desbravador: 'usuario_desbravador', diretoria: 'usuario_diretoria', secretaria: 'usuario_secretaria',
  conselheiro: 'usuario_conselheiro', instrutor: 'usuario_instrutor', comunicacao: 'usuario_comunicacao', capelao: 'usuario_capelao',
  tesouraria: 'usuario_tesouraria', distrital: 'usuario_distrital', 'admin clube': 'admin_clube',
} as const;

const LINHAS_MODELO_AGENDA = 2000;

type Tipo = keyof typeof MODELOS;
type DadosMembro = {
  nome: string; id_sgc: string; genero?: string; data_nascimento?: string; idade?: number;
  cargo?: string; cargo_adicional?: string; unidade_id?: number | null; unidade_nome?: string;
  email?: string; contato?: string; camisa?: string; calca?: string; tipo_sanguineo?: string; fator_rh?: string;
};
type DadosEvento = {
  data: string; horario: string | null; local: string | null; atividade: string;
  responsavel: string | null; apoio: string | null; material: string | null; observacoes: string | null; semestre: number;
};
type LinhaMembro = { tipo: 'membros'; linha: number; dados: DadosMembro; id?: number; senha: string; perfil?: string };
type LinhaAgenda = { tipo: 'agenda'; linha: number; dados: DadosEvento };
type Plano = { tipo: Tipo; contextoId: string; clubeId: number; clube: string; arquivo: string; linhas: (LinhaMembro | LinhaAgenda)[]; erros: string[] };

const texto = (valor: unknown) => String(valor ?? '').trim();
const chave = (valor: unknown) => texto(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function dataISO(valor: unknown): string {
  const s = texto(valor);
  const serial = typeof valor === 'number' ? XLSX.SSF.parse_date_code(valor) : null;
  const partes = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = serial ? [serial.y, serial.m, serial.d].map((n, i) => String(n).padStart(i ? 2 : 4, '0')).join('-')
    : partes ? [partes[3], partes[2].padStart(2, '0'), partes[1].padStart(2, '0')].join('-') : s;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso) : null;
  if (!data || Number.isNaN(data.valueOf()) || data.toISOString().slice(0, 10) !== iso) {
    throw new Error('Informe uma data válida em DD/MM/AAAA ou AAAA-MM-DD.');
  }
  return iso;
}

function horarioTexto(valor: unknown) {
  if (typeof valor !== 'number') {
    const horario = texto(valor);
    if (!horario) return null;
    return /^([01]?\d|2[0-3]):[0-5]\d$/.test(horario) ? horario.padStart(5, '0') : horario;
  }
  if (valor < 0 || valor >= 1) throw new Error('Informe o horário no formato HH:MM.');
  const minutos = Math.floor(valor * 1440 + 0.000001);
  return [Math.floor(minutos / 60), minutos % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

function idadeEmAnos(data: string) {
  const hoje = new Date();
  const [ano, mes, dia] = data.split('-').map(Number);
  return hoje.getFullYear() - ano - (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia) ? 1 : 0);
}

async function baixarModelo(tipo: Tipo) {
  const modelo = MODELOS[tipo];
  const listas: Record<string, readonly string[]> = {};
  if (tipo === 'membros') {
    const contexto = getContextoAtivo();
    if (!contexto?.clube_id) throw new Error('Selecione o clube antes de baixar o modelo.');
    const cargos = await carregarCargosModelo();
    if (getContextoAtivo()?.id !== contexto.id) throw new Error('O clube mudou. Baixe o modelo novamente.');
    listas.C = ['Masculino', 'Feminino'];
    listas.E = cargos.flatMap((cargo) => [cargo.masc, cargo.fem]);
    listas.F = cargos.filter((cargo) => cargo.tipo !== 'membro').flatMap((cargo) => [cargo.masc, cargo.fem]);
    listas.J = ['Desbravador', 'Diretoria', 'Secretaria', 'Conselheiro', 'Instrutor', 'Comunicação', 'Capelão', 'Tesouraria', 'Distrital', 'Admin clube'];
    listas.L = ['PP', 'P', 'M', 'G', 'GG', 'XG'];
    listas.M = ['4', '6', '8', '10', '12', '14', ...listas.L];
    listas.N = ['A', 'B', 'AB', 'O'];
    listas.O = ['+', '-'];
  } else {
    const ano = new Date().getFullYear();
    const primeiroDia = Date.UTC(ano, 0, 1);
    const totalDias = (Date.UTC(ano + 2, 0, 1) - primeiroDia) / 86_400_000;
    listas.A = Array.from({ length: totalDias }, (_, dia) => new Date(primeiroDia + dia * 86_400_000).toISOString().slice(0, 10));
    listas.B = Array.from({ length: 96 }, (_, i) => horarioTexto(i / 96)!);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([Array.from(modelo.cabecalho)]);
  if (tipo === 'agenda') {
    for (let linha = 2; linha <= LINHAS_MODELO_AGENDA + 1; linha++) {
      const data = `A${linha}`;
      ws[`I${linha}`] = {
        t: 's', v: '',
        f: `IF(${data}="","",IF(IFERROR(MONTH(${data}),IF(MID(${data},5,1)="-",VALUE(MID(${data},6,2)),VALUE(MID(${data},FIND("/",${data})+1,FIND("/",${data},FIND("/",${data})+1)-FIND("/",${data})-1))))<=6,1,2))`,
      };
    }
    ws['!ref'] = `A1:I${LINHAS_MODELO_AGENDA + 1}`;
  }
  ws['!cols'] = modelo.cabecalho.map((titulo) => ({ wch: Math.max(18, titulo.length + 3) }));
  XLSX.utils.book_append_sheet(wb, ws, modelo.aba);

  const fonte = XLSX.utils.aoa_to_sheet([]);
  const nomes = [];
  const validacoes = [];
  for (const [coluna, valores] of Object.entries(listas)) {
    const opcoes = [...new Set(valores.map(texto).filter(Boolean))];
    if (!opcoes.length) continue;
    XLSX.utils.sheet_add_aoa(fonte, opcoes.map((opcao) => [opcao]), { origin: `${coluna}1` });
    const nome = `Opcoes_${coluna}`;
    nomes.push({ Name: nome, Ref: `'Opções'!$${coluna}$1:$${coluna}$${opcoes.length}` });
    validacoes.push(
      `<dataValidation type="list" errorStyle="stop" allowBlank="1" showErrorMessage="${tipo === 'membros' ? 1 : 0}" errorTitle="Valor inválido" error="Selecione uma opção da lista." sqref="${coluna}2:${coluna}1048576"><formula1>${nome}</formula1></dataValidation>`,
    );
  }
  XLSX.utils.book_append_sheet(wb, fonte, 'Opções');
  XLSX.utils.book_set_sheet_visibility(wb, 'Opções', 1);
  wb.Workbook = { ...wb.Workbook, Names: nomes };

  // O escritor XLSX não serializa listas de validação da planilha.
  const arquivos = unzipSync(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })));
  const caminho = 'xl/worksheets/sheet1.xml';
  const xml = strFromU8(arquivos[caminho]);
  // Neste modelo, ignoredErrors vem logo após sheetData. O Excel exige as validações antes de ignoredErrors.
  arquivos[caminho] = strToU8(xml.replace('</sheetData>',
    `</sheetData><dataValidations count="${validacoes.length}">${validacoes.join('')}</dataValidations>`,
  ));
  await entregarXlsx(zipSync(arquivos), modelo.nome);
}

async function lerArquivo(asset: DocumentPicker.DocumentPickerAsset, tipo: Tipo) {
  const wb = asset.file
    ? XLSX.read(await asset.file.arrayBuffer(), { type: 'array' })
    : XLSX.read(await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 }), { type: 'base64' });
  const modelo = MODELOS[tipo];
  const aba = wb.SheetNames.find((nome) => chave(nome) === chave(modelo.aba));
  if (!aba) throw new Error(`O arquivo precisa conter a aba “${modelo.aba}”. Use o modelo correspondente.`);
  const [cabecalho, ...linhas] = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[aba], { header: 1, defval: '' });
  const cabecalhoEsperado = tipo === 'membros' && cabecalho?.length === 13
    ? modelo.cabecalho.slice(0, 13) : modelo.cabecalho;
  if (!cabecalho || cabecalhoEsperado.some((titulo, i) => chave(cabecalho[i]) !== chave(titulo))) {
    throw new Error('O cabeçalho não corresponde ao modelo. Mantenha os nomes e a ordem das colunas.');
  }
  return linhas;
}

async function prepararMembros(linhas: unknown[][], plano: Plano, podeLogins: boolean) {
  const [membros, unidades] = await Promise.all([
    buscarPaginado<{ id: number; id_sgc: string | null; idade: number | null }>((q) => q.eq('clube_id', plano.clubeId), 'desbravadores', 'id,id_sgc,idade'),
    buscarPaginado<{ id: number; nome: string }>((q) => q.eq('clube_id', plano.clubeId), 'unidades', 'id,nome'),
  ]);
  const porSgc = new Map(membros.filter((m) => m.id_sgc).map((m) => [texto(m.id_sgc), m]));
  const porUnidade = new Map(unidades.map((u) => [chave(u.nome), u]));
  const usados = new Set<string>();
  const emails = new Set<string>();
  for (const [i, valores] of linhas.entries()) {
    if (!valores.some((v) => texto(v))) continue;
    const linha = i + 2;
    try {
      const [nome, id_sgc, genero, nascimento, cargo, funcao, unidade, emailEntrada, senhaEntrada, tipoAcessoEntrada, contato, camisa, calca, tipoEntrada = '', rhEntrada = ''] = valores.map(texto);
      const tipoSanguineo = tipoEntrada.toUpperCase();
      const rhNormalizado = chave(rhEntrada);
      const fatorRh = rhNormalizado === 'positivo' ? '+' : rhNormalizado === 'negativo' ? '-' : rhEntrada;
      if (tipoSanguineo && !['A', 'B', 'AB', 'O'].includes(tipoSanguineo)) throw new Error('Tipo sanguíneo inválido. Use A, B, AB ou O.');
      if (fatorRh && !['+', '-'].includes(fatorRh)) throw new Error('Fator Rh inválido. Use + ou -.');
      if (!id_sgc) throw new Error('Preencha o ID (SGC).');
      if (usados.has(id_sgc)) throw new Error('ID (SGC) repetido no arquivo.');
      usados.add(id_sgc);
      const membro = porSgc.get(id_sgc);
      if (!membro && !nome) throw new Error('Preencha Nome completo para cadastrar um novo membro.');
      const senha = membro ? '' : senhaEntrada;
      const tipoAcesso = membro ? '' : tipoAcessoEntrada;
      const data = nascimento ? dataISO(valores[3]) : undefined;
      const idade = data ? idadeEmAnos(data) : membro?.idade;
      if (idade != null && idade < 0) throw new Error('A data de nascimento está no futuro.');
      const generoChave = chave(genero);
      const generoNormalizado = ['m', 'masculino'].includes(generoChave) ? 'M'
        : ['f', 'feminino'].includes(generoChave) ? 'F' : undefined;
      if (genero && !generoNormalizado) throw new Error('Use Masculino (M) ou Feminino (F).');
      const unid = porUnidade.get(chave(unidade));
      if (unidade && !unid && chave(unidade) !== 'diretoria') throw new Error('Unidade não encontrada neste clube.');
      const email = emailEntrada.toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido.');
      const perfil = Object.entries(PERFIS).find(([rotulo]) => rotulo === chave(tipoAcesso))?.[1];
      if (tipoAcesso && !perfil) throw new Error('Tipo de acesso inválido. Use os nomes exibidos na ficha do membro.');
      if ((senha || perfil) && !podeLogins) throw new Error('Seu acesso não permite gerenciar logins.');
      if (senha && senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      if ((senha || perfil) && (!email || !senha || !perfil)) throw new Error('Para criar um login, preencha e-mail, senha e tipo de acesso.');
      if ((senha || perfil) && email && emails.has(email)) throw new Error('E-mail de login repetido na planilha.');
      if (perfil && idade != null && ((idade > 15) === (perfil === 'usuario_desbravador'))) {
        throw new Error('Tipo de acesso incompatível com a idade. Confira a ficha do membro.');
      }
      if (senha || perfil) emails.add(email);
      const dados: DadosMembro = {
        nome, id_sgc, ...(genero && { genero: generoNormalizado }),
        ...(data && { data_nascimento: data, idade: idadeEmAnos(data) }),
        ...(cargo && { cargo }), ...(funcao && { cargo_adicional: funcao }),
        ...(unidade && { unidade_nome: unid?.nome ?? 'Diretoria', unidade_id: unid?.id ?? null }),
        ...(email && { email }), ...(contato && { contato }), ...(camisa && { camisa }), ...(calca && { calca }),
        ...(tipoSanguineo && { tipo_sanguineo: tipoSanguineo }), ...(fatorRh && { fator_rh: fatorRh }),
      };
      plano.linhas.push({ tipo: 'membros', linha, dados, id: membro?.id, senha, perfil });
    } catch (e) {
      plano.erros.push(`Linha ${linha}: ${erroTexto(e)}`);
    }
  }
}

function prepararAgenda(linhas: unknown[][], plano: Plano) {
  for (const [i, valores] of linhas.entries()) {
    if (!valores.slice(0, 8).some((v) => texto(v))) continue;
    const linha = i + 2;
    try {
      const [data, horario, local, atividade, responsavel, apoio, material, obs] = valores;
      if (!texto(atividade)) throw new Error('Informe a atividade.');
      const dataEvento = dataISO(data);
      const periodo = Number(dataEvento.slice(5, 7)) <= 6 ? 1 : 2;
      plano.linhas.push({ tipo: 'agenda', linha, dados: {
        data: dataEvento, horario: horarioTexto(horario), local: texto(local) || null,
        atividade: texto(atividade), responsavel: texto(responsavel) || null, apoio: texto(apoio) || null,
        material: texto(material) || null, observacoes: texto(obs) || null, semestre: periodo,
      } });
    } catch (e) {
      plano.erros.push(`Linha ${linha}: ${erroTexto(e)}`);
    }
  }
}

function erroTexto(erro: unknown) {
  if (erro && typeof erro === 'object' && 'message' in erro) return String(erro.message);
  return 'Não foi possível processar este registro.';
}

async function salvarLogin(linha: LinhaMembro, dbvId: number, clubeId: number) {
  const { senha, perfil, dados } = linha;
  if (!senha && !perfil) return;
  if (!dados.email || !senha || !perfil) throw new Error('Dados de login incompletos.');
  const { data, error } = await clienteCadastroIsolado().auth.signUp({
    email: dados.email, password: senha,
    options: { data: { nome: dados.nome }, emailRedirectTo: 'dbvfonseca://auth/callback' },
  });
  if (error) throw error;
  if (!data.user?.id || !data.user.identities?.length) throw new Error('Esse e-mail já pode ter um login. Confira pela ficha.');
  const usuarioId = data.user.id;
  const { error: erroConta } = await supabase.from('usuarios').upsert({
    id: usuarioId, email: dados.email, nome: dados.nome, perfil, dbv_id: dbvId, unidade_id: dados.unidade_id ?? null,
  });
  if (erroConta) throw erroConta;
  const { error: erroVinculo } = await supabase.from('usuario_clubes').insert({
    usuario_id: usuarioId, clube_id: clubeId, membro_id: dbvId, perfil, unidade_id: dados.unidade_id ?? null, ativo: true,
  });
  if (erroVinculo) throw erroVinculo;
}

async function salvarLinha(linha: LinhaMembro, clubeId: number) {
  const tabela = supabase.from('desbravadores');
  if (linha.id !== undefined) {
    const { id_sgc, ...dados } = linha.dados;
    const campos = Object.keys(dados) as (keyof typeof dados)[];
    const { data: atual, error } = await tabela.select(campos.join(','))
      .eq('clube_id', clubeId).eq('id', linha.id).eq('id_sgc', id_sgc).single();
    if (error || !atual) throw new Error('O cadastro com este ID (SGC) mudou. Selecione o arquivo novamente.');

    const registro = atual as Partial<Record<keyof typeof dados, string | number | null>>;
    const vazio = (valor: unknown) => valor == null || (typeof valor === 'string' && !valor.trim());
    const grupos = [['data_nascimento', 'idade'], ['unidade_nome', 'unidade_id']] as const;
    const novos = campos.filter((campo) => {
      const grupo = grupos.find((itens) => itens.some((item) => item === campo));
      return !vazio(dados[campo]) && (grupo ?? [campo]).every((item) => vazio(registro[item]));
    });
    if (novos.length === 0) return;

    const complemento = Object.fromEntries(novos.map((campo) => [campo, dados[campo]]));
    let escrita = tabela.update(complemento).eq('clube_id', clubeId).eq('id', linha.id).eq('id_sgc', id_sgc);
    // Se outro salvamento preencher um campo entre a leitura e a escrita, a linha fica intacta.
    const conferidos = new Set(novos);
    for (const grupo of grupos) {
      if (grupo.some((campo) => conferidos.has(campo))) grupo.forEach((campo) => conferidos.add(campo));
    }
    for (const campo of conferidos) {
      const anterior = registro[campo];
      escrita = anterior == null ? escrita.is(campo, null) : escrita.eq(campo, anterior);
    }
    const { data: salvo, error: erroEscrita } = await escrita.select('id').maybeSingle();
    if (erroEscrita) throw erroEscrita;
    if (!salvo) throw new Error('O cadastro recebeu outra alteração durante a importação. Selecione o arquivo novamente.');
    return;
  }

  const result = await tabela.insert({ ...linha.dados, clube_id: clubeId }).select('id').single();
  if (result.error) throw result.error;
  const chaves = { clube_id: clubeId, dbv_id: result.data.id };
  const [{ error: erroDoc }, { error: erroClasse }] = await Promise.all([
    supabase.from('documentos').insert(chaves),
    supabase.from('progresso_classes').upsert(chaves, { onConflict: 'dbv_id', ignoreDuplicates: true }),
  ]);
  if (erroDoc || erroClasse) throw new Error('Membro salvo, mas houve falha na inicialização da ficha.');
  try {
    await salvarLogin(linha, result.data.id, clubeId);
  } catch {
    throw new Error('Membro salvo, mas o login não foi concluído. Confira o vínculo e as credenciais na ficha.');
  }
}

export default function ImportarScreen() {
  const cores = useCores();
  const permissoes = usePermissoes();
  const podeMembros = permissoes.pode('gerenciar_membros.importar');
  const podeAgenda = permissoes.pode('gerenciar_agenda.criar') && permissoes.pode('gerenciar_agenda.excluir');
  const podeLogins = permissoes.pode('gerenciar_acessos.logins');
  const carregarMembros = useDBVStore((s) => s.carregar);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ ok: number; erros: string[] } | null>(null);
  const permitido = (tipo: Tipo) => tipo === 'membros' ? podeMembros : podeAgenda;

  async function escolherArquivo(tipo: Tipo) {
    if (!permitido(tipo) || ocupado) return;
    const contexto = getContextoAtivo();
    if (!contexto?.clube_id) {
      avisar('Selecione o clube de destino antes de importar.', 'erro');
      return;
    }
    setOcupado(true);
    try {
      const escolha = await DocumentPicker.getDocumentAsync({ type: MIME_XLSX, copyToCacheDirectory: true });
      if (escolha.canceled) return;
      setPlano(null);
      setResultado(null);
      const asset = escolha.assets[0];
      const linhas = await lerArquivo(asset, tipo);
      const novo: Plano = { tipo, contextoId: contexto.id, clubeId: contexto.clube_id, clube: contexto.clube_nome, arquivo: asset.name, linhas: [], erros: [] };
      if (tipo === 'membros') {
        await prepararMembros(linhas, novo, podeLogins);
        setPlano(novo);
      } else {
        prepararAgenda(linhas, novo);
        if (novo.erros.length || !novo.linhas.length) {
          setResultado({ ok: 0, erros: novo.erros.length ? ['Nenhuma data foi substituída. Corrija o arquivo e importe novamente.', ...novo.erros] : ['O arquivo está sem eventos.'] });
          return;
        }
        if (getContextoAtivo()?.id !== novo.contextoId) throw new Error('O clube ou o perfil mudou. Selecione o arquivo novamente.');
        const eventos = novo.linhas.filter((linha): linha is LinhaAgenda => linha.tipo === 'agenda').map((linha) => linha.dados);
        const { data, error } = await supabase.rpc('substituir_agenda_datas', { p_clube_id: novo.clubeId, p_eventos: eventos });
        if (error) throw error;
        invalidarCacheTelas(`agenda:${novo.clubeId}:`);
        setResultado({ ok: Number(data), erros: [] });
        await registrarAuditoria({
          acao: 'importar_excel', entidade: 'eventos', clubeId: novo.clubeId,
          metadata: { arquivo: novo.arquivo, tipo, ok: Number(data), datas: new Set(eventos.map((evento) => evento.data)).size },
        });
      }
    } catch (e) {
      avisar(erroTexto(e), 'erro', 'Não foi possível importar o arquivo');
    } finally {
      setOcupado(false);
    }
  }

  async function importar() {
    if (!plano || ocupado || !permitido(plano.tipo)) return;
    if (getContextoAtivo()?.id !== plano.contextoId) {
      setPlano(null);
      avisar('O clube ou o perfil de acesso mudou. Selecione o arquivo novamente.', 'erro');
      return;
    }
    setOcupado(true);
    setPlano(null);
    const erros = [...plano.erros];
    let ok = 0;
    try {
      for (const linha of plano.linhas) {
        if (linha.tipo !== 'membros') continue;
        if (getContextoAtivo()?.id !== plano.contextoId) {
          erros.push('O contexto mudou. As linhas restantes não foram aplicadas.');
          break;
        }
        try {
          await salvarLinha(linha, plano.clubeId);
          ok++;
        } catch (e) {
          const mensagem = e instanceof Error ? e.message : 'Falha ao salvar. Confira se o ID (SGC) ou o e-mail já está em uso.';
          erros.push(`Linha ${linha.linha}: ${mensagem}`);
        }
      }
      await registrarAuditoria({
        acao: 'importar_excel', entidade: 'importacoes_lote', clubeId: plano.clubeId,
        metadata: { arquivo: plano.arquivo, tipo: plano.tipo, ok, erro: erros.length },
      });
      if (plano.tipo === 'membros' && getContextoAtivo()?.id === plano.contextoId) await carregarMembros();
    } catch {
      erros.push('Não foi possível atualizar a lista de membros. Confira os registros importados em Membros.');
    } finally {
      setResultado({ ok, erros });
      setOcupado(false);
    }
  }

  function baixar(tipo: Tipo) {
    void baixarModelo(tipo).catch((e) => avisar(erroTexto(e), 'erro', 'Não foi possível baixar o modelo'));
  }

  return (
    <View style={[s.container, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Importar do Excel" />
      <ScrollView contentContainerStyle={s.conteudo}>
        {(['baixar', 'importar'] as const).map((acao) => (
          <View key={acao} style={s.grade}>
            {(['membros', 'agenda'] as const).map((tipo) => {
              const download = acao === 'baixar';
              const desabilitado = !permitido(tipo) || ocupado;
              const cor = download ? cores.acento : '#4b284d';
              return (
                <TouchableOpacity
                  key={tipo}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: desabilitado }}
                  disabled={desabilitado}
                  style={[s.acao, { backgroundColor: download ? cores.acentoSuave : cores.secundaria }, desabilitado && { opacity: 0.55 }]}
                  onPress={() => download ? baixar(tipo) : escolherArquivo(tipo)}
                >
                  <Ionicons name={download ? 'download-outline' : 'cloud-upload-outline'} size={16} color={cor} />
                  <Text style={[s.acaoTexto, { color: cor }]}>
                    {download ? 'Baixar' : 'Importar'} modelo de planilha {MODELOS[tipo].aba}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        {podeMembros && <Text style={{ color: cores.textoSecundario }}>O ID (SGC) identifica o membro. Para cadastros existentes, a importação só preenche campos vazios e preserva o login.</Text>}
        {podeAgenda && <Text style={{ color: cores.textoSecundario }}>Ao selecionar um arquivo de Agenda válido, todos os eventos das datas da planilha são substituídos no clube selecionado.</Text>}
        {!podeMembros && !podeAgenda && <Text style={{ color: cores.textoSecundario }}>Seu perfil não tem permissão para importar planilhas.</Text>}
        {ocupado && <ActivityIndicator color={cores.primaria} />}
        {plano && (
          <View style={[s.cartao, { backgroundColor: cores.cartao }]}>
            <Text style={[s.titulo, { color: cores.texto }]}>{MODELOS[plano.tipo].aba} · {plano.clube}</Text>
            <Text style={{ color: cores.textoSecundario }}>{plano.arquivo} · {plano.linhas.length} linha(s) válida(s) · {plano.erros.length} com erro</Text>
            {plano.linhas.map((l) => (
              <Text key={l.linha} style={{ color: cores.texto }}>
                {l.linha} · {l.tipo === 'membros' ? `${l.id ? 'Complementar' : 'Cadastrar'} ${l.dados.nome || l.dados.id_sgc}` : `${l.dados.data} · ${l.dados.atividade}`}
              </Text>
            ))}
            {plano.erros.map((erro, i) => <Text key={i} style={{ color: cores.texto }}>{erro}</Text>)}
            <Botao rotulo="Confirmar importação" onPress={importar} desabilitado={ocupado || plano.linhas.length === 0} />
            <Botao rotulo="Cancelar" secundario onPress={() => setPlano(null)} />
          </View>
        )}
        {resultado && (
          <View style={[s.cartao, { backgroundColor: cores.cartao }]}>
            <Text style={[s.titulo, { color: cores.texto }]}>{resultado.ok} concluído(s) · {resultado.erros.length} erro(s)</Text>
            {resultado.erros.map((erro, i) => <Text key={i} style={{ color: cores.texto }}>{erro}</Text>)}
          </View>
        )}
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { padding: 16, gap: 16, paddingBottom: 40 },
  grade: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  acao: { flex: 1, minWidth: 0, minHeight: 48, padding: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  acaoTexto: { flexShrink: 1, fontWeight: '800', textAlign: 'center' },
  cartao: { padding: 16, borderRadius: 16, gap: 10 },
  titulo: { fontSize: 16, fontWeight: '800' },
});
