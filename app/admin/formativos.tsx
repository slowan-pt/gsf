import { EstadoVazio, CampoBusca, Chip } from '../../src/components/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { enviarArquivo } from '../../src/lib/arquivos';
import { getClubeAtivoId, getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { avisar, confirmar } from '../../src/stores/avisoStore';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { comprimirBlobWeb, ehImagemComprimivel } from '../../src/lib/imageCompress';
import {
  carregarClassesModelo,
  carregarEspecialidadesModelo,
  type ClasseModelo,
  type EspecialidadeModelo,
} from '../../src/lib/modelosPrograma';
import { corIcone, tomTexto } from '../../src/lib/tema';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
type TipoItem = 'especialidade' | 'classe';
type ModoItens = 'manual' | 'lote';
type TipoAnexo = 'image' | 'pdf' | 'word' | 'outro';

interface PlanoFormativo {
  id: number;
  clube_id: number;
  tipo: TipoItem;
  item_nome: string;
  titulo: string;
  descricao?: string | null;
  avaliacoes_necessarias: number;
  ativo: boolean;
  modelo_padrao?: boolean | null;
}

interface PlanoItem {
  id?: number;
  plano_formativo_id?: number;
  clube_id?: number;
  ordem: number;
  titulo: string;
  descricao: string;
  obrigatorio: boolean;
  ativo?: boolean;
  anexosPend?: AnexoPendente[];
  anexosSalvos?: PlanoAnexo[];
}

interface PlanoAnexo {
  id?: number;
  plano_formativo_id?: number;
  plano_formativo_item_id?: number | null;
  clube_id?: number;
  escopo: 'modelo' | 'item';
  item_ordem?: number | null;
  nome: string;
  url: string;
  tipo: TipoAnexo;
}

interface AnexoPendente {
  chave: string;
  arquivo: File;
  nome: string;
  tipo: TipoAnexo;
  mime: string;
}

function normalizarBusca(v: string) {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}


const ITEM_VAZIO: PlanoItem = { ordem: 1, titulo: '', descricao: '', obrigatorio: true, ativo: true, anexosPend: [], anexosSalvos: [] };

function criarItensVazios(qtd: number) {
  return Array.from({ length: qtd }, (_, i) => ({ ...ITEM_VAZIO, ordem: i + 1 }));
}

function tipoAnexo(nome: string, mime?: string): TipoAnexo {
  const ext = nome.split('.').pop()?.toLowerCase() ?? '';
  if (mime?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext) || mime?.includes('word')) return 'word';
  return 'outro';
}

function nomeArquivoSeguro(nome: string) {
  const limpo = String(nome || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return limpo || 'arquivo';
}

function novaChaveAnexo() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function FormativosAdminScreen() {
  const corCabecalho = useCorCabecalho();
  const cores = useCores();
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const permissoes = usePermissoes();
  const clubeId = getClubeAtivoId();
  const programaId = getProgramaAtivoId();
  const podeGerenciar = permissoes.pode('admin_plataforma')
    || permissoes.pode('admin_clube')
    || (permissoes.pode('gerenciar_documentos') && permissoes.pode('ver_relatorios'));
  const podeConfigurarRanking = permissoes.temPerfil(['admin_ti', 'admin_clube']);
  // Mestrados (regras no banco): menu e página só para o ADMIN TI.
  const ehAdminTi = permissoes.temPerfil(['admin_ti']);

  const [loading, setLoading] = useState(false);
  const [menuModelosAberto, setMenuModelosAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoItem>('especialidade');
  const [busca, setBusca] = useState('');
  const [buscaCatalogo, setBuscaCatalogo] = useState('');
  const [classes, setClasses] = useState<ClasseModelo[]>([]);
  const [especialidades, setEspecialidades] = useState<EspecialidadeModelo[]>([]);
  const [planos, setPlanos] = useState<PlanoFormativo[]>([]);
  const [itensPorPlano, setItensPorPlano] = useState<Record<number, PlanoItem[]>>({});
  const [anexosPorPlano, setAnexosPorPlano] = useState<Record<number, PlanoAnexo[]>>({});

  const [modalPlano, setModalPlano] = useState(false);
  const [editando, setEditando] = useState<PlanoFormativo | null>(null);
  const [formTipo, setFormTipo] = useState<TipoItem>('especialidade');
  const [formItemNome, setFormItemNome] = useState('');
  const [formBuscaItem, setFormBuscaItem] = useState('');
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formItens, setFormItens] = useState<PlanoItem[]>(criarItensVazios(1));
  const [itemTituloErro, setItemTituloErro] = useState<number | null>(null);
  const [formModoItens, setFormModoItens] = useState<ModoItens>('manual');
  const [loteTexto, setLoteTexto] = useState('');
  const [loteProcessado, setLoteProcessado] = useState(false);
  const [anexosModeloPend, setAnexosModeloPend] = useState<AnexoPendente[]>([]);
  const [anexosModeloSalvos, setAnexosModeloSalvos] = useState<PlanoAnexo[]>([]);
  const [etapaAberta, setEtapaAberta] = useState(2);
  const [itemAberto, setItemAberto] = useState(0);

  const [modalComparacao, setModalComparacao] = useState(false);
  const [salvandoNovaVersao, setSalvandoNovaVersao] = useState(false);
  const itensVisiveis = formItens;
  const itemEmDestaque = useMemo(() => {
    const primeiroVazioVisivel = itensVisiveis.findIndex((item) => !item.titulo.trim());
    return primeiroVazioVisivel >= 0 ? primeiroVazioVisivel : Math.max(0, itensVisiveis.length - 1);
  }, [itensVisiveis]);
  const etapa2Completa = Boolean(formItemNome.trim());
  const etapa3Completa = Boolean(formTitulo.trim());
  const mostrarEtapa3 = etapa2Completa;
  const mostrarEtapa4 = etapa2Completa && etapa3Completa;

  useEffect(() => {
    if (!modalPlano) return;
    if (!mostrarEtapa3 && etapaAberta > 2) setEtapaAberta(2);
    else if (!mostrarEtapa4 && etapaAberta > 3) setEtapaAberta(3);
  }, [modalPlano, mostrarEtapa3, mostrarEtapa4, etapaAberta]);

  useFocusEffect(useCallback(() => {
    carregar();
  }, [clubeId, programaId]));

  async function carregar() {
    setLoading(true);
    try {
      const [classesData, especialidadesData, planosRes] = await Promise.all([
        carregarClassesModelo(),
        carregarEspecialidadesModelo({ limite: 600 }),
        supabase
          .from('planos_formativos')
          .select('id,clube_id,tipo,item_nome,titulo,descricao,avaliacoes_necessarias,ativo,modelo_padrao')
          .eq('clube_id', clubeId)
          .eq('ativo', true)
          .eq('modelo_padrao', true)
          .order('updated_at', { ascending: false }),
      ]);
      if (planosRes.error) throw planosRes.error;
      const planosCarregados = (planosRes.data ?? []) as PlanoFormativo[];
      setClasses(classesData);
      setEspecialidades(especialidadesData);
      setPlanos(planosCarregados);

      if (planosCarregados.length) {
        const [{ data, error }, anexosRes] = await Promise.all([
          supabase
          .from('planos_formativos_itens')
          .select('id,plano_formativo_id,clube_id,ordem,titulo,descricao,obrigatorio,ativo')
          .eq('clube_id', clubeId)
          .in('plano_formativo_id', planosCarregados.map((p) => p.id))
          .eq('ativo', true)
          .order('ordem'),
          supabase
            .from('planos_formativos_anexos')
            .select('id,plano_formativo_id,plano_formativo_item_id,clube_id,escopo,item_ordem,nome,url,tipo')
            .eq('clube_id', clubeId)
            .in('plano_formativo_id', planosCarregados.map((p) => p.id)),
        ]);
        if (error && error.code !== '42P01') throw error;
        if (anexosRes.error && anexosRes.error.code !== '42P01') throw anexosRes.error;
        const porPlano: Record<number, PlanoItem[]> = {};
        const anexosPlano: Record<number, PlanoAnexo[]> = {};
        for (const anexo of (anexosRes.data ?? []) as PlanoAnexo[]) {
          const planoId = Number(anexo.plano_formativo_id);
          if (!anexosPlano[planoId]) anexosPlano[planoId] = [];
          anexosPlano[planoId].push(anexo);
        }
        for (const item of (data ?? []) as PlanoItem[]) {
          const planoId = Number(item.plano_formativo_id);
          if (!porPlano[planoId]) porPlano[planoId] = [];
          const anexosItem = (anexosPlano[planoId] ?? []).filter((a) =>
            a.escopo === 'item'
            && (Number(a.plano_formativo_item_id) === Number(item.id) || Number(a.item_ordem) === Number(item.ordem))
          );
          porPlano[planoId].push({ ...item, descricao: item.descricao ?? '', anexosPend: [], anexosSalvos: anexosItem });
        }
        setItensPorPlano(porPlano);
        setAnexosPorPlano(anexosPlano);
      } else {
        setItensPorPlano({});
        setAnexosPorPlano({});
      }
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível carregar os modelos formativos.', 'erro', 'Erro');
    } finally {
      setLoading(false);
    }
  }

  const catalogo = useMemo(() => {
    if (formTipo === 'classe') {
      return classes.map((c, i) => ({ id: String(c.id ?? c.nome), nome: c.nome, detalhe: c.tipo ?? `Classe ${i + 1}` }));
    }
    return especialidades.map((e) => ({ id: e.id, nome: e.nome, detalhe: e.categoria ?? e.area ?? e.codigo ?? 'Especialidade' }));
  }, [formTipo, classes, especialidades]);

  const catalogoFiltrado = useMemo(() => {
    const q = normalizarBusca(formBuscaItem);
    return catalogo
      .filter((item) => !q || normalizarBusca(`${item.nome} ${item.detalhe ?? ''}`).includes(q))
      .slice(0, 30);
  }, [catalogo, formBuscaItem]);

  const planosFiltrados = useMemo(() => {
    const q = normalizarBusca(busca);
    return planos
      .filter((p) => p.tipo === tipo)
      .filter((p) => !q || normalizarBusca(`${p.titulo} ${p.item_nome}`).includes(q));
  }, [planos, tipo, busca]);

  function abrirNovoPlano() {
    setEditando(null);
    setFormTipo(tipo);
    setFormItemNome('');
    setFormBuscaItem('');
    setCatalogoAberto(false);
    setFormTitulo('');
    setFormDescricao('');
    setFormItens(criarItensVazios(1));
    setItemTituloErro(null);
    setFormModoItens('manual');
    setLoteTexto('');
    setLoteProcessado(false);
    setAnexosModeloPend([]);
    setAnexosModeloSalvos([]);
    setEtapaAberta(2);
    setItemAberto(0);
    setModalPlano(true);
  }

  function abrirEditarPlano(plano: PlanoFormativo) {
    const itens = itensPorPlano[plano.id] ?? [];
    const anexos = anexosPorPlano[plano.id] ?? [];
    setEditando(plano);
    setFormTipo(plano.tipo);
    setFormItemNome(plano.item_nome);
    setFormBuscaItem(plano.item_nome);
    setCatalogoAberto(false);
    setFormTitulo(plano.titulo);
    setFormDescricao(plano.descricao ?? '');
    setFormItens(itens.length ? itens.map((i, idx) => ({
      ...i,
      ordem: idx + 1,
      descricao: i.descricao ?? '',
      anexosPend: [],
      anexosSalvos: i.anexosSalvos ?? [],
    })) : criarItensVazios(1));
    setItemTituloErro(null);
    setFormModoItens('manual');
    setLoteTexto('');
    setLoteProcessado(false);
    setAnexosModeloPend([]);
    setAnexosModeloSalvos(anexos.filter((a) => a.escopo === 'modelo'));
    setEtapaAberta(2);
    setItemAberto(0);
    setModalPlano(true);
  }

  function atualizarItemModelo(indice: number, patch: Partial<PlanoItem>) {
    if (patch.titulo !== undefined && itemTituloErro === indice && patch.titulo.trim()) setItemTituloErro(null);
    setFormItens((prev) => {
      const prox = prev.map((item, i) => i === indice ? { ...item, ...patch } : item);
      return prox.map((item, i) => ({ ...item, ordem: i + 1 }));
    });
  }

  function adicionarItemModelo() {
    setFormItens((prev) => {
      const prox = [...prev, { ...ITEM_VAZIO, ordem: prev.length + 1 }];
      setItemAberto(prox.length - 1);
      return prox;
    });
  }

  function removerItemModelo(indice: number) {
    setFormItens((prev) => {
      const prox = prev.filter((_, i) => i !== indice);
      while (prox.length < 1) prox.push({ ...ITEM_VAZIO });
      setItemAberto((atual) => Math.max(0, Math.min(atual >= indice ? atual - 1 : atual, prox.length - 1)));
      return prox.map((item, i) => ({ ...item, ordem: i + 1 }));
    });
  }

  function escolherArquivos(onFiles: (anexos: AnexoPendente[]) => void) {
    if (typeof document === 'undefined') {
      avisar('Seleção de anexos disponível na versão web.', 'info', 'Aviso');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      const anexos = files.map((arquivo) => ({
        chave: novaChaveAnexo(),
        arquivo,
        nome: arquivo.name,
        mime: arquivo.type || 'application/octet-stream',
        tipo: tipoAnexo(arquivo.name, arquivo.type),
      }));
      onFiles(anexos);
    };
    input.click();
  }

  function adicionarAnexosModelo() {
    escolherArquivos((anexos) => setAnexosModeloPend((prev) => [...prev, ...anexos]));
  }

  function adicionarAnexosItem(indice: number) {
    escolherArquivos((anexos) => {
      setFormItens((prev) => prev.map((item, i) => i === indice
        ? { ...item, anexosPend: [...(item.anexosPend ?? []), ...anexos] }
        : item
      ));
    });
  }

  function removerAnexoModelo(chave: string) {
    setAnexosModeloPend((prev) => prev.filter((a) => a.chave !== chave));
  }

  function removerAnexoItem(indice: number, chave: string) {
    setFormItens((prev) => prev.map((item, i) => i === indice
      ? { ...item, anexosPend: (item.anexosPend ?? []).filter((a) => a.chave !== chave) }
      : item
    ));
  }

  function aplicarLoteItens() {
    const linhas = loteTexto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!linhas.length) {
      avisar('Digite ao menos uma linha no formato: item; Descrição', 'info', 'Atenção');
      return;
    }
    const itens = linhas.map((linha, idx) => {
      const [tituloParte, ...descricaoPartes] = linha.split(';');
      const titulo = (tituloParte ?? '').trim();
      const descricao = descricaoPartes.join(';').trim();
      return { ...ITEM_VAZIO, ordem: idx + 1, titulo, descricao, anexosPend: [], anexosSalvos: [] };
    });
    const semTitulo = itens.findIndex((item) => !item.titulo);
    if (semTitulo >= 0) {
      avisar(`A linha ${semTitulo + 1} está sem título antes do ";".`, 'info', 'Atenção');
      return;
    }
    setFormItens(itens);
    setLoteProcessado(true);
    setFormModoItens('manual');
    setItemTituloErro(null);
    setItemAberto(0);
  }

  async function uploadAnexoFormativo(planoId: number, arquivo: AnexoPendente) {
    const path = `formativos/${clubeId}/${planoId}/${arquivo.chave}_${nomeArquivoSeguro(arquivo.nome)}`;
    const corpo = ehImagemComprimivel(arquivo.mime) ? await comprimirBlobWeb(arquivo.arquivo) : arquivo.arquivo;
    return await enviarArquivo('atividades', path, corpo, { upsert: true, contentType: arquivo.mime || 'application/octet-stream' });
  }

  function itensValidosDoFormulario() {
    return formItens
      .map((item, idx) => ({ ...item, ordem: idx + 1, titulo: item.titulo.trim(), descricao: item.descricao.trim() }))
      .filter((item) => item.titulo);
  }

  function validarFormularioPlano() {
    const itemNome = formItemNome.trim();
    const titulo = formTitulo.trim();
    const primeiroSemTitulo = itensVisiveis.findIndex((item) => !item.titulo.trim());
    const itensValidos = itensValidosDoFormulario();

    if (!itemNome) return avisar('Selecione a classe ou especialidade.', 'info', 'Atenção');
    if (!titulo) return avisar('Informe o nome do modelo.', 'info', 'Atenção');
    if (primeiroSemTitulo >= 0) {
      setItemTituloErro(primeiroSemTitulo);
      return avisar(`Informe o título do item ${primeiroSemTitulo + 1}.`, 'info', 'Atenção');
    }
    if (!itensValidos.length) return avisar('Cadastre ao menos um item/atividade do modelo.', 'info', 'Atenção');
    return { itemNome, titulo, itensValidos };
  }

  async function planoEstaEmUso(planoId: number) {
    const [atividades, investidura, especialidades] = await Promise.all([
      supabase.from('atividades').select('id', { count: 'exact', head: true }).eq('clube_id', clubeId).eq('plano_formativo_id', planoId),
      supabase.from('investidura_itens').select('id', { count: 'exact', head: true }).eq('clube_id', clubeId).eq('plano_formativo_id', planoId),
      supabase.from('especialidades').select('id', { count: 'exact', head: true }).eq('clube_id', clubeId).eq('plano_formativo_id', planoId),
    ]);
    if (atividades.error) throw atividades.error;
    if (investidura.error) throw investidura.error;
    if (especialidades.error) throw especialidades.error;
    return (atividades.count ?? 0) + (investidura.count ?? 0) + (especialidades.count ?? 0) > 0;
  }

  async function persistirPlano(criarNovaVersao: boolean) {
    const validado = validarFormularioPlano();
    if (!validado) return;
    const { itemNome, titulo, itensValidos } = validado;
    setLoading(true);
    try {
      const payload = {
        clube_id: clubeId,
        tipo: formTipo,
        item_nome: itemNome,
        titulo,
        descricao: formDescricao.trim() || null,
        avaliacoes_necessarias: itensValidos.length,
        modelo_padrao: true,
        ativo: true,
        criado_por: usuario?.id ?? null,
        updated_at: new Date().toISOString(),
      };

      let planoId = criarNovaVersao ? null : (editando?.id ?? null);
      if (criarNovaVersao && editando?.id) {
        const { error: oldError } = await supabase
          .from('planos_formativos')
          .update({ modelo_padrao: false, updated_at: new Date().toISOString() })
          .eq('id', editando.id)
          .eq('clube_id', clubeId);
        if (oldError) throw oldError;
      }

      if (planoId) {
        const { error } = await supabase.from('planos_formativos').update(payload).eq('id', planoId).eq('clube_id', clubeId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('planos_formativos')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        planoId = Number(data.id);
      }

      const { error: delError } = await supabase
        .from('planos_formativos_itens')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('plano_formativo_id', planoId)
        .eq('clube_id', clubeId);
      if (delError && delError.code !== '42P01') throw delError;

      if (planoId) {
        const { error: anexosDelError } = await supabase
          .from('planos_formativos_anexos')
          .delete()
          .eq('plano_formativo_id', planoId)
          .eq('clube_id', clubeId);
        if (anexosDelError && anexosDelError.code !== '42P01') throw anexosDelError;
      }

      const { data: itensCriados, error: itensError } = await supabase.from('planos_formativos_itens').insert(
        itensValidos.map((item) => ({
          plano_formativo_id: planoId,
          clube_id: clubeId,
          ordem: item.ordem,
          titulo: item.titulo,
          descricao: item.descricao || null,
          obrigatorio: item.obrigatorio,
          ativo: true,
        }))
      ).select('id,ordem');
      if (itensError) throw itensError;

      const anexosParaInserir: Array<Omit<PlanoAnexo, 'id'>> = [];
      for (const anexo of anexosModeloSalvos) {
        anexosParaInserir.push({
          plano_formativo_id: planoId!,
          plano_formativo_item_id: null,
          clube_id: clubeId,
          escopo: 'modelo',
          item_ordem: null,
          nome: anexo.nome,
          url: anexo.url,
          tipo: anexo.tipo,
        });
      }
      for (const anexo of anexosModeloPend) {
        const url = await uploadAnexoFormativo(planoId!, anexo);
        anexosParaInserir.push({
          plano_formativo_id: planoId!,
          plano_formativo_item_id: null,
          clube_id: clubeId,
          escopo: 'modelo',
          item_ordem: null,
          nome: anexo.nome,
          url,
          tipo: anexo.tipo,
        });
      }

      const idsPorOrdem = new Map<number, number>();
      for (const item of (itensCriados ?? []) as Array<{ id: number; ordem: number }>) idsPorOrdem.set(Number(item.ordem), Number(item.id));
      for (const item of itensValidos) {
        const itemId = idsPorOrdem.get(Number(item.ordem)) ?? null;
        for (const anexo of item.anexosSalvos ?? []) {
          anexosParaInserir.push({
            plano_formativo_id: planoId!,
            plano_formativo_item_id: itemId,
            clube_id: clubeId,
            escopo: 'item',
            item_ordem: item.ordem,
            nome: anexo.nome,
            url: anexo.url,
            tipo: anexo.tipo,
          });
        }
        for (const anexo of item.anexosPend ?? []) {
          const url = await uploadAnexoFormativo(planoId!, anexo);
          anexosParaInserir.push({
            plano_formativo_id: planoId!,
            plano_formativo_item_id: itemId,
            clube_id: clubeId,
            escopo: 'item',
            item_ordem: item.ordem,
            nome: anexo.nome,
            url,
            tipo: anexo.tipo,
          });
        }
      }

      if (anexosParaInserir.length) {
        const { error: anexosError } = await supabase.from('planos_formativos_anexos').insert(anexosParaInserir);
        if (anexosError) throw anexosError;
      }

      setModalPlano(false);
      setModalComparacao(false);
      await carregar();
      avisar(criarNovaVersao
        ? 'Nova versão salva como padrão. A versão anterior foi preservada apenas para histórico.'
        : 'Modelo formativo atualizado.', 'sucesso', 'Salvo');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar o modelo.', 'erro', 'Erro');
    } finally {
      setLoading(false);
      setSalvandoNovaVersao(false);
    }
  }

  async function salvarPlano() {
    const validado = validarFormularioPlano();
    if (!validado) return;
    if (editando?.id) {
      setLoading(true);
      try {
        const emUso = await planoEstaEmUso(editando.id);
        if (emUso) {
          setModalComparacao(true);
          return;
        }
      } catch (e: any) {
        avisar(e?.message ?? 'Não foi possível verificar se este modelo já foi usado.', 'erro', 'Erro');
        return;
      } finally {
        setLoading(false);
      }
    }
    await persistirPlano(false);
  }

  async function salvarComoNovaVersaoPadrao() {
    setSalvandoNovaVersao(true);
    await persistirPlano(true);
  }

  async function excluirPlano(plano: PlanoFormativo) {
    const ok = await confirmar('Excluir modelo', `Remover o modelo "${plano.titulo}"? As atividades antigas continuam preservadas.`);
    if (!ok) return;
    const { error } = await supabase
      .from('planos_formativos')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', plano.id)
      .eq('clube_id', clubeId);
    if (error) return avisar(error.message, 'erro', 'Erro');
    await carregar();
  }

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeGerenciar) return <Redirect href="/" />;

  return (
    <View style={[s.container, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Modelos do Clube" />

      <View style={s.modeloSelectWrap}>
        <TouchableOpacity
          style={[s.modeloSelectBtn, { backgroundColor: cores.cartao, borderColor: cores.borda }]}
          onPress={() => setMenuModelosAberto(true)}
        >
          <Ionicons name="school-outline" size={17} color={corIcone(cores)} />
          <Text style={[s.modeloSelectText, { color: cores.texto }]}>Formativos</Text>
          <Ionicons name="chevron-down" size={18} color={corIcone(cores)} />
        </TouchableOpacity>
      </View>

      <Modal visible={menuModelosAberto} transparent animationType="fade" onRequestClose={() => setMenuModelosAberto(false)}>
        <TouchableOpacity
          style={[s.modeloDropdownOverlay, { backgroundColor: cores.overlay }]}
          activeOpacity={1}
          onPress={() => setMenuModelosAberto(false)}
        >
          <View style={[s.modeloDropdownMenu, { backgroundColor: cores.cartao }]}>
            {[
              { aba: 'pontuacao', label: 'Pontuação', icon: 'checkmark-circle-outline' },
              { aba: 'documentos', label: 'Documentos', icon: 'document-text-outline' },
              { aba: 'config', label: 'Faltas', icon: 'calendar-outline' },
              ...(podeConfigurarRanking ? [
                { aba: 'ranking', label: 'Ranking', icon: 'trophy-outline' },
                { aba: 'clube', label: 'Clube', icon: 'image-outline' },
              ] : []),
              ...(ehAdminTi ? [{ aba: 'mestrados', label: 'Mestrados', icon: 'ribbon-outline' }] : []),
            ].map((item) => (
              <TouchableOpacity
                key={item.aba}
                style={s.modeloDropdownItem}
                onPress={() => {
                  setMenuModelosAberto(false);
                  if (item.aba === 'mestrados') { router.push('/admin/mestrados' as any); return; }
                  router.replace({ pathname: '/admin/modelos', params: { aba: item.aba } } as any);
                }}
              >
                <Ionicons name={item.icon as any} size={17} color={cores.textoSecundario} />
                <Text style={[s.modeloDropdownText, { color: cores.textoSecundario }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.modeloDropdownItem, { backgroundColor: cores.input }]} onPress={() => setMenuModelosAberto(false)}>
              <Ionicons name="school-outline" size={17} color={corIcone(cores)} />
              <Text style={[s.modeloDropdownText, { color: cores.texto }]}>Formativos</Text>
              <Ionicons name="checkmark" size={16} color={corIcone(cores)} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Esta tela cuida apenas dos modelos formativos (quantas avaliações um
          item exige). Cadastro e edição de especialidades e classes vivem
          exclusivamente nos menus Especialidades e Classes. */}
      <View style={s.actions}>
        <TouchableOpacity style={s.primaryBtn} onPress={abrirNovoPlano}>
          <Ionicons name="add-circle" size={18} color="#fff" />
          <Text style={s.primaryText}>Novo modelo</Text>
        </TouchableOpacity>
        {ehAdminTi ? (
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.push('/admin/mestrados' as any)} accessibilityRole="button">
            <Ionicons name="ribbon" size={18} color="#fff" />
            <Text style={s.primaryText}>Mestrados</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={s.tabs}>
        <Chip rotulo="Especialidades" ativo={!!(tipo === 'especialidade')} onPress={() => setTipo('especialidade')} />
        <Chip rotulo="Classes" ativo={!!(tipo === 'classe')} onPress={() => setTipo('classe')} />
      </View>

      <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 8 }}>
        <CampoBusca valor={busca} onChange={setBusca} placeholder="Buscar modelo ou item..." />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {planosFiltrados.map((plano) => {
            const itens = itensPorPlano[plano.id] ?? [];
            return (
              <View key={plano.id} style={[s.card, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.itemNome, cores.isEscuro && { color: '#9cc2ff' }, { color: tomTexto('#1976d2', cores) }]}>{plano.item_nome}</Text>
                    <Text style={[s.cardTitle, cores.isEscuro && { color: '#a6afb8' }, { color: cores.texto }]}>{plano.titulo}</Text>
                    {plano.descricao ? <Text style={[s.cardDesc, cores.isEscuro && { color: '#a8b1b9' }, { color: cores.textoSecundario }]}>{plano.descricao}</Text> : null}
                  </View>
                  <View style={[s.countBadge, cores.isEscuro && { backgroundColor: '#1d1932' }]}>
                    <Text style={[s.countText, cores.isEscuro && { color: '#7fdc98' }]}>{itens.length || plano.avaliacoes_necessarias}</Text>
                    <Text style={[s.countSub, cores.isEscuro && { color: '#7fdc98' }]}>itens</Text>
                  </View>
                </View>
                <View style={[s.progressTrack, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
                  <View style={[s.progressFill, { width: `${Math.min(100, ((itens.length || plano.avaliacoes_necessarias) / Math.max(1, plano.avaliacoes_necessarias)) * 100)}%` }]} />
                </View>
                {itens.slice(0, 3).map((item) => (
                  <Text key={item.id ?? `${plano.id}-${item.ordem}`} style={[s.itemLinha, cores.isEscuro && { color: '#a7b1b9' }, { color: cores.texto }]}>
                    {item.ordem}. {item.titulo}
                  </Text>
                ))}
                {itens.length > 3 ? <Text style={[s.maisItens, cores.isEscuro && { color: '#c0c6d0' }, { color: cores.textoSecundario }]}>+ {itens.length - 3} item(ns)</Text> : null}
                <View style={s.cardActions}>
                  <TouchableOpacity style={[s.smallBtn, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]} onPress={() => abrirEditarPlano(plano)}>
                    <Ionicons name="create-outline" size={17} color={corIcone(cores)} />
                    <Text style={[s.smallText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.smallBtn, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }, s.dangerBtn, cores.isEscuro && { backgroundColor: '#3a1c24' }]} onPress={() => excluirPlano(plano)}>
                    <Ionicons name="trash-outline" size={17} color={tomTexto('#c62828', cores)} />
                    <Text style={[s.dangerText, cores.isEscuro && { color: '#ff9b9b' }]}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          {planosFiltrados.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="school-outline" size={46} color="#b7c3ce" />
              <EstadoVazio titulo="Nenhum modelo cadastrado para este filtro." />
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={modalPlano} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalPlano(false)}>
        <View style={[s.modal, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
          <View style={[s.modalHeader, cores.isEscuro && { borderColor: '#322c52' }, { borderColor: cores.borda }]}>
            <TouchableOpacity onPress={() => setModalPlano(false)}>
              <Ionicons name="close" size={25} color={cores.texto} />
            </TouchableOpacity>
            <Text style={[s.modalTitle, cores.isEscuro && { color: '#a6afb8' }, { color: cores.texto }]}>{editando ? 'Editar modelo' : 'Novo modelo'}</Text>
            <TouchableOpacity onPress={salvarPlano}>
              <Text style={[s.saveText]}>Salvar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={[s.stepCard, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
              <TouchableOpacity style={s.stepHeader} onPress={() => setEtapaAberta(etapaAberta === 1 ? 2 : 1)}>
                <View style={s.stepNumber}><Text style={s.stepNumberText}>1</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.stepTitle, cores.isEscuro && { color: '#a6afb8' }, { color: cores.texto }]}>Tipo do modelo</Text>
                  <Text style={[s.stepSub, cores.isEscuro && { color: '#aab3c0' }, { color: cores.textoSecundario }]}>{formTipo === 'classe' ? 'Classe' : 'Especialidade'}</Text>
                </View>
                <Ionicons name={etapaAberta === 1 ? 'chevron-up' : 'chevron-down'} size={18} color={cores.textoSecundario} />
              </TouchableOpacity>
              {etapaAberta === 1 ? <View style={s.chips}>
                {(['especialidade', 'classe'] as TipoItem[]).map((t) => (
                  <Chip key={t} rotulo={t === 'classe' ? 'Classe' : 'Especialidade'} ativo={!!(formTipo === t)} onPress={() => {
                      setFormTipo(t);
                      setFormItemNome('');
                      setFormBuscaItem('');
                      setCatalogoAberto(false);
                      setEtapaAberta(2);
                    }} />
                ))}
              </View> : null}
            </View>

            <View style={[s.stepCard, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
              <TouchableOpacity style={s.stepHeader} onPress={() => setEtapaAberta(etapaAberta === 2 ? 1 : 2)}>
                <View style={s.stepNumber}><Text style={s.stepNumberText}>2</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.stepTitle, cores.isEscuro && { color: '#a6afb8' }, { color: cores.texto }]}>Vínculo formativo</Text>
                  <Text style={[s.stepSub, cores.isEscuro && { color: '#aab3c0' }, { color: cores.textoSecundario }]}>{formItemNome.trim() || 'Busque a especialidade ou classe que este modelo vai liberar.'}</Text>
                </View>
                <Ionicons name={etapaAberta === 2 ? 'chevron-up' : 'chevron-down'} size={18} color={cores.textoSecundario} />
              </TouchableOpacity>
              {etapaAberta === 2 ? <>
              <TextInput
                style={[s.input, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda, color: cores.texto }]}
                value={formBuscaItem}
                onFocus={() => setCatalogoAberto(formBuscaItem.trim() !== formItemNome.trim())}
                onBlur={() => {
                  if (formItemNome.trim()) setEtapaAberta(3);
                }}
                onChangeText={(v) => {
                  setFormBuscaItem(v);
                  setFormItemNome(v);
                  setCatalogoAberto(true);
                }}
                placeholder="Buscar ou digitar item..."
                placeholderTextColor={cores.placeholder}
              />
              {catalogoAberto && formBuscaItem.trim() ? (
                <ScrollView style={s.optionList} contentContainerStyle={s.optionListContent} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {catalogoFiltrado.map((item) => {
                    const ativo = formItemNome === item.nome;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[s.option, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.fundo, borderColor: cores.borda }, ativo && s.optionAtiva]}
                        onPress={() => {
                          setFormItemNome(item.nome);
                          setFormBuscaItem(item.nome);
                          setCatalogoAberto(false);
                          if (!formTitulo.trim()) setFormTitulo(`${item.nome} - ${new Date().getFullYear()}`);
                          setEtapaAberta(3);
                        }}
                      >
                        <Text style={[s.optionTitle, cores.isEscuro && { color: '#a9b0b6' }, { color: cores.texto }, ativo && s.optionTitleAtivo]}>{item.nome}</Text>
                        <Text style={[s.optionSub, cores.isEscuro && { color: '#c0c6d0' }, { color: cores.textoSecundario }, ativo && s.optionSubAtivo]}>{item.detalhe}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : null}
              </> : null}
            </View>

            {mostrarEtapa3 ? <View style={[s.stepCard, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
              <TouchableOpacity style={s.stepHeader} onPress={() => setEtapaAberta(etapaAberta === 3 ? 2 : 3)}>
                <View style={s.stepNumber}><Text style={s.stepNumberText}>3</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.stepTitle, cores.isEscuro && { color: '#a6afb8' }, { color: cores.texto }]}>Identificação do modelo</Text>
                  <Text style={[s.stepSub, cores.isEscuro && { color: '#aab3c0' }, { color: cores.textoSecundario }]}>{formTitulo.trim() || 'Nome e observação geral que aparecem para a diretoria.'}</Text>
                </View>
                <Ionicons name={etapaAberta === 3 ? 'chevron-up' : 'chevron-down'} size={18} color={cores.textoSecundario} />
              </TouchableOpacity>
              {etapaAberta === 3 ? <>
              <Text style={[s.labelCompact, cores.isEscuro && { color: '#aab3c0' }, { color: cores.textoSecundario }]}>Nome do modelo *</Text>
              <TextInput
                style={[s.input, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda, color: cores.texto }]}
                value={formTitulo}
                onChangeText={setFormTitulo}
                onBlur={() => {
                  if (formTitulo.trim()) setEtapaAberta(4);
                }}
                placeholder="Ex.: Computação IV - Investidura 2026"
                placeholderTextColor={cores.placeholder}
              />

              <Text style={[s.labelCompact, cores.isEscuro && { color: '#aab3c0' }, { color: cores.textoSecundario }]}>Descrição do modelo</Text>
              <TextInput style={[s.input, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, s.textArea, { backgroundColor: cores.cartao, borderColor: cores.borda, color: cores.texto }]} value={formDescricao} onChangeText={setFormDescricao} multiline placeholder="Observação geral para este padrão..." placeholderTextColor={cores.placeholder} />
              <View style={s.anexosHeader}>
                <Text style={[s.labelCompact, cores.isEscuro && { color: '#aab3c0' }, { color: cores.textoSecundario }]}>Anexos do modelo</Text>
                <TouchableOpacity style={[s.attachBtn, cores.isEscuro && { backgroundColor: '#3e3a4b' }, { backgroundColor: cores.fundo }]} onPress={adicionarAnexosModelo}>
                  <Ionicons name="attach" size={15} color={corIcone(cores)} />
                  <Text style={[s.attachText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Anexar</Text>
                </TouchableOpacity>
              </View>
              {[...anexosModeloSalvos, ...anexosModeloPend].map((anexo: any) => (
                <View key={anexo.id ? `salvo-${anexo.id}` : anexo.chave} style={[s.anexoLinha, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
                  <Ionicons name="document-attach-outline" size={15} color={corIcone(cores)} />
                  <Text style={[s.anexoNome, cores.isEscuro && { color: '#a7b3bd' }, { color: cores.texto }]} numberOfLines={1}>{anexo.nome}</Text>
                  {!anexo.id ? (
                    <TouchableOpacity onPress={() => removerAnexoModelo(anexo.chave)}>
                      <Ionicons name="close" size={17} color={tomTexto('#c62828', cores)} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              </> : null}
            </View> : null}

            {mostrarEtapa4 ? <View style={[s.stepCard, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
              <TouchableOpacity style={s.stepHeader} onPress={() => setEtapaAberta(etapaAberta === 4 ? 3 : 4)}>
                <View style={s.stepNumber}><Text style={s.stepNumberText}>4</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.stepTitle, cores.isEscuro && { color: '#a6afb8' }, { color: cores.texto }]}>Itens avaliativos</Text>
                  <Text style={[s.stepSub, cores.isEscuro && { color: '#aab3c0' }, { color: cores.textoSecundario }]}>{itensValidosDoFormulario().length || 0} item(ns) preenchido(s)</Text>
                </View>
                <Ionicons name={etapaAberta === 4 ? 'chevron-up' : 'chevron-down'} size={18} color={cores.textoSecundario} />
              </TouchableOpacity>
              {etapaAberta === 4 ? <>

              <View style={s.modoBox}>
                {(['manual', 'lote'] as ModoItens[]).map((modo) => (
                  <Chip key={modo} rotulo={modo === 'manual' ? 'Manual' : 'Em lote'} ativo={!!(formModoItens === modo)} onPress={() => {
                      setFormModoItens(modo);
                      if (modo === 'lote') setLoteProcessado(false);
                    }} />
                ))}
              </View>

              {formModoItens === 'lote' && !loteProcessado ? (
                <View style={[s.loteBox, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }]}>
                  <Text style={[s.loteHelp, cores.isEscuro && { color: '#beae82' }, cores.isEscuro && { color: '#beae82' }]}>
                    Digite um item por linha. Separe título e descrição com ponto e vírgula: Título; Descrição
                  </Text>
                  <TextInput
                    style={[s.input, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, s.loteInput, { backgroundColor: cores.cartao, borderColor: cores.borda, color: cores.texto }]}
                    value={loteTexto}
                    onChangeText={setLoteTexto}
                    multiline
                    placeholder={'item 1; Descrição\nitem 2; Descrição\nitem 3; Descrição'}
                    placeholderTextColor={cores.placeholder}
                  />
                  <TouchableOpacity style={s.loteBtn} onPress={aplicarLoteItens}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={s.loteBtnText}>Salvar bloco de itens</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {(formModoItens === 'manual' || loteProcessado) && itensVisiveis.map((item, indice) => {
                const destacado = indice === itemEmDestaque;
                const aberto = indice === itemAberto;
                return (
                <View
                  key={`form-item-${indice}`}
                  style={[
                    s.itemFormCard,
                    { backgroundColor: cores.fundo, borderColor: cores.borda },
                    !destacado && [s.itemFormCardNeutro, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }],
                    destacado && aberto && [s.itemFormCardDestaque, cores.isEscuro && { backgroundColor: '#1d1932' }],
                    { borderLeftColor: destacado ? ['#1e88e5', '#43a047', '#fb8c00', '#8e24aa'][indice % 4] : '#c7d2de' },
                  ]}
                >
                  <TouchableOpacity style={s.itemFormTop} onPress={() => setItemAberto(aberto ? -1 : indice)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.itemFormTitle, cores.isEscuro && { color: '#a6afb8' }, { color: cores.texto }, !destacado && [s.itemFormTitleNeutro, cores.isEscuro && { color: '#a7b1b9' }]]}>Item {indice + 1}</Text>
                      <Text style={[s.itemResumo, cores.isEscuro && { color: '#a8b1b9' }, { color: cores.textoSecundario }]} numberOfLines={1}>{item.titulo.trim() || 'Ainda sem título'}</Text>
                      {destacado && aberto ? <Text style={[s.itemFormHint, cores.isEscuro && { color: '#cdae81' }, cores.isEscuro && { color: '#cdae81' }]}>Preencha este item agora</Text> : null}
                    </View>
                    <View style={s.itemActions}>
                      {indice === itensVisiveis.length - 1 ? (
                        <TouchableOpacity
                          style={[s.itemAddBtn, !item.titulo.trim() && [s.itemAddBtnDisabled, cores.isEscuro && { backgroundColor: '#1d1932' }]]}
                          disabled={!item.titulo.trim()}
                          onPress={adicionarItemModelo}
                        >
                          <Ionicons name="add" size={15} color={item.titulo.trim() ? '#fff' : '#9aa6b2'} />
                          <Text style={[s.itemAddText, !item.titulo.trim() && s.itemAddTextDisabled]}>
                            Adicionar
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {formItens.length > 1 ? (
                        <TouchableOpacity style={[s.itemTrashBtn, cores.isEscuro && { backgroundColor: '#413c49' }, cores.isEscuro && { backgroundColor: '#3a1c24' }]} onPress={() => removerItemModelo(indice)}>
                          <Ionicons name="trash-outline" size={17} color={tomTexto('#c62828', cores)} />
                        </TouchableOpacity>
                      ) : null}
                      <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={17} color={cores.textoSecundario} />
                    </View>
                  </TouchableOpacity>
                  {aberto ? <>
                  <TextInput
                    style={[s.itemInput, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda, color: cores.texto }, itemTituloErro === indice && [s.itemInputErro, cores.isEscuro && { backgroundColor: '#1d1932' }]]}
                    value={item.titulo}
                    onChangeText={(titulo) => atualizarItemModelo(indice, { titulo })}
                    placeholder={itemTituloErro === indice ? 'Título obrigatório' : 'Título do requisito/atividade'}
                    placeholderTextColor={cores.placeholder}
                  />
                  <TextInput
                    style={[s.itemInput, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, s.itemTextArea, { backgroundColor: cores.cartao, borderColor: cores.borda, color: cores.texto }]}
                    value={item.descricao}
                    onChangeText={(descricao) => atualizarItemModelo(indice, { descricao })}
                    multiline
                    placeholder="Descrição do que deve ser cumprido"
                    placeholderTextColor={cores.placeholder}
                  />
                  <View style={s.anexosHeader}>
                    <Text style={[s.itemAnexoLabel, cores.isEscuro && { color: '#aab3c0' }, { color: cores.textoSecundario }]}>Anexos do item</Text>
                    <TouchableOpacity style={[s.attachBtnMini, cores.isEscuro && { backgroundColor: '#3e3a4b' }, { backgroundColor: cores.fundo }]} onPress={() => adicionarAnexosItem(indice)}>
                      <Ionicons name="attach" size={14} color={corIcone(cores)} />
                      <Text style={[s.attachText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Anexar</Text>
                    </TouchableOpacity>
                  </View>
                  {[...(item.anexosSalvos ?? []), ...(item.anexosPend ?? [])].map((anexo: any) => (
                    <View key={anexo.id ? `salvo-${anexo.id}` : anexo.chave} style={[s.anexoLinha, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
                      <Ionicons name="document-attach-outline" size={15} color={corIcone(cores)} />
                      <Text style={[s.anexoNome, cores.isEscuro && { color: '#a7b3bd' }, { color: cores.texto }]} numberOfLines={1}>{anexo.nome}</Text>
                      {!anexo.id ? (
                        <TouchableOpacity onPress={() => removerAnexoItem(indice, anexo.chave)}>
                          <Ionicons name="close" size={17} color={tomTexto('#c62828', cores)} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                  </> : null}
                </View>
              );
              })}
              </> : null}
            </View> : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={modalComparacao} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalComparacao(false)}>
        <View style={[s.modal, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
          <View style={[s.modalHeader, cores.isEscuro && { borderColor: '#322c52' }, { borderColor: cores.borda }]}>
            <TouchableOpacity onPress={() => setModalComparacao(false)}>
              <Ionicons name="close" size={25} color={cores.texto} />
            </TouchableOpacity>
            <Text style={[s.modalTitle, cores.isEscuro && { color: '#a6afb8' }, { color: cores.texto }]}>Comparar versões</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={s.modalScroll}>
            <View style={[s.alertBox, cores.isEscuro && { backgroundColor: '#413e46', borderColor: '#322c52' }]}>
              <Ionicons name="git-branch-outline" size={22} color={tomTexto('#8a5a00', cores)} />
              <Text style={[s.alertText, cores.isEscuro && { color: '#bfb08f' }, cores.isEscuro && { color: '#bfb08f' }]}>
                Este modelo já foi usado. Salvar agora criará uma nova versão padrão. Atividades antigas e concluídas continuam usando o modelo anterior.
              </Text>
            </View>

            <View style={s.compareGrid}>
              <View style={[s.compareCol, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
                <Text style={[s.compareTitle, cores.isEscuro && { color: '#a6afb8' }, { color: cores.texto }]}>Modelo atual</Text>
                <Text style={[s.compareSub, cores.isEscuro && { color: '#a8b1b9' }, { color: cores.textoSecundario }]}>{editando?.titulo}</Text>
                {(editando ? itensPorPlano[editando.id] ?? [] : []).map((item, idx) => (
                  <View key={`old-${item.id ?? idx}`} style={[s.compareItemOld, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
                    <Text style={[s.compareItemTitle, cores.isEscuro && { color: '#a9b0b6' }, { color: cores.texto }]}>{idx + 1}. {item.titulo}</Text>
                    {item.descricao ? <Text style={[s.compareItemDesc, cores.isEscuro && { color: '#a6aeb8' }, { color: cores.textoSecundario }]}>{item.descricao}</Text> : null}
                  </View>
                ))}
              </View>

              <View style={[s.compareCol, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
                <Text style={[s.compareTitle, cores.isEscuro && { color: '#a6afb8' }, { color: cores.texto }]}>Nova versão</Text>
                <Text style={[s.compareSub, cores.isEscuro && { color: '#a8b1b9' }, { color: cores.textoSecundario }]}>{formTitulo}</Text>
                {itensValidosDoFormulario().map((item, idx) => (
                  <View key={`new-${idx}`} style={[s.compareItemNew, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
                    <Text style={[s.compareItemTitle, cores.isEscuro && { color: '#a9b0b6' }, { color: cores.texto }]}>{idx + 1}. {item.titulo}</Text>
                    {item.descricao ? <Text style={[s.compareItemDesc, cores.isEscuro && { color: '#a6aeb8' }, { color: cores.textoSecundario }]}>{item.descricao}</Text> : null}
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity style={s.saveVersionBtn} onPress={salvarComoNovaVersaoPadrao} disabled={salvandoNovaVersao}>
              {salvandoNovaVersao ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle" size={19} color="#fff" />
                  <Text style={s.saveVersionText}>Salvar nova versão como padrão</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancel} onPress={() => setModalComparacao(false)}>
              <Text style={[s.cancelText, cores.isEscuro && { color: '#c0c6d0' }]}>Voltar para edição</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#efeaf9' },
  header: { backgroundColor: '#7c39e7', paddingTop: 52, paddingHorizontal: 18, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 14 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 26, fontWeight: '900' },
  sub: { color: '#c9d8e8', fontSize: 14, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' },
  modeloSelectWrap: { marginHorizontal: 14, marginTop: 14, marginBottom: 0 },
  modeloSelectBtn: { minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  modeloSelectText: { flex: 1, fontWeight: '900', fontSize: 14 },
  modeloDropdownOverlay: { flex: 1, paddingTop: 150, paddingHorizontal: 16 },
  modeloDropdownMenu: { borderRadius: 14, paddingVertical: 8, overflow: 'hidden' },
  modeloDropdownItem: { minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  modeloDropdownText: { flex: 1, fontWeight: '700', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 14 },
  primaryBtn: { backgroundColor: '#7c39e7', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
  tab: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  tabAtiva: { backgroundColor: '#7c39e7' },
  tabText: { color: '#566473', fontWeight: '900' },
  tabTextAtivo: { color: '#fff' },
  searchBox: { margin: 14, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', minHeight: 52, borderWidth: 1, borderColor: '#d9e2ec' },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  content: { padding: 14, paddingBottom: 110, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#ddd5f0' },
  cardTop: { flexDirection: 'row', gap: 12 },
  itemNome: { color: '#1976d2', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  cardTitle: { color: '#102a43', fontWeight: '900', fontSize: 18, marginTop: 2 },
  cardDesc: { color: '#607080', marginTop: 6 },
  countBadge: { width: 58, height: 58, borderRadius: 12, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#2e7d32', fontSize: 20, fontWeight: '900' },
  countSub: { color: '#2e7d32', fontSize: 10, fontWeight: '800' },
  progressTrack: { height: 8, backgroundColor: '#edf2f7', borderRadius: 999, overflow: 'hidden', marginVertical: 12 },
  progressFill: { height: 8, backgroundColor: '#2e7d32' },
  itemLinha: { color: '#34495e', fontSize: 13, marginTop: 4 },
  maisItens: { color: '#7b8794', fontSize: 12, marginTop: 4, fontWeight: '800' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  smallBtn: { backgroundColor: '#f1f6fb', borderRadius: 22, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 6, alignItems: 'center' },
  smallText: { color: '#4b2bb0', fontWeight: '900' },
  dangerBtn: { backgroundColor: '#fff1f1' },
  dangerText: { color: '#c62828', fontWeight: '900' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#8a99a8', marginTop: 10 },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { paddingTop: 46, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: '#102a43', fontWeight: '900', fontSize: 18 },
  saveText: { color: '#4b2bb0', fontWeight: '900', fontSize: 16 },
  modalScroll: { padding: 12, paddingBottom: 80, gap: 10 },
  stepCard: { backgroundColor: '#f8fbfd', borderWidth: 1, borderColor: '#d7e0ea', borderRadius: 18, padding: 12 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stepNumber: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#7c39e7', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  stepTitle: { color: '#102a43', fontWeight: '900', fontSize: 15 },
  stepSub: { color: '#718096', fontSize: 12, marginTop: 2, lineHeight: 16 },
  label: { color: '#718096', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  labelCompact: { color: '#718096', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 8, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#d7e0ea', borderRadius: 16, paddingHorizontal: 12, minHeight: 48, fontSize: 15, backgroundColor: '#fff' },
  textArea: { minHeight: 92, textAlignVertical: 'top', paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#f1f6fb', borderWidth: 1, borderColor: '#d7e0ea', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  chipAtivo: { backgroundColor: '#7c39e7', borderColor: '#7c39e7' },
  chipText: { color: '#4d5b6a', fontWeight: '900' },
  chipTextAtivo: { color: '#fff' },
  optionList: { marginTop: 8, maxHeight: 210 },
  optionListContent: { gap: 8 },
  option: { borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 10, backgroundColor: '#f8fbfd' },
  optionAtiva: { backgroundColor: '#7c39e7', borderColor: '#7c39e7' },
  optionTitle: { color: '#1a2b3c', fontWeight: '900' },
  optionSub: { color: '#7b8794', fontSize: 12, marginTop: 2 },
  optionTitleAtivo: { color: '#fff' },
  optionSubAtivo: { color: '#dbeafe' },
  sectionHeader: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#102a43', fontSize: 16, fontWeight: '900' },
  addItemBtn: { backgroundColor: '#2e7d32', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addItemText: { color: '#fff', fontWeight: '900' },
  itemFormCard: { marginTop: 9, padding: 9, backgroundColor: '#f8fbfd', borderRadius: 18, borderWidth: 1, borderColor: '#ddd5f0', borderLeftWidth: 4 },
  itemFormCardNeutro: { backgroundColor: '#f4f7fa', borderColor: '#e2e8f0', opacity: 0.82 },
  itemFormCardDestaque: { backgroundColor: '#fffdf5', borderColor: '#f9b233', shadowColor: '#f9b233', elevation: 3 },
  itemFormTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemFormTitle: { color: '#102a43', fontWeight: '900', fontSize: 13 },
  itemFormTitleNeutro: { color: '#5f6f7f' },
  itemResumo: { color: '#607080', fontSize: 12, fontWeight: '700', marginTop: 2 },
  itemFormHint: { color: '#9a5b00', fontSize: 11, fontWeight: '800', marginTop: 2 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemAddBtn: { minHeight: 30, borderRadius: 18, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3, backgroundColor: '#2e7d32' },
  itemAddBtnDisabled: { backgroundColor: '#eef2f6' },
  itemAddText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  itemAddTextDisabled: { color: '#9aa6b2' },
  itemTrashBtn: { width: 30, height: 30, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f1' },
  itemInput: { borderWidth: 1, borderColor: '#d7e0ea', borderRadius: 18, paddingHorizontal: 10, minHeight: 38, fontSize: 14, backgroundColor: '#fff', marginTop: 5 },
  itemInputErro: { borderColor: '#d32f2f', backgroundColor: '#fff8f8' },
  itemTextArea: { minHeight: 58, textAlignVertical: 'top', paddingTop: 8 },
  modoBox: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  modoChip: { flex: 1, borderRadius: 999, backgroundColor: '#eef4f9', borderWidth: 1, borderColor: '#d7e0ea', paddingVertical: 9, alignItems: 'center' },
  modoChipAtivo: { backgroundColor: '#7c39e7', borderColor: '#7c39e7' },
  modoChipText: { color: '#4d5b6a', fontWeight: '900' },
  modoChipTextAtivo: { color: '#fff' },
  loteBox: { backgroundColor: '#fffdf5', borderWidth: 1, borderColor: '#ffe0a3', borderRadius: 18, padding: 10 },
  loteHelp: { color: '#7a5a00', fontSize: 12, fontWeight: '700', lineHeight: 17, marginBottom: 8 },
  loteInput: { minHeight: 150, textAlignVertical: 'top', paddingTop: 10 },
  loteBtn: { marginTop: 10, backgroundColor: '#2e7d32', borderRadius: 22, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loteBtnText: { color: '#fff', fontWeight: '900' },
  anexosHeader: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  attachBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#ece5fb', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  attachBtnMini: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ece5fb', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  attachText: { color: '#4b2bb0', fontWeight: '900', fontSize: 12 },
  itemAnexoLabel: { color: '#718096', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  anexoLinha: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#eef4f9', borderRadius: 18, paddingHorizontal: 9, paddingVertical: 7 },
  anexoNome: { flex: 1, color: '#334e68', fontWeight: '800', fontSize: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  cancel: { padding: 14, alignItems: 'center' },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 12 },
  cancelText: { color: '#7b8794', fontWeight: '900' },
  alertBox: { backgroundColor: '#fff8e1', borderWidth: 1, borderColor: '#ffe0a3', borderRadius: 18, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 14 },
  alertText: { color: '#6d4c00', flex: 1, fontWeight: '700', lineHeight: 19 },
  compareGrid: { flexDirection: 'row', gap: 10 },
  compareCol: { flex: 1, backgroundColor: '#f8fbfd', borderRadius: 12, borderWidth: 1, borderColor: '#ddd5f0', padding: 10 },
  compareTitle: { color: '#102a43', fontWeight: '900', fontSize: 16 },
  compareSub: { color: '#607080', fontSize: 12, marginTop: 2, marginBottom: 8 },
  compareItemOld: { backgroundColor: '#fff', borderRadius: 18, padding: 9, marginTop: 7, borderLeftWidth: 4, borderLeftColor: '#90a4ae' },
  compareItemNew: { backgroundColor: '#fff', borderRadius: 18, padding: 9, marginTop: 7, borderLeftWidth: 4, borderLeftColor: '#2e7d32' },
  compareItemTitle: { color: '#1a2b3c', fontWeight: '900', fontSize: 13 },
  compareItemDesc: { color: '#6b7a89', fontSize: 12, marginTop: 4 },
  saveVersionBtn: { marginTop: 16, backgroundColor: '#2e7d32', borderRadius: 22, padding: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveVersionText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
