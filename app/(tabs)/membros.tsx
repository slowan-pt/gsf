import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, Pressable,
  Platform, KeyboardAvoidingView, ActivityIndicator, Image,
  ActionSheetIOS,
} from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useDBVStore } from '../../src/stores/dbvStore';
import { useAuthStore } from '../../src/stores/authStore';
import { getDB } from '../../src/lib/database';
import { supabase } from '../../src/lib/supabase';
import { adicionarFilaSync, sincronizarTudo } from '../../src/lib/sync';
import { uriParaUploadBodies } from '../../src/lib/storageUpload';
import { DateField } from '../../src/components/DateField';
import { getClubeAtivoId, getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { useRealtime } from '../../src/lib/realtime';
import { carregarCargosModelo, cargosFallback, type CargoModelo } from '../../src/lib/modelosPrograma';
import { avatarCor, AvatarBadge, type BadgeFoto } from '../../src/components/common/Avatar';
import { carregarBadgesResponsaveis } from '../../src/lib/responsaveis';
import { EmailInput } from '../../src/components/EmailInput';
import type { Desbravador, Documento, Perfil } from '../../src/types';
import { combinaBusca } from '../../src/lib/texto';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';

async function uploadFotoMembro(dbv_id: number, uri: string): Promise<string> {
  try {
    const [body] = await uriParaUploadBodies(uri, 'image/jpeg');
    const path = `${dbv_id}/perfil_${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('fotos_membros')
      .upload(path, body as any, { upsert: false, contentType: 'image/jpeg' });
    if (error) throw error;
    if (!data?.path) throw new Error('O servidor nao retornou o caminho da foto.');
    const { data: urlData } = supabase.storage.from('fotos_membros').getPublicUrl(data.path);
    if (!urlData.publicUrl) throw new Error('O servidor nao retornou a URL da foto.');
    return urlData.publicUrl;
  } catch (e) {
    console.error('Erro ao subir foto de membro', e);
    const mensagem = e && typeof e === 'object' && 'message' in e
      ? String((e as { message?: unknown }).message ?? '')
      : '';
    throw new Error(mensagem || 'Nao foi possivel fazer o upload da foto.');
  }
}

async function vincularFotoAoDocumento(dbv_id: number, url: string) {
  const clubeId = getClubeAtivoId();
  if (Platform.OS === 'web') {
    const { error: delError } = await supabase.from('documento_imagens').delete().eq('clube_id', clubeId).eq('dbv_id', dbv_id).eq('campo', 'foto');
    if (delError) throw delError;
    const { error: insertError } = await supabase.from('documento_imagens').insert({
      clube_id: clubeId,
      dbv_id,
      campo: 'foto',
      url,
      nome: 'Foto 3x4',
      tipo: 'image',
    });
    if (insertError) throw insertError;
    await supabase
      .from('documento_status')
      .upsert(
        { clube_id: clubeId, dbv_id, campo: 'foto', status: 'OK', updated_at: new Date().toISOString() },
        { onConflict: 'dbv_id,campo' },
      );
    const { data: docExistente } = await supabase
      .from('documentos')
      .select('id')
      .eq('clube_id', clubeId)
      .eq('dbv_id', dbv_id)
      .maybeSingle();
    if (docExistente?.id) {
      await supabase
        .from('documentos')
        .update({ foto: 'OK', updated_at: new Date().toISOString() })
        .eq('id', docExistente.id);
    } else {
      await supabase
        .from('documentos')
        .insert({ clube_id: clubeId, dbv_id, foto: 'OK', updated_at: new Date().toISOString() });
    }
    return;
  }

  const db = await getDB();
  await db.runAsync('DELETE FROM documento_imagens WHERE dbv_id = ? AND campo = ?', [dbv_id, 'foto']);
  await db.runAsync(
    'INSERT INTO documento_imagens (clube_id, dbv_id, campo, url, nome, tipo) VALUES (?, ?, ?, ?, ?, ?)',
    [clubeId, dbv_id, 'foto', url, 'Foto 3x4', 'image'],
  );
  await adicionarFilaSync('documento_imagens', 'DELETE', {
    clube_id: clubeId,
    dbv_id,
    campo: 'foto',
    deleteAll: true,
  });
  await adicionarFilaSync('documento_imagens', 'INSERT', {
    clube_id: clubeId,
    dbv_id,
    campo: 'foto',
    url,
    nome: 'Foto 3x4',
    tipo: 'image',
  });
  await adicionarFilaSync('documento_status', 'INSERT', {
    clube_id: clubeId,
    dbv_id,
    campo: 'foto',
    status: 'OK',
    updated_at: new Date().toISOString(),
  });
  await db.runAsync('UPDATE documentos SET foto = ? WHERE dbv_id = ?', ['OK', dbv_id]);
  const doc = await db.getFirstAsync<{ id: number }>('SELECT id FROM documentos WHERE dbv_id = ?', [dbv_id]);
  if (!doc) await db.runAsync('INSERT INTO documentos (dbv_id, foto) VALUES (?, ?)', [dbv_id, 'OK']);
}

/* ─── Cargos com variação de gênero ──────────────────────────── */
const CARGOS = cargosFallback();

function cargoLabel(c: CargoModelo, genero: string) {
  return genero === 'F' ? c.fem : c.masc;
}

/** Quando o gênero muda, converte o cargo armazenado para a variante correta. */
function adaptarCargo(cargo: string, paraGenero: string, cargos = CARGOS): string {
  const c = cargos.find((x) => x.masc === cargo || x.fem === cargo);
  if (!c) return cargo;
  return paraGenero === 'F' ? c.fem : c.masc;
}

function cargoParaFormulario(cargo: string | null | undefined, genero: string, cargos = CARGOS) {
  const c = String(cargo ?? '').trim();
  const normalizado = normalizarCargo(c);
  const mapa: Record<string, Pick<CargoModelo, 'masc' | 'fem'>> = {
    dbv: { masc: 'Desbravador', fem: 'Desbravadora' },
    desbravador: { masc: 'Desbravador', fem: 'Desbravadora' },
    desbravadora: { masc: 'Desbravador', fem: 'Desbravadora' },
    diretoria: { masc: 'Diretoria', fem: 'Diretoria' },
    dir: { masc: 'Diretoria', fem: 'Diretoria' },
    sec: { masc: 'Secretaria do Clube', fem: 'Secretaria do Clube' },
    secretaria: { masc: 'Secretaria do Clube', fem: 'Secretaria do Clube' },
    'secretaria do clube': { masc: 'Secretaria do Clube', fem: 'Secretaria do Clube' },
    capelania: { masc: 'Capelania', fem: 'Capelania' },
    tes: { masc: 'Tesouraria', fem: 'Tesouraria' },
    tesouraria: { masc: 'Tesouraria', fem: 'Tesouraria' },
    con: { masc: 'Conselheiro', fem: 'Conselheira' },
    conselheiro: { masc: 'Conselheiro', fem: 'Conselheira' },
    conselheira: { masc: 'Conselheiro', fem: 'Conselheira' },
    cap: { masc: 'Capitão', fem: 'Capitã' },
    capitao: { masc: 'Capitão', fem: 'Capitã' },
    capita: { masc: 'Capitão', fem: 'Capitã' },
    'secretaria da unidade': { masc: 'Secretaria da Unidade', fem: 'Secretaria da Unidade' },
  };
  const achado = cargos.find((x) => normalizarCargo(x.masc) === normalizado || normalizarCargo(x.fem) === normalizado) ?? mapa[normalizado];
  if (!achado) return c;
  return genero === 'F' ? achado.fem : achado.masc;
}

function idadePorNascimento(data?: string | null) {
  if (!data || data.length < 10) return null;
  const nasc = new Date(`${data.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const mes = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

function normalizarCargo(cargo: string) {
  return cargo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function cargoAbrev(cargo?: string | null) {
  const c = normalizarCargo(String(cargo ?? ''));
  if (!c) return '';
  if (['dbv', 'desbravador', 'desbravadora'].includes(c)) return 'DBV';
  if (['avt', 'aventureiro', 'aventureira'].includes(c)) return 'AVT';
  if (['diretoria', 'diretor', 'diretora', 'dir'].includes(c)) return 'DIR';
  if (c.includes('associad')) return 'DAS';
  if (c.includes('secretaria do clube') || c === 'secretario' || c === 'secretaria' || c === 'sec') return 'SEC';
  if (c.includes('secretaria da unidade')) return 'SUN';
  if (c.includes('capel')) return 'CAP';
  if (c.includes('tesour')) return 'TES';
  if (c.includes('conselh') || c === 'con') return 'CON';
  if (c.includes('capitao') || c.includes('capita')) return 'CPT';
  if (c.includes('comunic')) return 'COM';
  if (c.includes('instrutor') && c.includes('especial')) return 'IES';
  if (c.includes('instrutor') && c.includes('classe')) return 'ICL';
  if (c.includes('instrutor')) return 'INS';
  return c.slice(0, 3).toUpperCase();
}

/** Label legível para exibição no card — retorna null para cargos genéricos (DBV/AVT). */
function cargoTagLabel(cargo?: string | null): string | null {
  const c = normalizarCargo(String(cargo ?? ''));
  if (!c) return null;
  if (['dbv', 'desbravador', 'desbravadora', 'avt', 'aventureiro', 'aventureira'].includes(c)) return null;
  if (c.includes('capitao') || c.includes('capita')) return 'Capitão/ã';
  if (c.includes('secretaria da unidade')) return 'Sec. Unidade';
  if (c.includes('secretaria do clube') || c === 'secretario' || c === 'secretaria' || c === 'sec') return 'Secretário/a';
  if (c.includes('conselh') || c === 'con') return 'Conselheiro/a';
  if (c.includes('tesour')) return 'Tesoureiro/a';
  if (c.includes('capel')) return 'Capelão/ã';
  if (['diretoria', 'diretor', 'diretora', 'dir'].includes(c)) return 'Diretoria';
  if (c.includes('associad')) return 'Dir. Associado/a';
  if (c.includes('comunic')) return 'Comunicação';
  if (c.includes('instrutor') && c.includes('especial')) return 'Instr. Especialidade';
  if (c.includes('instrutor') && c.includes('classe')) return 'Instr. Classe';
  if (c.includes('instrutor')) return 'Instrutor/a';
  return cargo ?? null;
}

function cargoInfo(cargo: string, cargos = CARGOS) {
  const c = normalizarCargo(cargo);
  return cargos.find((x) => normalizarCargo(x.masc) === c || normalizarCargo(x.fem) === c);
}

function cargoForcaDesbravador(cargo: string, cargos = CARGOS) {
  const info = cargoInfo(cargo, cargos);
  if (info?.perfil_sugerido === 'usuario_desbravador' || info?.perfil_sugerido === 'usuario_aventureiro') return true;
  const c = normalizarCargo(cargo);
  return c === 'desbravador' || c === 'desbravadora' || c === 'aventureiro' || c === 'aventureira' || c === 'capitao' || c === 'capita' || c === 'secretaria da unidade';
}

function cargoAdulto(cargo: string, cargos = CARGOS) {
  const info = cargoInfo(cargo, cargos);
  if (info?.idade_minima && info.idade_minima >= 16) return true;
  const c = normalizarCargo(cargo);
  return c === 'diretoria' || c === 'secretaria do clube' || c === 'capelania' ||
         c === 'tesouraria' || c === 'conselheiro' || c === 'conselheira';
}

function cargoJuvenil(cargo: string, cargos = CARGOS) {
  return cargoForcaDesbravador(cargo, cargos);
}

function ehFuncaoJuvenil(cargo: string) {
  const c = normalizarCargo(cargo);
  return c.includes('capitao') || c.includes('capita') || c.includes('secretari') && c.includes('unidade');
}

function cargoBloqueadoPorIdade(cargo: string, idade: number | null, cargos = CARGOS) {
  if (idade === null) return false;
  const info = cargoInfo(cargo, cargos);
  if (info?.idade_minima !== null && info?.idade_minima !== undefined && idade < info.idade_minima) return true;
  if (info?.idade_maxima !== null && info?.idade_maxima !== undefined && idade > info.idade_maxima) return true;
  if (idade <= 15) return cargoAdulto(cargo, cargos);
  return cargoJuvenil(cargo, cargos);
}

function perfilPadraoMembro(): PerfilLogin {
  return getProgramaAtivoId() === 2 ? 'usuario_aventureiro' : 'usuario_desbravador';
}

function perfilAdulto(perfil: PerfilLogin) {
  return perfil !== 'usuario_desbravador' && perfil !== 'usuario_aventureiro';
}

function perfilBloqueadoPorIdade(perfil: PerfilLogin, idade: number | null, perfilUsuario?: string) {
  if (perfil === 'admin_ti' && perfilUsuario !== 'admin_ti') return true;
  if (idade === null) return false;
  if (idade <= 15) return perfilAdulto(perfil);
  return !perfilAdulto(perfil);
}

function ajustarPerfilPorIdade(perfil: PerfilLogin, idade: number | null): PerfilLogin {
  if (idade === null) return perfil;
  if (idade <= 15) return perfilPadraoMembro();
  return perfilAdulto(perfil) ? perfil : 'usuario_diretoria';
}

function ajustarCargoPorIdade(cargo: string, idade: number | null, cargos = CARGOS) {
  return cargoBloqueadoPorIdade(cargo, idade, cargos) ? '' : cargo;
}

/* ─── Campos do formulário ────────────────────────────────────── */
interface FormDBV {
  nome: string; genero: string; data_nascimento: string; cargo: string; cargo_adicional: string;
  unidade_id: string; unidade_nome: string; email: string; contato: string;
  camisa: string; calca: string; nome_responsavel: string; contato_responsavel: string;
  foto_url: string; senha: string; perfil_login: PerfilLogin; login_user_id: string;
}

const FORM_VAZIO: FormDBV = {
  nome: '', genero: 'M', data_nascimento: '', cargo: 'Desbravador', cargo_adicional: '', unidade_id: '',
  unidade_nome: '', email: '', contato: '', camisa: '', calca: '', nome_responsavel: '', contato_responsavel: '',
  foto_url: '', senha: '', perfil_login: 'usuario_desbravador', login_user_id: '',
};

type PerfilLogin = Perfil;
const PERFIS_LOGIN: Array<{ valor: PerfilLogin; label: string; desc: string }> = [
  { valor: 'usuario_desbravador', label: 'Desbravador', desc: 'Acesso próprio DBV' },
  { valor: 'usuario_aventureiro', label: 'Aventureiro', desc: 'Acesso próprio AVT' },
  { valor: 'usuario_diretoria', label: 'Diretoria', desc: 'Operação do clube' },
  { valor: 'usuario_secretaria', label: 'Secretaria', desc: 'Membros e documentos' },
  { valor: 'usuario_tesouraria', label: 'Tesouraria', desc: 'Financeiro' },
  { valor: 'usuario_conselheiro', label: 'Conselheiro', desc: 'Unidade vinculada' },
  { valor: 'usuario_instrutor', label: 'Instrutor', desc: 'Acompanha como o conselheiro, edita só a própria ficha' },
  { valor: 'usuario_pastor', label: 'Pastor', desc: 'Acompanhamento pastoral' },
  { valor: 'usuario_capelao', label: 'Capelão', desc: 'Capelania' },
  { valor: 'usuario_distrital', label: 'Distrital', desc: 'Relatórios e unidade' },
  { valor: 'usuario_regional', label: 'Regional', desc: 'Valida classes dos clubes da região' },
  { valor: 'admin_clube', label: 'Admin clube', desc: 'Controle total do clube' },
  { valor: 'admin_ti', label: 'Admin TI', desc: 'Controle da plataforma' },
];

function normalizarPerfilLogin(perfil?: string | null): PerfilLogin | null {
  if (!perfil) return null;
  if (perfil === 'admin_total') return 'admin_ti';
  if (perfil === 'admin_geral') return 'admin_clube';
  if (perfil === 'admin_diretoria') return 'usuario_diretoria';
  if (perfil === 'desbravador') return perfilPadraoMembro();
  if (PERFIS_LOGIN.some((p) => p.valor === perfil)) return perfil as PerfilLogin;
  return null;
}

function perfilParaSalvar(perfil: PerfilLogin) {
  return normalizarPerfilLogin(perfil) ?? perfilPadraoMembro();
}

interface UnidadeDB { id: number; nome: string; cor: string; }
interface DocStat { entregues: number; pendentes: number; anexos: number; }
const UNIDADES_PADRAO: UnidadeDB[] = [
  { id: 1, nome: 'Amor Perfeito', cor: '#e91e63' },
  { id: 2, nome: 'Sempre Viva', cor: '#4caf50' },
  { id: 3, nome: 'Águia Dourada', cor: '#ff9800' },
  { id: 4, nome: 'Leões', cor: '#2196f3' },
];

export default function MembrosScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const usuario  = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const permissoes = usePermissoes();
  const { desbravadores, carregar, criarDesbravador, editarDesbravador, excluirDesbravador, inativarDesbravador, atualizarFoto } = useDBVStore();
  const [busca, setBusca]       = useState('');
  const [filtroUn, setFiltroUn] = useState('Todas');
  const [unidades, setUnidades] = useState<UnidadeDB[]>([]);
  const [cargosModelo, setCargosModelo] = useState<CargoModelo[]>(CARGOS);
  const [docStats, setDocStats] = useState<Record<number, DocStat>>({});
  const [verInativos, setVerInativos] = useState(false);
  const [badgesResp, setBadgesResp] = useState<Map<number, BadgeFoto[]>>(new Map());

  // Modal CRUD
  const [modal, setModal]     = useState(false);
  const [editId, setEditId]   = useState<number | null>(null);
  const [form, setForm]       = useState<FormDBV>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [upFoto,   setUpFoto]  = useState(false);
  const [fotoMenuVisivel, setFotoMenuVisivel] = useState(false);
  const [mfaConfirmando, setMfaConfirmando] = useState(false);
  const [mfaMensagem, setMfaMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [perfilAberto, setPerfilAberto] = useState(false);

  const isAdmin = permissoes.pode('gerenciar_membros');
  const podeGerenciarAcessoTotal = permissoes.pode('gerenciar_acessos');
  const meuCadastro = desbravadores.find((d) => d.id === usuario?.dbv_id);
  const isConselheiro = normalizarCargo(meuCadastro?.cargo ?? '').includes('conselheiro') || normalizarCargo(meuCadastro?.cargo ?? '') === 'con';
  const nascimentoDefault = new Date();
  nascimentoDefault.setFullYear(nascimentoDefault.getFullYear() - 10);
  const nascimentoMin = new Date(1950, 0, 1);
  const idadeForm = idadePorNascimento(form.data_nascimento);
  const perfilTravadoComoDesbravador = idadeForm !== null && idadeForm <= 15;
  const perfilAdultoObrigatorio = idadeForm !== null && idadeForm > 15;

  useFocusEffect(useCallback(() => {
    let ativo = true;
    async function init() {
      const cargos = await carregarCargosModelo();
      if (ativo) setCargosModelo(cargos);
      await carregarUnidades();
      if (ativo) {
        await carregar(verInativos);
        await carregarDocStats();
        const menores = useDBVStore.getState().desbravadores.filter((d) => d.idade < 16).map((d) => d.id);
        const badges = await carregarBadgesResponsaveis(menores);
        if (ativo) setBadgesResp(badges);
      }
    }
    init();
    return () => { ativo = false; };
  }, []));

  // Atualiza a lista sozinha quando alguém cadastra/edita um membro em outro
  // aparelho — desde que não haja um cadastro aberto em edição na tela.
  useRealtime(
    ['desbravadores', 'documento_status'],
    () => {
      carregar(verInativos);
      carregarDocStats();
    },
    !modal
  );

  async function carregarDocStats() {
    const campos = ['rg','cpf','rg_resp','cartao_sus','cartao_plano','ficha_saude','carteira_vacinacao','laudo_medico','ficha_reg','comp_residencia','aut_saida','aut_viagem','ri_assinado','foto','ant_criminais'];
    const stats: Record<number, DocStat> = {};

    if (Platform.OS === 'web') {
      const clubeId = getClubeAtivoId();
      const [{ data: docs }, { data: imgs }] = await Promise.all([
        supabase.from('documentos').select('*').eq('clube_id', clubeId),
        supabase.from('documento_imagens').select('dbv_id,campo').eq('clube_id', clubeId),
      ]);
      const anexosPorMembro = new Map<number, Set<string>>();
      for (const img of (imgs ?? []) as Array<{ dbv_id: number; campo: string }>) {
        if (!anexosPorMembro.has(img.dbv_id)) anexosPorMembro.set(img.dbv_id, new Set());
        anexosPorMembro.get(img.dbv_id)!.add(img.campo);
      }
      for (const d of (docs ?? []) as Documento[]) {
        const anexos = anexosPorMembro.get(d.dbv_id) ?? new Set<string>();
        const entregues = campos.filter((c) => (d as any)[c] === 'NA' || ((d as any)[c] === 'OK' && anexos.has(c))).length;
        stats[d.dbv_id] = { entregues, pendentes: campos.length - entregues, anexos: 0 };
      }
      for (const img of (imgs ?? []) as Array<{ dbv_id: number }>) {
        stats[img.dbv_id] = stats[img.dbv_id] ?? { entregues: 0, pendentes: campos.length, anexos: 0 };
        stats[img.dbv_id].anexos += 1;
      }
      setDocStats(stats);
      return;
    }

    const db = await getDB();
    const docs = await db.getAllAsync<Documento>('SELECT * FROM documentos');
    const imgsDetalhados = await db.getAllAsync<{ dbv_id: number; campo: string }>('SELECT dbv_id, campo FROM documento_imagens');
    const anexosPorMembro = new Map<number, Set<string>>();
    for (const img of imgsDetalhados) {
      if (!anexosPorMembro.has(img.dbv_id)) anexosPorMembro.set(img.dbv_id, new Set());
      anexosPorMembro.get(img.dbv_id)!.add(img.campo);
    }
    for (const d of docs) {
      const anexos = anexosPorMembro.get(d.dbv_id) ?? new Set<string>();
      const entregues = campos.filter((c) => (d as any)[c] === 'NA' || ((d as any)[c] === 'OK' && anexos.has(c))).length;
      stats[d.dbv_id] = { entregues, pendentes: campos.length - entregues, anexos: 0 };
    }
    for (const img of imgsDetalhados) {
      stats[img.dbv_id] = stats[img.dbv_id] ?? { entregues: 0, pendentes: campos.length, anexos: 0 };
      stats[img.dbv_id].anexos += 1;
    }
    setDocStats(stats);
  }

  async function carregarUnidades() {
    if (Platform.OS === 'web') {
      const { data } = await supabase
        .from('unidades')
        .select('id, nome, cor')
        .eq('clube_id', getClubeAtivoId())
        .order('nome');
      setUnidades((data && data.length > 0 ? data : UNIDADES_PADRAO) as UnidadeDB[]);
      return;
    }

    const db = await getDB();
    const clubeAtivoId = getClubeAtivoId();
    for (const u of UNIDADES_PADRAO) {
      const existeNome = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE nome = ? AND clube_id = ?', [u.nome, clubeAtivoId]);
      if (!existeNome) {
        const existeId = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE id = ?', [u.id]);
        if (existeId) {
          await db.runAsync('INSERT INTO unidades (nome, cor, clube_id) VALUES (?, ?, ?)', [u.nome, u.cor, clubeAtivoId]);
        } else {
          await db.runAsync('INSERT INTO unidades (id, nome, cor, clube_id) VALUES (?, ?, ?, ?)', [u.id, u.nome, u.cor, clubeAtivoId]);
        }
      }
    }
    const derivadas = await db.getAllAsync<{ unidade_id: number | null; unidade_nome: string | null }>(
      `SELECT DISTINCT unidade_id, unidade_nome FROM desbravadores
       WHERE unidade_nome IS NOT NULL AND unidade_nome != 'Diretoria'`
    );
    for (const u of derivadas) {
      if (!u.unidade_nome) continue;
      const padrao = UNIDADES_PADRAO.find((x) => x.nome === u.unidade_nome);
      if (u.unidade_id && u.unidade_id > 0) {
        const existeNome = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE nome = ? AND clube_id = ?', [u.unidade_nome, clubeAtivoId]);
        if (!existeNome) {
          const existeId = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE id = ?', [u.unidade_id]);
          if (existeId) {
            await db.runAsync('INSERT INTO unidades (nome, cor, clube_id) VALUES (?, ?, ?)', [u.unidade_nome, padrao?.cor ?? '#1a3a5c', clubeAtivoId]);
          } else {
            await db.runAsync('INSERT INTO unidades (id, nome, cor, clube_id) VALUES (?, ?, ?, ?)', [u.unidade_id, u.unidade_nome, padrao?.cor ?? '#1a3a5c', clubeAtivoId]);
          }
        }
      } else {
        const existeNome = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE nome = ? AND clube_id = ?', [u.unidade_nome, clubeAtivoId]);
        if (!existeNome) {
          await db.runAsync('INSERT INTO unidades (nome, cor, clube_id) VALUES (?, ?, ?)', [u.unidade_nome, padrao?.cor ?? '#1a3a5c', clubeAtivoId]);
        }
      }
    }
    const lista = await db.getAllAsync<UnidadeDB>(
      'SELECT id, nome, cor FROM unidades WHERE clube_id = ? OR clube_id IS NULL ORDER BY nome',
      [clubeAtivoId]
    );
    if (lista.length === 0) {
      const { data } = await supabase
        .from('unidades')
        .select('id, nome, cor')
        .eq('clube_id', getClubeAtivoId())
        .order('nome');
      setUnidades((data ?? UNIDADES_PADRAO) as UnidadeDB[]);
    } else {
      setUnidades(lista);
    }
  }

  const filtros = ['Todas', ...unidades.map((u) => u.nome), 'Diretoria'];

  const filtrados = desbravadores
    .filter((d) => {
      const nomeOk = combinaBusca(d.nome, busca);
      const unOk   = filtroUn === 'Todas' || d.unidade_nome === filtroUn;
      return nomeOk && unOk;
    })
    // A ficha do usuário logado sempre aparece primeiro, se estiver na lista filtrada.
    .sort((a, b) => {
      const aEhEu = usuario?.dbv_id != null && a.id === usuario.dbv_id;
      const bEhEu = usuario?.dbv_id != null && b.id === usuario.dbv_id;
      if (aEhEu && !bEhEu) return -1;
      if (bEhEu && !aEhEu) return 1;
      return 0;
    });

  /* ── Abrir criar ── */
  function abrirCriar() {
    setEditId(null);
    const cargoInicial = cargoLabel(cargosModelo.find((c) => c.tipo === 'membro') ?? cargosModelo[0] ?? CARGOS[0], FORM_VAZIO.genero);
    setForm({ ...FORM_VAZIO, cargo: cargoInicial, perfil_login: perfilPadraoMembro() });
    setPerfilAberto(false);
    setMfaConfirmando(false);
    setMfaMensagem(null);
    setModal(true);
  }

  /* ── Abrir editar ── */
  async function abrirEditar(d: Desbravador) {
    const generoInicial = d.genero ?? 'M';
    const idadeInicial = idadePorNascimento(d.data_nascimento);
    const cargoInicial = ajustarCargoPorIdade(cargoParaFormulario(d.cargo, generoInicial, cargosModelo), idadeInicial, cargosModelo);
    const login = await buscarPerfilLogin(d.id, d.email ?? '');
    const perfilInicial = ajustarPerfilPorIdade(login?.perfil ?? perfilPadraoMembro(), idadeInicial);
    setPerfilAberto(false);
    setMfaConfirmando(false);
    setMfaMensagem(null);
    setEditId(d.id);
    setForm({
      nome: d.nome, genero: generoInicial,
      data_nascimento: d.data_nascimento ?? '',
      cargo: cargoInicial, unidade_id: String(d.unidade_id ?? ''),
      cargo_adicional: cargoParaFormulario(d.cargo_adicional, generoInicial, cargosModelo),
      unidade_nome: d.unidade_nome ?? '', email: login?.email ?? d.email ?? '',
      contato: d.contato ?? '', camisa: d.camisa ?? '', calca: d.calca ?? '',
      nome_responsavel: d.nome_responsavel ?? '',
      contato_responsavel: d.contato_responsavel ?? '',
      foto_url: d.foto_url ?? '',
      senha: '',
      perfil_login: perfilInicial,
      login_user_id: login?.id ?? '',
    });
    setModal(true);
  }

  async function buscarPerfilLogin(dbvId: number, email: string) {
    const clubeId = getClubeAtivoId();
    let { data } = await supabase
      .from('usuarios')
      .select('id, email, perfil')
      .eq('dbv_id', dbvId)
      .maybeSingle();
    if (!data && email) {
      const resp = await supabase
        .from('usuarios')
        .select('id, email, perfil')
        .eq('email', email.toLowerCase())
        .maybeSingle();
      data = resp.data;
    }
    let perfil = normalizarPerfilLogin(data?.perfil);
    if (data?.id) {
      const { data: vinculos } = await supabase
        .from('usuario_clubes')
        .select('perfil')
        .eq('usuario_id', data.id)
        .eq('clube_id', clubeId)
        .eq('ativo', true)
        .order('id', { ascending: false })
        .limit(1);
      const perfilContexto = normalizarPerfilLogin(vinculos?.[0]?.perfil);
      if (perfilContexto) perfil = perfilContexto;
    }
    if (!data?.email && !(perfil && PERFIS_LOGIN.some((p) => p.valor === perfil))) return null;
    return {
      id: data?.id ?? '',
      email: data?.email ?? email,
      perfil: perfil && PERFIS_LOGIN.some((p) => p.valor === perfil) ? perfil : perfilPadraoMembro(),
    };
  }

  async function sincronizarVinculoClube(userId: string, dbvId: number, unidadeId: number | null, perfil: PerfilLogin) {
    const clubeId = getClubeAtivoId();
    const perfilSalvo = perfilParaSalvar(perfil);

    // Update all existing rows at once (handles duplicates without maybeSingle error)
    const { data: updated, error: updateError } = await supabase
      .from('usuario_clubes')
      .update({ membro_id: dbvId, unidade_id: unidadeId, perfil: perfilSalvo, ativo: true })
      .eq('usuario_id', userId)
      .eq('clube_id', clubeId)
      .select('id');
    if (updateError) throw updateError;

    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase.from('usuario_clubes').insert({
        usuario_id: userId,
        clube_id: clubeId,
        membro_id: dbvId,
        unidade_id: unidadeId,
        perfil: perfilSalvo,
        ativo: true,
      });
      if (insertError) throw insertError;
    }
  }

  async function executarResetMfa() {
    setMfaConfirmando(false);
    setMfaMensagem(null);
    try {
      const { error } = await supabase.rpc('resetar_mfa_usuario', {
        target_user_id: form.login_user_id,
      });
      if (error) throw error;
      setMfaMensagem({ tipo: 'ok', texto: 'MFA resetado com sucesso. No próximo login o usuário precisará configurar novamente.' });
    } catch (e: any) {
      setMfaMensagem({ tipo: 'erro', texto: e?.message ?? 'Não foi possível resetar o MFA.' });
    }
  }

  /* ── Escolher foto de perfil ── */
  function escolherFotoPerfilWeb(capturar: boolean) {
    setFotoMenuVisivel(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capturar) input.setAttribute('capture', 'environment');
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        Alert.alert('Formato inválido', 'A foto 3x4 aceita apenas imagens.');
        return;
      }
      const url = URL.createObjectURL(file);
      setForm((f) => ({ ...f, foto_url: url }));
    };
    input.click();
  }

  async function escolherFotoPerfil() {
    if (!isAdmin) return;
    if (Platform.OS === 'web') {
      setFotoMenuVisivel(true);
      return;
    }

    const opcoes = ['📷 Tirar foto', '🖼️ Escolher da galeria', 'Cancelar'];
    const escolha = await new Promise<number>((resolve) => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: opcoes, cancelButtonIndex: 2 },
          resolve
        );
      } else {
        Alert.alert('Foto de perfil', 'Escolha uma opção', [
          { text: opcoes[0], onPress: () => resolve(0) },
          { text: opcoes[1], onPress: () => resolve(1) },
          { text: opcoes[2], style: 'cancel', onPress: () => resolve(2) },
        ]);
      }
    });
    if (escolha === 2) return;

    let result: ImagePicker.ImagePickerResult;
    if (escolha === 0) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permissão necessária', 'Permita acesso à câmera.'); return; }
      result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.75 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permissão necessária', 'Permita acesso à galeria.'); return; }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.75,
      });
    }
    if (result.canceled || !result.assets[0]) return;
    setForm((f) => ({ ...f, foto_url: result.assets[0].uri }));
  }

  /* ── Salvar ── */
  async function salvar() {
    if (!form.nome.trim()) { Alert.alert('Atenção', 'Nome é obrigatório.'); return; }
    setSalvando(true);
    try {
      const idadeFinal = idadePorNascimento(form.data_nascimento);
      let cargoFinal = ajustarCargoPorIdade(form.cargo, idadeFinal, cargosModelo);
      let cargoAdicionalFinal = ajustarCargoPorIdade(form.cargo_adicional, idadeFinal, cargosModelo);
      if (ehFuncaoJuvenil(cargoFinal)) {
        cargoAdicionalFinal = cargoFinal;
        const cargoMembro = cargosModelo.find((c) => c.tipo === 'membro') ?? CARGOS[0];
        cargoFinal = cargoLabel(cargoMembro, form.genero);
      }
      const perfilFinal = ajustarPerfilPorIdade(form.perfil_login, idadeFinal);
      const dados = {
        nome: form.nome.trim(),
        genero: form.genero as 'M' | 'F',
        data_nascimento: form.data_nascimento || null,
        idade: idadeFinal,
        cargo: cargoFinal || null,
        cargo_adicional: cargoAdicionalFinal || null,
        unidade_id: form.unidade_id ? Number(form.unidade_id) : null,
        unidade_nome: form.unidade_nome || null,
        email: form.email || null,
        contato: form.contato || null,
        camisa: form.camisa || null,
        calca: form.calca || null,
        nome_responsavel: form.nome_responsavel || null,
        contato_responsavel: form.contato_responsavel || null,
      };

      let dbvId = editId;
      if (editId) {
        await editarDesbravador(editId, dados as any);
      } else {
        dbvId = await criarDesbravador(dados as any);
      }

      const emailLogin = form.email.trim().toLowerCase();
      const senhaLogin = form.senha.trim();
      if (dbvId && form.login_user_id && emailLogin) {
        await atualizarCredenciaisLoginExistente(
          form.login_user_id,
          dbvId,
          emailLogin,
          senhaLogin,
          form.nome.trim(),
          dados.unidade_id,
          perfilFinal,
        );
      } else if (dbvId && emailLogin && senhaLogin) {
        await criarLoginMembro(dbvId, emailLogin, senhaLogin, form.nome.trim(), dados.unidade_id, perfilFinal)
          .catch((e) => {
            console.warn('Membro salvo, mas login nao foi criado:', e);
            Alert.alert('Membro salvo', `O membro foi cadastrado, mas o login não foi criado: ${e?.message ?? e}`);
          });
      } else if (dbvId && emailLogin) {
        await atualizarPerfilLoginExistente(dbvId, emailLogin, form.nome.trim(), dados.unidade_id, perfilFinal)
          .catch((e) => console.warn('Membro salvo, mas perfil de login nao foi atualizado:', e));
      }

      // Upload foto se foi escolhida localmente (file:// no app, blob:/data: no web).
      const fotoLocal = !!form.foto_url && !/^https?:\/\//i.test(form.foto_url);
      if (dbvId && fotoLocal) {
        setUpFoto(true);
        const url = await uploadFotoMembro(dbvId, form.foto_url);
        if (!url) throw new Error('Não foi possível enviar a foto. Verifique a conexão e tente novamente.');
        await atualizarFoto(dbvId, url);
        await vincularFotoAoDocumento(dbvId, url);
        setUpFoto(false);
      }

      if (Platform.OS !== 'web') {
        await sincronizarTudo().catch(() => null);
      }

      setModal(false);
    } catch (e: any) {
      const msg = e?.message || e?.details || e?.hint || JSON.stringify(e);
      Alert.alert('Erro ao salvar membro', msg);
    } finally {
      setSalvando(false);
      setUpFoto(false);
    }
  }

  async function atualizarPerfilLoginExistente(dbvId: number, email: string, nome: string, unidadeId: number | null, perfil: PerfilLogin) {
    let { data: existente } = await supabase
      .from('usuarios')
      .select('id')
      .eq('dbv_id', dbvId)
      .maybeSingle();
    if (!existente) {
      const resp = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      existente = resp.data;
    }

    if (existente?.id) {
      try {
        const { error } = await supabase.rpc('gerenciar_acesso_usuario', {
          target_user_id: existente.id,
          novo_perfil: perfil,
          novo_dbv_id: dbvId,
          remover_acesso: false,
        });
        if (error) console.log('gerenciar_acesso_usuario falhou', error);
      } catch (e) {
        console.log('gerenciar_acesso_usuario indisponível', e);
      }
      // Atualiza usuarios.perfil diretamente para garantir consistência
      await supabase.from('usuarios').update({ email, nome, perfil, unidade_id: unidadeId, dbv_id: dbvId }).eq('id', existente.id);
      await sincronizarVinculoClube(existente.id, dbvId, unidadeId, perfil);
    }
  }

  async function atualizarCredenciaisLoginExistente(
    userId: string,
    dbvId: number,
    email: string,
    senha: string,
    nome: string,
    unidadeId: number | null,
    perfil: PerfilLogin,
  ) {
    if (!email) throw new Error('Informe o e-mail do login.');
    if (senha && senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');

    const { error } = await supabase.rpc('atualizar_login_membro', {
      target_user_id: userId,
      novo_email: email,
      nova_senha: senha || null,
      novo_nome: nome,
      novo_perfil: perfil,
      novo_dbv_id: dbvId,
      novo_unidade_id: unidadeId,
    });
    if (error) throw error;

    await sincronizarVinculoClube(userId, dbvId, unidadeId, perfil);
  }

  async function criarLoginMembro(dbvId: number, email: string, senha: string, nome: string, unidadeId: number | null, perfil: PerfilLogin) {
    if (senha.length < 6) {
      Alert.alert('Login não criado', 'A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    const { data: existente } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existente?.id) {
      await supabase.from('usuarios').update({ nome, perfil, unidade_id: unidadeId, dbv_id: dbvId }).eq('id', existente.id);
      await sincronizarVinculoClube(existente.id, dbvId, unidadeId, perfil);
      return;
    }

    const { data: sessaoAtual } = await supabase.auth.getSession();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome, perfil, unidade_id: unidadeId, dbv_id: dbvId },
        emailRedirectTo: 'dbvfonseca://auth/callback',
      },
    });

    if (sessaoAtual.session) {
      await supabase.auth.setSession({
        access_token: sessaoAtual.session.access_token,
        refresh_token: sessaoAtual.session.refresh_token,
      });
    }

    if (error) throw error;
    if (data.user?.id) {
      await supabase.from('usuarios').upsert({
        id: data.user.id,
        email,
        nome,
        perfil,
        unidade_id: unidadeId,
        dbv_id: dbvId,
      });
      await sincronizarVinculoClube(data.user.id, dbvId, unidadeId, perfil);
    }
  }

  /* ── Ações do membro ── */
  function confirmarAcaoMembro(d: Desbravador) {
    const estaInativo = d.ativo === false;
    if (Platform.OS === 'web') {
      const opcao = typeof window !== 'undefined'
        ? window.prompt(`${d.nome}\n\nDigite:\n1 - ${estaInativo ? 'Ativar membro' : 'Inativar'}\n2 - Excluir permanentemente`)
        : null;
      if (opcao === '1') estaInativo ? reativarMembro(d) : confirmarInativar(d);
      if (opcao === '2') confirmarExcluir(d);
      return;
    }
    Alert.alert(d.nome, 'O que deseja fazer?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: estaInativo ? 'Ativar membro' : 'Inativar', onPress: () => estaInativo ? reativarMembro(d) : confirmarInativar(d) },
      { text: 'Excluir permanentemente', style: 'destructive', onPress: () => confirmarExcluir(d) },
    ]);
  }

  function confirmarInativar(d: Desbravador) {
    const executar = async () => {
      try {
        await inativarDesbravador(d.id);
      } catch (e: any) {
        Alert.alert('Erro', e?.message ?? 'Não foi possível inativar este membro.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Inativar ${d.nome}?\n\nO histórico será preservado. Pode ser reativado depois.`)) executar();
      return;
    }
    Alert.alert(
      'Inativar membro',
      `${d.nome} ficará oculto das listas, mas seu histórico será preservado.\n\nDeseja continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Inativar', style: 'destructive', onPress: executar },
      ]
    );
  }

  async function reativarMembro(d: Desbravador) {
    try {
      await editarDesbravador(d.id, { ativo: true });
      // Sai da lista de inativos na hora: um carregar() aqui buscava do
      // servidor antes da fila de sincronia do app terminar de enviar a
      // mudança, trazendo o membro de volta como inativo (só sumia no
      // segundo clique, quando a fila já tinha sincronizado).
      if (verInativos) useDBVStore.setState((s) => ({ desbravadores: s.desbravadores.filter((x) => x.id !== d.id) }));
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível reativar este membro.');
    }
  }

  /* ── Excluir ── */
  function confirmarExcluir(d: Desbravador) {
    const executar = async () => {
      try {
        await excluirDesbravador(d.id);
      } catch (e: any) {
        Alert.alert('Erro ao excluir membro', e?.message ?? 'Não foi possível excluir este membro.');
      }
    };

    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined'
        ? window.confirm(`Excluir ${d.nome}?\n\nIsso removerá o membro e seus dados vinculados.`)
        : false;
      if (ok) executar();
      return;
    }

    Alert.alert(
      'Excluir membro',
      `Isso removerá ${d.nome} e todos seus dados (pontuações, documentos, etc).\n\nDeseja continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: executar },
      ]
    );
  }

  /* ── Selecionar unidade no form ── */
  function selecionarUnidade(u: UnidadeDB) {
    setForm((f) => ({ ...f, unidade_id: String(u.id), unidade_nome: u.nome }));
  }

  if (!usuario) return <Redirect href="/auth/login" />;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>👥 Membros</Text>
          <Text style={s.subtitulo}>{desbravadores.length} {verInativos ? 'inativos' : 'ativos'}</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: verInativos ? '#888' : undefined, marginRight: 8 }]}
            onPress={() => { setVerInativos((v) => !v); carregar(!verInativos); }}
          >
            <Ionicons name={verInativos ? 'eye-off-outline' : 'eye-outline'} size={18} color="#fff" />
            <Text style={s.addBtnText}>{verInativos ? 'Inativos' : 'Ativos'}</Text>
          </TouchableOpacity>
        )}
        {isAdmin && !verInativos && (
          <TouchableOpacity style={s.addBtn} onPress={abrirCriar}>
            <Ionicons name="person-add" size={20} color="#fff" />
            <Text style={s.addBtnText}>Novo</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.buscaContainer}>
        <Ionicons name="search" size={17} color="#aaa" style={{ marginLeft: 12 }} />
        <TextInput
          style={s.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar desbravador..."
          placeholderTextColor="#aaa"
          clearButtonMode="while-editing"
        />
      </View>

      <View style={s.filtrosWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtrosContent}>
          {filtros.map((u) => {
            const cor = unidades.find((x) => x.nome === u)?.cor ?? '#1a3a5c';
            const ativo = filtroUn === u;
            return (
              <TouchableOpacity
                key={u}
                style={[s.filtroChip, ativo && { backgroundColor: u === 'Todas' ? '#1a3a5c' : cor }]}
                onPress={() => setFiltroUn(u)}
              >
                <Text style={[s.filtroText, ativo && { color: '#fff' }]}>{u}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={s.lista}>
        <Text style={s.contador}>{filtrados.length} membro(s)</Text>
        {filtrados.map((dbv) => {
          const cor = unidades.find((u) => u.nome === dbv.unidade_nome)?.cor ?? avatarCor(dbv.nome);
          const proprioCadastro = dbv.id === usuario?.dbv_id;
          const mesmaUnidade = !!usuario?.unidade_id && dbv.unidade_id === Number(usuario.unidade_id);
          // Responsável só abre a ficha do(s) filho(s) vinculado(s) ao contexto
          // ativo — antes essa tela nem verificava isso, então o responsável
          // conseguia achar o filho na busca mas o clique não fazia nada.
          const ehFilhoDoResponsavel = contextoAtivo?.tipo === 'responsavel' && contextoAtivo.membro_id === dbv.id;
          // Conselheiro só vê/abre a própria unidade — antes `isConselheiro`
          // sozinho liberava abrir a ficha de QUALQUER unidade.
          const podeAbrir = isAdmin || proprioCadastro || mesmaUnidade || ehFilhoDoResponsavel;
          const mostrarSomenteNome = !isAdmin && !proprioCadastro && !mesmaUnidade && !ehFilhoDoResponsavel;
          const stat = docStats[dbv.id];
          return (
            <View key={dbv.id} style={s.card}>
              <TouchableOpacity
                style={s.cardMain}
                onPress={() => podeAbrir ? router.push({ pathname: '/membro/[id]', params: { id: dbv.id } }) : undefined}
                activeOpacity={0.8}
                disabled={!podeAbrir}
              >
                <View style={s.avatarComBadge}>
                  {dbv.foto_url ? (
                    <Image source={{ uri: dbv.foto_url }} style={[s.avatar, { borderRadius: 23, marginRight: 0 }]} />
                  ) : (
                    <View style={[s.avatar, { backgroundColor: avatarCor(dbv.nome), marginRight: 0 }]}>
                      <Text style={s.avatarLetra}>{dbv.nome[0]}</Text>
                    </View>
                  )}
                  {badgesResp.has(dbv.id) && <AvatarBadge fotos={badgesResp.get(dbv.id)!} size={46} />}
                </View>
                <View style={s.info}>
                  <Text style={s.nome}>{dbv.nome}</Text>
                  {/* Unidade e cargo visíveis para todos; info sensível apenas para quem tem acesso */}
                  <View style={s.tags}>
                    {dbv.unidade_nome && (
                      <View style={[s.tag, { backgroundColor: cor + '22' }]}>
                        <Text style={[s.tagText, { color: cor }]}>{dbv.unidade_nome}</Text>
                      </View>
                    )}
                    {cargoTagLabel(dbv.cargo) ? (
                      <View style={s.cargoTag}>
                        <Text style={s.cargoTagText}>{cargoTagLabel(dbv.cargo)}</Text>
                      </View>
                    ) : null}
                    {!mostrarSomenteNome && dbv.idade ? <Text style={s.idade}>{dbv.idade} anos</Text> : null}
                    {!mostrarSomenteNome && (mesmaUnidade || proprioCadastro || isConselheiro) && stat ? (
                      <View style={[s.docStatusTag, stat.pendentes > 0 ? s.docPendenteTag : s.docOkTag]}>
                        <Text style={[s.docStatusText, stat.pendentes > 0 ? s.docPendenteText : s.docOkText]}>
                          {stat.pendentes > 0 ? `${stat.pendentes} docs pendentes` : 'Docs OK'}
                        </Text>
                      </View>
                    ) : null}
                    {!mostrarSomenteNome && isConselheiro && stat?.anexos ? (
                      <View style={s.anexoTag}><Text style={s.anexoTagText}>{stat.anexos} anexo(s)</Text></View>
                    ) : null}
                  </View>
                </View>
                {podeAbrir && <Ionicons name="chevron-forward" size={18} color="#ccc" />}
              </TouchableOpacity>

              {/* Ações admin */}
              {isAdmin && verInativos && (
                <View style={s.cardAcoes}>
                  <TouchableOpacity onPress={() => confirmarAcaoMembro(dbv)} style={s.acaoBtn}>
                    <Ionicons name="ellipsis-horizontal" size={15} color="#666" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        {filtrados.length === 0 && <Text style={s.vazio}>Nenhum membro encontrado.</Text>}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Modal CRUD ── */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalContainer}>
            {/* Header modal */}
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setModal(false)} style={s.modalClose}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={s.modalTitulo}>{editId ? 'Editar membro' : 'Novo membro'}</Text>
              <TouchableOpacity onPress={salvar} disabled={salvando} style={s.modalSalvar}>
                {salvando
                  ? <ActivityIndicator size="small" color="#1a3a5c" />
                  : <Text style={s.modalSalvarText}>Salvar</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              {/* Avatar / Foto de perfil */}
              <TouchableOpacity
                style={s.avatarModal}
                onPress={escolherFotoPerfil}
                activeOpacity={0.8}
                disabled={!isAdmin}
              >
                {form.foto_url ? (
                  <Image source={{ uri: form.foto_url }} style={s.avatarModalImg} />
                ) : (
                  <View style={[s.avatarModalImg, { backgroundColor: form.nome ? avatarCor(form.nome) : '#90a4ae', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={s.avatarModalLetra}>
                      {form.nome ? form.nome[0].toUpperCase() : '?'}
                    </Text>
                  </View>
                )}
                {isAdmin && (
                  <View style={s.avatarModalOverlay}>
                    {upFoto ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="camera" size={17} color="#fff" />
                    )}
                  </View>
                )}
              </TouchableOpacity>
              <Text style={s.avatarModalDica}>
                {isAdmin ? `Toque para ${form.foto_url ? 'alterar' : 'adicionar'} foto 3x4` : 'Foto oficial 3x4'}
              </Text>

              {/* Nome */}
              <Campo label="Nome completo *">
                <TextInput style={s.input} value={form.nome} onChangeText={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="Nome do desbravador" />
              </Campo>

              {/* Gênero */}
              <Campo label="Gênero">
                <View style={s.generoRow}>
                  {(['M', 'F'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setForm((f) => ({
                        ...f,
                        genero: g,
                        cargo: ajustarCargoPorIdade(adaptarCargo(f.cargo, g, cargosModelo), idadePorNascimento(f.data_nascimento), cargosModelo),
                        cargo_adicional: adaptarCargo(f.cargo_adicional, g, cargosModelo),
                        perfil_login: ajustarPerfilPorIdade(f.perfil_login, idadePorNascimento(f.data_nascimento)),
                      }))}
                      style={[s.generoBtn, form.genero === g && s.generoBtnAtivo]}
                    >
                      <Text style={[s.generoBtnText, form.genero === g && { color: '#fff' }]}>
                        {g === 'M' ? '♂ Masculino' : '♀ Feminino'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Campo>

              {/* Data de nascimento */}
              <Campo label="Data de nascimento">
                <DateField
                  value={form.data_nascimento}
                  onChange={(v) => setForm((f) => {
                    const idade = idadePorNascimento(v);
                    const cargo = ajustarCargoPorIdade(f.cargo, idade, cargosModelo);
                    return {
                      ...f,
                      data_nascimento: v,
                      cargo,
                      cargo_adicional: ajustarCargoPorIdade(f.cargo_adicional, idade, cargosModelo),
                      perfil_login: ajustarPerfilPorIdade(f.perfil_login, idade),
                    };
                  })}
                  placeholder="Selecionar nascimento"
                  minimumDate={nascimentoMin}
                  defaultDate={nascimentoDefault}
                />
              </Campo>

              {/* Cargo */}
              <Campo label="Cargo">
                <View style={s.generoRow}>
                  {cargosModelo.map((c) => {
                    const label = cargoLabel(c, form.genero);
                    const bloqueado = cargoBloqueadoPorIdade(label, idadeForm, cargosModelo);
                    const ativo = form.cargo === c.masc || form.cargo === c.fem;
                    return (
                      <TouchableOpacity
                        key={c.codigo}
                        disabled={bloqueado}
                        onPress={() => setForm((f) => ({
                          ...f,
                          cargo: ativo ? '' : cargoLabel(c, f.genero),
      perfil_login: cargoForcaDesbravador(label, cargosModelo)
                            ? perfilPadraoMembro()
                            : ajustarPerfilPorIdade(f.perfil_login, idadePorNascimento(f.data_nascimento)),
                        }))}
                        style={[s.cargoChip, ativo && s.cargoChipAtivo, bloqueado && s.cargoChipDesabilitado]}
                      >
                        <Text style={[s.cargoChipText, ativo && s.cargoChipTextAtivo, bloqueado && s.cargoChipTextDesabilitado]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Campo>

              <Campo label="Função adicional (opcional)">
                <View style={s.generoRow}>
                  {cargosModelo.filter((c) => c.tipo !== 'membro').map((c) => {
                    const label = cargoLabel(c, form.genero);
                    const bloqueado = cargoBloqueadoPorIdade(label, idadeForm, cargosModelo);
                    const ativo = form.cargo_adicional === c.masc || form.cargo_adicional === c.fem;
                    return (
                      <TouchableOpacity
                        key={`adicional-${c.codigo}`}
                        disabled={bloqueado}
                        onPress={() => setForm((f) => ({ ...f, cargo_adicional: ativo ? '' : cargoLabel(c, f.genero) }))}
                        style={[s.cargoChip, ativo && s.cargoChipAtivo, bloqueado && s.cargoChipDesabilitado]}
                      >
                        <Text style={[s.cargoChipText, ativo && s.cargoChipTextAtivo, bloqueado && s.cargoChipTextDesabilitado]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Campo>

              {/* Unidade */}
              <Campo label="Unidade">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {[...unidades, { id: 0, nome: 'Diretoria', cor: '#9c27b0' }].map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => selecionarUnidade(u as UnidadeDB)}
                      style={[s.unChip, form.unidade_nome === u.nome && { backgroundColor: u.cor }]}
                    >
                      <Text style={[s.unChipText, form.unidade_nome === u.nome && { color: '#fff' }]}>{u.nome}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => setForm((f) => ({ ...f, unidade_id: '', unidade_nome: '' }))}
                    style={[s.unChip, !form.unidade_nome && { backgroundColor: '#90a4ae' }]}
                  >
                    <Text style={[s.unChipText, !form.unidade_nome && { color: '#fff' }]}>Sem unidade</Text>
                  </TouchableOpacity>
                </ScrollView>
              </Campo>

              {/* Email */}
              <Campo label="E-mail">
                <EmailInput style={s.input} value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="email@exemplo.com" />
              </Campo>

              <Campo label={editId ? 'Senha de login (se ainda não tiver usuário)' : 'Senha de login'}>
                <TextInput
                  style={s.input}
                  value={form.senha}
                  onChangeText={(v) => setForm((f) => ({ ...f, senha: v }))}
                  placeholder="Mínimo 6 caracteres"
                  secureTextEntry
                />
              </Campo>

              <Campo label="Tipo de acesso do login">
                <View style={s.generoRow}>
                  {PERFIS_LOGIN.map((p) => {
                    const ativo = form.perfil_login === p.valor;
                    const desabilitado = perfilBloqueadoPorIdade(p.valor, idadeForm, usuario?.perfil);
                    return (
                      <TouchableOpacity
                        key={p.valor}
                        disabled={desabilitado}
                        style={[s.cargoChip, ativo && s.cargoChipAtivo, desabilitado && s.cargoChipDesabilitado]}
                        onPress={() => setForm((f) => ({ ...f, perfil_login: ajustarPerfilPorIdade(p.valor, idadePorNascimento(f.data_nascimento)) }))}
                      >
                        <Text style={[s.cargoChipText, ativo && s.cargoChipTextAtivo, desabilitado && s.cargoChipTextDesabilitado]}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {perfilTravadoComoDesbravador && (
                  <Text style={s.perfilAviso}>Até 15 anos, o acesso fica limitado a Desbravador.</Text>
                )}
                {perfilAdultoObrigatorio && (
                  <Text style={s.perfilAviso}>Acima de 15 anos, o acesso de Desbravador fica bloqueado.</Text>
                )}
                {editId && form.login_user_id && (
                  <Text style={s.perfilAviso}>Alterações de perfil entram em vigor no próximo login deste usuário.</Text>
                )}
                {podeGerenciarAcessoTotal && editId && form.login_user_id && perfilAdulto(form.perfil_login) && (
                  <View style={{ marginTop: 10 }}>
                    {mfaMensagem && (
                      <View style={[s.mfaMensagemBox, mfaMensagem.tipo === 'ok' ? s.mfaMensagemOk : s.mfaMensagemErro]}>
                        <Ionicons name={mfaMensagem.tipo === 'ok' ? 'checkmark-circle' : 'alert-circle'} size={16} color={mfaMensagem.tipo === 'ok' ? '#2e7d32' : '#c62828'} />
                        <Text style={[s.mfaMensagemText, { color: mfaMensagem.tipo === 'ok' ? '#2e7d32' : '#c62828' }]}>{mfaMensagem.texto}</Text>
                      </View>
                    )}
                    {mfaConfirmando ? (
                      <View style={s.mfaConfirmBox}>
                        <Text style={s.mfaConfirmTexto}>Remover Google Authenticator deste usuário? No próximo login ele precisará configurar novamente.</Text>
                        <View style={s.mfaConfirmBotoes}>
                          <TouchableOpacity style={s.mfaConfirmCancelar} onPress={() => setMfaConfirmando(false)}>
                            <Text style={s.mfaConfirmCancelarText}>Cancelar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.mfaConfirmOk} onPress={executarResetMfa}>
                            <Text style={s.mfaConfirmOkText}>Confirmar reset</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity style={s.resetMfaBtn} onPress={() => { setMfaMensagem(null); setMfaConfirmando(true); }}>
                        <Ionicons name="key-outline" size={16} color="#7d4f00" />
                        <Text style={s.resetMfaText}>Resetar dupla autenticação deste usuário</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </Campo>

              {/* Contato */}
              <Campo label="Telefone/WhatsApp">
                <TextInput style={s.input} value={form.contato} onChangeText={(v) => setForm((f) => ({ ...f, contato: v }))} placeholder="(00) 00000-0000" keyboardType="phone-pad" />
              </Campo>

              {/* Camisa */}
              <Campo label="Tamanho da camisa">
                <View style={s.generoRow}>
                  {['PP','P','M','G','GG','XG'].map((t) => (
                    <TouchableOpacity
                      key={t} onPress={() => setForm((f) => ({ ...f, camisa: t }))}
                      style={[s.generoBtn, form.camisa === t && s.generoBtnAtivo, { minWidth: 44 }]}
                    >
                      <Text style={[s.generoBtnText, form.camisa === t && { color: '#fff' }]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Campo>

              <Campo label="Tamanho da calça">
                <View style={s.generoRow}>
                  {['4','6','8','10','12','14','PP','P','M','G','GG','XG'].map((t) => (
                    <TouchableOpacity
                      key={t} onPress={() => setForm((f) => ({ ...f, calca: t }))}
                      style={[s.generoBtn, form.calca === t && s.generoBtnAtivo, { minWidth: 44 }]}
                    >
                      <Text style={[s.generoBtnText, form.calca === t && { color: '#fff' }]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Campo>

              {/* Responsável */}
              <Campo label="Nome do responsável">
                <TextInput style={s.input} value={form.nome_responsavel} onChangeText={(v) => setForm((f) => ({ ...f, nome_responsavel: v }))} placeholder="Nome do pai/mãe/responsável" />
              </Campo>

              <Campo label="Telefone do responsável">
                <TextInput style={s.input} value={form.contato_responsavel} onChangeText={(v) => setForm((f) => ({ ...f, contato_responsavel: v }))} placeholder="(00) 00000-0000" keyboardType="phone-pad" />
              </Campo>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={fotoMenuVisivel} transparent animationType="fade" onRequestClose={() => setFotoMenuVisivel(false)}>
        <Pressable style={s.fotoMenuOverlay} onPress={() => setFotoMenuVisivel(false)}>
          <Pressable style={s.fotoMenuCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.fotoMenuTitulo}>Foto 3x4</Text>
            <Text style={s.fotoMenuSub}>Escolha como deseja atualizar a foto do membro.</Text>
            <TouchableOpacity style={s.fotoMenuOpcao} onPress={() => escolherFotoPerfilWeb(true)}>
              <Ionicons name="camera-outline" size={22} color="#1a3a5c" />
              <Text style={s.fotoMenuOpcaoText}>Abrir câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.fotoMenuOpcao} onPress={() => escolherFotoPerfilWeb(false)}>
              <Ionicons name="image-outline" size={22} color="#1a3a5c" />
              <Text style={s.fotoMenuOpcaoText}>Escolher da galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.fotoMenuCancelar} onPress={() => setFotoMenuVisivel(false)}>
              <Text style={s.fotoMenuCancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.campo}>
      <Text style={s.campoLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f0f4f8' },
  header:      { backgroundColor: '#1a3a5c', paddingHorizontal: 24, paddingTop: 52, paddingBottom: 28, flexDirection: 'row', alignItems: 'center' },
  titulo:      { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitulo:   { color: 'rgba(255,255,255,0.78)', fontSize: 12, marginTop: 2 },
  addBtn:      { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtnText:  { color: '#fff', fontSize: 15, fontWeight: '800' },
  buscaContainer: {
    marginHorizontal: 18, marginTop: 18, marginBottom: 10,
    backgroundColor: '#fff', borderRadius: 14, minHeight: 58,
    flexDirection: 'row', alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  busca:       { flex: 1, paddingHorizontal: 10, paddingVertical: 14, fontSize: 16, color: '#222' },
  filtrosWrap: { minHeight: 48, marginBottom: 4 },
  filtrosContent: { paddingHorizontal: 18, paddingBottom: 8, gap: 8 },
  filtroChip:  { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 22, marginRight: 8, elevation: 1 },
  filtroText:  { color: '#1a3a5c', fontSize: 13, fontWeight: '700' },

  lista:       { flex: 1, padding: 16 },
  contador:    { color: '#888', fontSize: 13, marginBottom: 10 },

  card:        { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, elevation: 2, overflow: 'hidden' },
  cardMain:    { flexDirection: 'row', alignItems: 'center', padding: 14 },
  cardAcoes:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  acaoBtn:     { flex: 1, padding: 10, alignItems: 'center', justifyContent: 'center' },

  avatar:      { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarComBadge: { width: 46, height: 46, marginRight: 12, position: 'relative' },
  avatarLetra: { color: '#fff', fontSize: 20, fontWeight: '700' },
  info:        { flex: 1 },
  nome:        { fontSize: 15, fontWeight: '700', color: '#222' },
  tags:        { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6, flexWrap: 'wrap' },
  tag:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  tagText:     { fontSize: 11, fontWeight: '600' },
  idade:       { fontSize: 11, color: '#888' },
  docStatusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  docPendenteTag: { backgroundColor: '#fff3e0' },
  docOkTag: { backgroundColor: '#e8f5e9' },
  docStatusText: { fontSize: 11, fontWeight: '700' },
  docPendenteText: { color: '#ef6c00' },
  docOkText: { color: '#2e7d32' },
  anexoTag: { backgroundColor: '#e8f0fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  anexoTagText: { fontSize: 11, color: '#1a3a5c', fontWeight: '700' },
  vazio:       { textAlign: 'center', color: '#999', marginTop: 40 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 44, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalClose:     { padding: 4 },
  modalTitulo:    { flex: 1, fontSize: 17, fontWeight: '800', color: '#1a3a5c', textAlign: 'center' },
  modalSalvar:    { minWidth: 52, alignItems: 'flex-end' },
  modalSalvarText:{ fontSize: 16, fontWeight: '700', color: '#1a3a5c' },
  modalScroll:    { padding: 16, gap: 4 },

  campo:       { marginBottom: 14 },
  campoLabel:  { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 6 },
  input:       { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },

  generoRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  generoBtn:   { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  generoBtnAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  generoBtnText:  { fontSize: 13, fontWeight: '600', color: '#555' },

  unChip:      { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa', marginRight: 8 },
  unChipText:  { fontSize: 13, fontWeight: '600', color: '#555' },
  perfilGrid:  { gap: 8 },
  perfilSeletor: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#1a3a5c', borderRadius: 12, padding: 12, backgroundColor: '#f0f4f8', gap: 10 },
  perfilSeletorLabel: { fontSize: 15, fontWeight: '800', color: '#1a3a5c' },
  perfilSeletorDesc: { fontSize: 11, color: '#557', marginTop: 2 },
  perfilDropdown: { marginTop: 4, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' },
  perfilDropdownItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 10 },
  perfilDropdownItemAtivo: { backgroundColor: '#1a3a5c' },
  perfilChip:  { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 12, backgroundColor: '#fafafa' },
  perfilChipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  perfilChipDesabilitado: { opacity: 0.45 },
  perfilChipText: { color: '#333', fontSize: 14, fontWeight: '800' },
  perfilChipTextAtivo: { color: '#fff' },
  perfilChipTextDesabilitado: { color: '#999' },
  perfilChipDesc: { color: '#888', fontSize: 11, marginTop: 2 },
  perfilChipDescAtivo: { color: '#cde4fb' },
  perfilAviso: { color: '#777', fontSize: 12, marginTop: 8 },
  resetMfaBtn: { backgroundColor: '#fff7e6', borderWidth: 1, borderColor: '#ffd58a', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  resetMfaText: { color: '#7d4f00', fontWeight: '800', fontSize: 12 },
  mfaConfirmBox: { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffb74d', borderRadius: 10, padding: 12, gap: 10 },
  mfaConfirmTexto: { color: '#5d3200', fontSize: 13, lineHeight: 18 },
  mfaConfirmBotoes: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  mfaConfirmCancelar: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#bbb', backgroundColor: '#f5f5f5' },
  mfaConfirmCancelarText: { color: '#555', fontWeight: '700', fontSize: 13 },
  mfaConfirmOk: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#c62828' },
  mfaConfirmOkText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  mfaMensagemBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1 },
  mfaMensagemOk: { backgroundColor: '#e8f5e9', borderColor: '#a5d6a7' },
  mfaMensagemErro: { backgroundColor: '#ffebee', borderColor: '#ef9a9a' },
  mfaMensagemText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },

  // Avatar no modal
  avatarModal:      { alignSelf: 'center', marginBottom: 4, marginTop: 4 },
  avatarModalImg:   { width: 96, height: 96, borderRadius: 48 },
  avatarModalLetra: { color: '#fff', fontSize: 38, fontWeight: '800' },
  avatarModalOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#1a3a5c', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarModalDica:  { textAlign: 'center', fontSize: 11, color: '#aaa', marginBottom: 16 },
  fotoMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  fotoMenuCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, gap: 10 },
  fotoMenuTitulo: { fontSize: 18, fontWeight: '900', color: '#1a3a5c' },
  fotoMenuSub: { fontSize: 13, color: '#667', marginBottom: 4 },
  fotoMenuOpcao: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f3f7fb', borderRadius: 14, padding: 14 },
  fotoMenuOpcaoText: { fontSize: 15, fontWeight: '800', color: '#1a3a5c' },
  fotoMenuCancelar: { alignItems: 'center', paddingVertical: 12 },
  fotoMenuCancelarText: { color: '#888', fontWeight: '800' },

  // Cargo chips (formulário)
  cargoChip:        { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  cargoChipAtivo:   { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  cargoChipDesabilitado: { opacity: 0.38 },
  cargoChipText:    { fontSize: 13, fontWeight: '600', color: '#555' },
  cargoChipTextAtivo: { color: '#fff' },
  cargoChipTextDesabilitado: { color: '#999' },

  // Cargo tag (card)
  cargoTag:     { backgroundColor: '#e8eaf6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  cargoTagText: { fontSize: 11, color: '#3949ab', fontWeight: '600' },
});
