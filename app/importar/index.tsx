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
    cabecalho: ['Nome completo', 'ID (SGC)', 'Gênero', 'Data de nascimento', 'Cargo', 'Função adicional', 'Unidade', 'E-mail', 'Senha de login', 'Tipo de acesso', 'Telefone/WhatsApp', 'Tamanho da camisa', 'Tamanho da calça'],
  },
  agenda: {
    aba: 'Agenda', nome: 'modelo-agenda',
    cabecalho: ['Data', 'Horário', 'Local', 'Atividade', 'Responsável', 'Apoio', 'Material', 'Observações', 'Semestre'],
  },
} as const;

const PERFIS = {
  desbravador: 'usuario_desbravador', diretoria: 'usuario_diretoria', secretaria: 'usuario_secretaria',
  conselheiro: 'usuario_conselheiro', instrutor: 'usuario_instrutor', capelao: 'usuario_capelao',
  tesouraria: 'usuario_tesouraria', distrital: 'usuario_distrital', 'admin clube': 'admin_clube',
} as const;

// Ano exibido pelo calendário do clube.
const ANO_MODELO_AGENDA = 2026;
const LINHAS_MODELO_AGENDA = 2000;

type Tipo = keyof typeof MODELOS;
type DadosMembro = {
  nome: string; id_sgc: string; genero?: string; data_nascimento?: string; idade?: number;
  cargo?: string; cargo_adicional?: string; unidade_id?: number | null; unidade_nome?: string;
  email?: string; contato?: string; camisa?: string; calca?: string;
};
type DadosEvento = {
  data: string; horario: string | null; local: string | null; atividade: string;
  responsavel: string | null; apoio: string | null; material: string | null; observacoes: string | null; semestre: number;
};
type LinhaMembro = { tipo: 'membros'; linha: number; dados: DadosMembro; id?: number; senha: string; perfil?: string; login?: string };
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
    listas.J = ['Desbravador', 'Diretoria', 'Secretaria', 'Conselheiro', 'Instrutor', 'Capelão', 'Tesouraria', 'Distrital', 'Admin clube'];
    listas.L = ['PP', 'P', 'M', 'G', 'GG', 'XG'];
    listas.M = ['4', '6', '8', '10', '12', '14', ...listas.L];
  } else {
    const primeiroDia = Date.UTC(ANO_MODELO_AGENDA, 0, 1);
    const diasNoAno = (Date.UTC(ANO_MODELO_AGENDA + 1, 0, 1) - primeiroDia) / 86_400_000;
    listas.A = Array.from({ length: diasNoAno }, (_, dia) => new Date(primeiroDia + dia * 86_400_000).toISOString().slice(0, 10));
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
  if (!cabecalho || modelo.cabecalho.some((titulo, i) => chave(cabecalho[i]) !== chave(titulo))) {
    throw new Error('O cabeçalho não corresponde ao modelo. Mantenha os nomes e a ordem das colunas.');
  }
  return linhas;
}

async function prepararMembros(linhas: unknown[][], plano: Plano, podeLogins: boolean) {
  const [membros, unidades, vinculos] = await Promise.all([
    buscarPaginado<{ id: number; id_sgc: string | null; idade: number | null }>((q) => q.eq('clube_id', plano.clubeId), 'desbravadores', 'id,id_sgc,idade'),
    buscarPaginado<{ id: number; nome: string }>((q) => q.eq('clube_id', plano.clubeId), 'unidades', 'id,nome'),
    podeLogins ? buscarPaginado<{ membro_id: number; usuario_id: string; perfil: string }>(
      (q) => q.eq('clube_id', plano.clubeId).eq('ativo', true), 'usuario_clubes', 'membro_id,usuario_id,perfil'
    ) : [],
  ]);
  const porSgc = new Map(membros.filter((m) => m.id_sgc).map((m) => [texto(m.id_sgc), m]));
  const porUnidade = new Map(unidades.map((u) => [chave(u.nome), u]));
  const usados = new Set<string>();
  const emails = new Set<string>();
  for (const [i, valores] of linhas.entries()) {
    if (!valores.some((v) => texto(v))) continue;
    const linha = i + 2;
    try {
      const [nome, id_sgc, genero, nascimento, cargo, funcao, unidade, emailEntrada, senha, tipoAcesso, contato, camisa, calca] = valores.map(texto);
      if (!nome || !id_sgc) throw new Error('Preencha Nome completo e ID (SGC).');
      if (usados.has(id_sgc)) throw new Error('ID (SGC) repetido no arquivo.');
      usados.add(id_sgc);
      const membro = porSgc.get(id_sgc);
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
      const contas = membro ? vinculos.filter((v) => v.membro_id === membro.id) : [];
      if ((senha || perfil) && contas.length > 1) throw new Error('Há mais de um vínculo de login. Confira a ficha antes de importar.');
      const conta = contas[0];
      if (conta && (senha || perfil) && ['admin_ti', 'admin_total', 'admin_geral'].includes(conta.perfil)) {
        throw new Error('Gerencie essa conta administrativa pela ficha do membro.');
      }
      if ((senha || perfil) && !conta && (!email || !senha || !perfil)) throw new Error('Para criar um login, preencha e-mail, senha e tipo de acesso.');
      if ((senha || perfil) && email && emails.has(email)) throw new Error('E-mail de login repetido na planilha.');
      const perfilEfetivo = perfil ?? conta?.perfil;
      if (perfilEfetivo && idade != null && ((idade > 15) === (perfilEfetivo === 'usuario_desbravador'))) {
        throw new Error('Tipo de acesso incompatível com a idade. Confira a ficha do membro.');
      }
      if (senha || perfil) emails.add(email);
      const dados: DadosMembro = {
        nome, id_sgc, ...(genero && { genero: generoNormalizado }),
        ...(data && { data_nascimento: data, idade: idadeEmAnos(data) }),
        ...(cargo && { cargo }), ...(funcao && { cargo_adicional: funcao }),
        ...(unidade && { unidade_nome: unid?.nome ?? 'Diretoria', unidade_id: unid?.id ?? null }),
        ...(email && { email }), ...(contato && { contato }), ...(camisa && { camisa }), ...(calca && { calca }),
      };
      plano.linhas.push({ tipo: 'membros', linha, dados, id: membro?.id, senha, perfil, login: conta?.usuario_id });
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
  const { login, senha, perfil, dados } = linha;
  if (!senha && !perfil) return;
  if (login) {
    const { data: vinculo, error: erroConsulta } = await supabase.from('usuario_clubes').select('id,perfil')
      .eq('clube_id', clubeId).eq('membro_id', dbvId).eq('usuario_id', login).eq('ativo', true).single();
    if (erroConsulta || !vinculo || ['admin_ti', 'admin_total', 'admin_geral'].includes(vinculo.perfil)) {
      throw new Error('O vínculo do login mudou. Confira a ficha.');
    }
    if (senha || dados.email) {
      const { error } = await supabase.rpc('atualizar_login_membro', {
        target_user_id: login, novo_email: dados.email ?? null, nova_senha: senha || null,
      });
      if (error) throw error;
    }
    if (perfil) {
      const unidade = dados.unidade_id === undefined ? {} : { unidade_id: dados.unidade_id };
      const { error: erroVinculo } = await supabase.from('usuario_clubes').update({ perfil, ...unidade })
        .eq('id', vinculo.id).eq('clube_id', clubeId).eq('membro_id', dbvId).eq('usuario_id', login)
        .eq('perfil', vinculo.perfil).eq('ativo', true).select('id').single();
      if (erroVinculo) throw erroVinculo;
    }
    return;
  }
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

async function salvarLinha(linha: LinhaMembro | LinhaAgenda, clubeId: number) {
  if (linha.tipo === 'agenda') {
    const { error } = await supabase.from('eventos').insert({ ...linha.dados, clube_id: clubeId });
    if (error) throw error;
    return;
  }
  const tabela = supabase.from('desbravadores');
  const result = linha.id
    ? await tabela.update(linha.dados).eq('clube_id', clubeId).eq('id', linha.id).eq('id_sgc', linha.dados.id_sgc).select('id').single()
    : await tabela.insert({ ...linha.dados, clube_id: clubeId }).select('id').single();
  if (result.error) throw result.error;
  if (!linha.id) {
    const chaves = { clube_id: clubeId, dbv_id: result.data.id };
    const [{ error: erroDoc }, { error: erroClasse }] = await Promise.all([
      supabase.from('documentos').insert(chaves),
      supabase.from('progresso_classes').upsert(chaves, { onConflict: 'dbv_id', ignoreDuplicates: true }),
    ]);
    if (erroDoc || erroClasse) throw new Error('Membro salvo, mas houve falha na inicialização da ficha.');
  }
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
  const podeAgenda = permissoes.pode('gerenciar_agenda');
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
      if (tipo === 'membros') await prepararMembros(linhas, novo, podeLogins);
      else prepararAgenda(linhas, novo);
      setPlano(novo);
    } catch (e) {
      avisar(erroTexto(e), 'erro', 'Não foi possível ler o arquivo');
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
        {podeMembros && <Text style={{ color: cores.textoSecundario }}>Use o ID (SGC) para identificar o membro. Deixe a senha em branco para manter a atual.</Text>}
        {!podeMembros && !podeAgenda && <Text style={{ color: cores.textoSecundario }}>Seu perfil não tem permissão para importar planilhas.</Text>}
        {ocupado && <ActivityIndicator color={cores.primaria} />}
        {plano && (
          <View style={[s.cartao, { backgroundColor: cores.cartao }]}>
            <Text style={[s.titulo, { color: cores.texto }]}>{MODELOS[plano.tipo].aba} · {plano.clube}</Text>
            <Text style={{ color: cores.textoSecundario }}>{plano.arquivo} · {plano.linhas.length} linha(s) válida(s) · {plano.erros.length} com erro</Text>
            {plano.linhas.map((l) => (
              <Text key={l.linha} style={{ color: cores.texto }}>
                {l.linha} · {l.tipo === 'membros' ? `${l.id ? 'Atualizar' : 'Cadastrar'} ${l.dados.nome}` : `${l.dados.data} · ${l.dados.atividade}`}
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
