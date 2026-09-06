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
import { getClubeAtivoId, getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';
import { avisar, confirmar } from '../../src/stores/avisoStore';
import {
  carregarClassesModelo,
  carregarEspecialidadesModelo,
  type ClasseModelo,
  type EspecialidadeModelo,
} from '../../src/lib/modelosPrograma';
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
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const permissoes = usePermissoes();
  const clubeId = getClubeAtivoId();
  const programaId = getProgramaAtivoId();
  const podeGerenciar = permissoes.pode('admin_plataforma')
    || permissoes.pode('admin_clube')
    || (permissoes.pode('gerenciar_documentos') && permissoes.pode('ver_relatorios'));

  const [loading, setLoading] = useState(false);
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
    const { data, error } = await supabase.storage
      .from('atividades')
      .upload(path, arquivo.arquivo, { upsert: true, contentType: arquivo.mime || 'application/octet-stream' });
    if (error) throw error;
    const url = supabase.storage.from('atividades').getPublicUrl(data.path).data.publicUrl;
    if (!url) throw new Error('Não foi possível gerar URL do anexo.');
    return url;
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
    <View style={s.container}>
      <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Modelos Formativos</Text>
          <Text style={s.sub}>{contextoAtivo?.clube_nome_curto ?? contextoAtivo?.clube_nome ?? 'Clube ativo'}</Text>
        </View>
        <TouchableOpacity onPress={carregar} style={s.iconBtn}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Esta tela cuida apenas dos modelos formativos (quantas avaliações um
          item exige). Cadastro e edição de especialidades e classes vivem
          exclusivamente nos menus Especialidades e Classes. */}
      <View style={s.actions}>
        <TouchableOpacity style={s.primaryBtn} onPress={abrirNovoPlano}>
          <Ionicons name="add-circle" size={18} color="#fff" />
          <Text style={s.primaryText}>Novo modelo</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tipo === 'especialidade' && s.tabAtiva]} onPress={() => setTipo('especialidade')}>
          <Text style={[s.tabText, tipo === 'especialidade' && s.tabTextAtivo]}>Especialidades</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tipo === 'classe' && s.tabAtiva]} onPress={() => setTipo('classe')}>
          <Text style={[s.tabText, tipo === 'classe' && s.tabTextAtivo]}>Classes</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search" size={19} color="#8a99a8" />
        <TextInput
          style={s.searchInput}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar modelo ou item..."
          placeholderTextColor="#9aa7b4"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {planosFiltrados.map((plano) => {
            const itens = itensPorPlano[plano.id] ?? [];
            return (
              <View key={plano.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemNome}>{plano.item_nome}</Text>
                    <Text style={s.cardTitle}>{plano.titulo}</Text>
                    {plano.descricao ? <Text style={s.cardDesc}>{plano.descricao}</Text> : null}
                  </View>
                  <View style={s.countBadge}>
                    <Text style={s.countText}>{itens.length || plano.avaliacoes_necessarias}</Text>
                    <Text style={s.countSub}>itens</Text>
                  </View>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${Math.min(100, ((itens.length || plano.avaliacoes_necessarias) / Math.max(1, plano.avaliacoes_necessarias)) * 100)}%` }]} />
                </View>
                {itens.slice(0, 3).map((item) => (
                  <Text key={item.id ?? `${plano.id}-${item.ordem}`} style={s.itemLinha}>
                    {item.ordem}. {item.titulo}
                  </Text>
                ))}
                {itens.length > 3 ? <Text style={s.maisItens}>+ {itens.length - 3} item(ns)</Text> : null}
                <View style={s.cardActions}>
                  <TouchableOpacity style={s.smallBtn} onPress={() => abrirEditarPlano(plano)}>
                    <Ionicons name="create-outline" size={17} color="#1a3a5c" />
                    <Text style={s.smallText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.smallBtn, s.dangerBtn]} onPress={() => excluirPlano(plano)}>
                    <Ionicons name="trash-outline" size={17} color="#c62828" />
                    <Text style={s.dangerText}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          {planosFiltrados.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="school-outline" size={46} color="#b7c3ce" />
              <Text style={s.emptyText}>Nenhum modelo cadastrado para este filtro.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={modalPlano} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalPlano(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setModalPlano(false)}>
              <Ionicons name="close" size={25} color="#1a2b3c" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>{editando ? 'Editar modelo' : 'Novo modelo'}</Text>
            <TouchableOpacity onPress={salvarPlano}>
              <Text style={s.saveText}>Salvar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={s.stepCard}>
              <TouchableOpacity style={s.stepHeader} onPress={() => setEtapaAberta(etapaAberta === 1 ? 2 : 1)}>
                <View style={s.stepNumber}><Text style={s.stepNumberText}>1</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>Tipo do modelo</Text>
                  <Text style={s.stepSub}>{formTipo === 'classe' ? 'Classe' : 'Especialidade'}</Text>
                </View>
                <Ionicons name={etapaAberta === 1 ? 'chevron-up' : 'chevron-down'} size={18} color="#607080" />
              </TouchableOpacity>
              {etapaAberta === 1 ? <View style={s.chips}>
                {(['especialidade', 'classe'] as TipoItem[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, formTipo === t && s.chipAtivo]}
                    onPress={() => {
                      setFormTipo(t);
                      setFormItemNome('');
                      setFormBuscaItem('');
                      setCatalogoAberto(false);
                      setEtapaAberta(2);
                    }}
                  >
                    <Text style={[s.chipText, formTipo === t && s.chipTextAtivo]}>{t === 'classe' ? 'Classe' : 'Especialidade'}</Text>
                  </TouchableOpacity>
                ))}
              </View> : null}
            </View>

            <View style={s.stepCard}>
              <TouchableOpacity style={s.stepHeader} onPress={() => setEtapaAberta(etapaAberta === 2 ? 1 : 2)}>
                <View style={s.stepNumber}><Text style={s.stepNumberText}>2</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>Vínculo formativo</Text>
                  <Text style={s.stepSub}>{formItemNome.trim() || 'Busque a especialidade ou classe que este modelo vai liberar.'}</Text>
                </View>
                <Ionicons name={etapaAberta === 2 ? 'chevron-up' : 'chevron-down'} size={18} color="#607080" />
              </TouchableOpacity>
              {etapaAberta === 2 ? <>
              <TextInput
                style={s.input}
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
              />
              {catalogoAberto && formBuscaItem.trim() ? (
                <ScrollView style={s.optionList} contentContainerStyle={s.optionListContent} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {catalogoFiltrado.map((item) => {
                    const ativo = formItemNome === item.nome;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[s.option, ativo && s.optionAtiva]}
                        onPress={() => {
                          setFormItemNome(item.nome);
                          setFormBuscaItem(item.nome);
                          setCatalogoAberto(false);
                          if (!formTitulo.trim()) setFormTitulo(`${item.nome} - ${new Date().getFullYear()}`);
                          setEtapaAberta(3);
                        }}
                      >
                        <Text style={[s.optionTitle, ativo && s.optionTitleAtivo]}>{item.nome}</Text>
                        <Text style={[s.optionSub, ativo && s.optionSubAtivo]}>{item.detalhe}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : null}
              </> : null}
            </View>

            {mostrarEtapa3 ? <View style={s.stepCard}>
              <TouchableOpacity style={s.stepHeader} onPress={() => setEtapaAberta(etapaAberta === 3 ? 2 : 3)}>
                <View style={s.stepNumber}><Text style={s.stepNumberText}>3</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>Identificação do modelo</Text>
                  <Text style={s.stepSub}>{formTitulo.trim() || 'Nome e observação geral que aparecem para a diretoria.'}</Text>
                </View>
                <Ionicons name={etapaAberta === 3 ? 'chevron-up' : 'chevron-down'} size={18} color="#607080" />
              </TouchableOpacity>
              {etapaAberta === 3 ? <>
              <Text style={s.labelCompact}>Nome do modelo *</Text>
              <TextInput
                style={s.input}
                value={formTitulo}
                onChangeText={setFormTitulo}
                onBlur={() => {
                  if (formTitulo.trim()) setEtapaAberta(4);
                }}
                placeholder="Ex.: Computação IV - Investidura 2026"
              />

              <Text style={s.labelCompact}>Descrição do modelo</Text>
              <TextInput style={[s.input, s.textArea]} value={formDescricao} onChangeText={setFormDescricao} multiline placeholder="Observação geral para este padrão..." />
              <View style={s.anexosHeader}>
                <Text style={s.labelCompact}>Anexos do modelo</Text>
                <TouchableOpacity style={s.attachBtn} onPress={adicionarAnexosModelo}>
                  <Ionicons name="attach" size={15} color="#1a3a5c" />
                  <Text style={s.attachText}>Anexar</Text>
                </TouchableOpacity>
              </View>
              {[...anexosModeloSalvos, ...anexosModeloPend].map((anexo: any) => (
                <View key={anexo.id ? `salvo-${anexo.id}` : anexo.chave} style={s.anexoLinha}>
                  <Ionicons name="document-attach-outline" size={15} color="#1a3a5c" />
                  <Text style={s.anexoNome} numberOfLines={1}>{anexo.nome}</Text>
                  {!anexo.id ? (
                    <TouchableOpacity onPress={() => removerAnexoModelo(anexo.chave)}>
                      <Ionicons name="close" size={17} color="#c62828" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              </> : null}
            </View> : null}

            {mostrarEtapa4 ? <View style={s.stepCard}>
              <TouchableOpacity style={s.stepHeader} onPress={() => setEtapaAberta(etapaAberta === 4 ? 3 : 4)}>
                <View style={s.stepNumber}><Text style={s.stepNumberText}>4</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>Itens avaliativos</Text>
                  <Text style={s.stepSub}>{itensValidosDoFormulario().length || 0} item(ns) preenchido(s)</Text>
                </View>
                <Ionicons name={etapaAberta === 4 ? 'chevron-up' : 'chevron-down'} size={18} color="#607080" />
              </TouchableOpacity>
              {etapaAberta === 4 ? <>

              <View style={s.modoBox}>
                {(['manual', 'lote'] as ModoItens[]).map((modo) => (
                  <TouchableOpacity
                    key={modo}
                    style={[s.modoChip, formModoItens === modo && s.modoChipAtivo]}
                    onPress={() => {
                      setFormModoItens(modo);
                      if (modo === 'lote') setLoteProcessado(false);
                    }}
                  >
                    <Text style={[s.modoChipText, formModoItens === modo && s.modoChipTextAtivo]}>
                      {modo === 'manual' ? 'Manual' : 'Em lote'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {formModoItens === 'lote' && !loteProcessado ? (
                <View style={s.loteBox}>
                  <Text style={s.loteHelp}>
                    Digite um item por linha. Separe título e descrição com ponto e vírgula: Título; Descrição
                  </Text>
                  <TextInput
                    style={[s.input, s.loteInput]}
                    value={loteTexto}
                    onChangeText={setLoteTexto}
                    multiline
                    placeholder={'item 1; Descrição\nitem 2; Descrição\nitem 3; Descrição'}
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
                    !destacado && s.itemFormCardNeutro,
                    destacado && aberto && s.itemFormCardDestaque,
                    { borderLeftColor: destacado ? ['#1e88e5', '#43a047', '#fb8c00', '#8e24aa'][indice % 4] : '#c7d2de' },
                  ]}
                >
                  <TouchableOpacity style={s.itemFormTop} onPress={() => setItemAberto(aberto ? -1 : indice)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.itemFormTitle, !destacado && s.itemFormTitleNeutro]}>Item {indice + 1}</Text>
                      <Text style={s.itemResumo} numberOfLines={1}>{item.titulo.trim() || 'Ainda sem título'}</Text>
                      {destacado && aberto ? <Text style={s.itemFormHint}>Preencha este item agora</Text> : null}
                    </View>
                    <View style={s.itemActions}>
                      {indice === itensVisiveis.length - 1 ? (
                        <TouchableOpacity
                          style={[s.itemAddBtn, !item.titulo.trim() && s.itemAddBtnDisabled]}
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
                        <TouchableOpacity style={s.itemTrashBtn} onPress={() => removerItemModelo(indice)}>
                          <Ionicons name="trash-outline" size={17} color="#c62828" />
                        </TouchableOpacity>
                      ) : null}
                      <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={17} color="#607080" />
                    </View>
                  </TouchableOpacity>
                  {aberto ? <>
                  <TextInput
                    style={[s.itemInput, itemTituloErro === indice && s.itemInputErro]}
                    value={item.titulo}
                    onChangeText={(titulo) => atualizarItemModelo(indice, { titulo })}
                    placeholder={itemTituloErro === indice ? 'Título obrigatório' : 'Título do requisito/atividade'}
                  />
                  <TextInput
                    style={[s.itemInput, s.itemTextArea]}
                    value={item.descricao}
                    onChangeText={(descricao) => atualizarItemModelo(indice, { descricao })}
                    multiline
                    placeholder="Descrição do que deve ser cumprido"
                  />
                  <View style={s.anexosHeader}>
                    <Text style={s.itemAnexoLabel}>Anexos do item</Text>
                    <TouchableOpacity style={s.attachBtnMini} onPress={() => adicionarAnexosItem(indice)}>
                      <Ionicons name="attach" size={14} color="#1a3a5c" />
                      <Text style={s.attachText}>Anexar</Text>
                    </TouchableOpacity>
                  </View>
                  {[...(item.anexosSalvos ?? []), ...(item.anexosPend ?? [])].map((anexo: any) => (
                    <View key={anexo.id ? `salvo-${anexo.id}` : anexo.chave} style={s.anexoLinha}>
                      <Ionicons name="document-attach-outline" size={15} color="#1a3a5c" />
                      <Text style={s.anexoNome} numberOfLines={1}>{anexo.nome}</Text>
                      {!anexo.id ? (
                        <TouchableOpacity onPress={() => removerAnexoItem(indice, anexo.chave)}>
                          <Ionicons name="close" size={17} color="#c62828" />
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
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setModalComparacao(false)}>
              <Ionicons name="close" size={25} color="#1a2b3c" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Comparar versões</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={s.modalScroll}>
            <View style={s.alertBox}>
              <Ionicons name="git-branch-outline" size={22} color="#8a5a00" />
              <Text style={s.alertText}>
                Este modelo já foi usado. Salvar agora criará uma nova versão padrão. Atividades antigas e concluídas continuam usando o modelo anterior.
              </Text>
            </View>

            <View style={s.compareGrid}>
              <View style={s.compareCol}>
                <Text style={s.compareTitle}>Modelo atual</Text>
                <Text style={s.compareSub}>{editando?.titulo}</Text>
                {(editando ? itensPorPlano[editando.id] ?? [] : []).map((item, idx) => (
                  <View key={`old-${item.id ?? idx}`} style={s.compareItemOld}>
                    <Text style={s.compareItemTitle}>{idx + 1}. {item.titulo}</Text>
                    {item.descricao ? <Text style={s.compareItemDesc}>{item.descricao}</Text> : null}
                  </View>
                ))}
              </View>

              <View style={s.compareCol}>
                <Text style={s.compareTitle}>Nova versão</Text>
                <Text style={s.compareSub}>{formTitulo}</Text>
                {itensValidosDoFormulario().map((item, idx) => (
                  <View key={`new-${idx}`} style={s.compareItemNew}>
                    <Text style={s.compareItemTitle}>{idx + 1}. {item.titulo}</Text>
                    {item.descricao ? <Text style={s.compareItemDesc}>{item.descricao}</Text> : null}
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
              <Text style={s.cancelText}>Voltar para edição</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 52, paddingHorizontal: 18, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 14 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 26, fontWeight: '900' },
  sub: { color: '#c9d8e8', fontSize: 14, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 14 },
  primaryBtn: { backgroundColor: '#1a3a5c', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
  tab: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  tabAtiva: { backgroundColor: '#1a3a5c' },
  tabText: { color: '#566473', fontWeight: '900' },
  tabTextAtivo: { color: '#fff' },
  searchBox: { margin: 14, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', minHeight: 52, borderWidth: 1, borderColor: '#d9e2ec' },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  content: { padding: 14, paddingBottom: 110, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#dce5ee' },
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
  smallBtn: { backgroundColor: '#f1f6fb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 6, alignItems: 'center' },
  smallText: { color: '#1a3a5c', fontWeight: '900' },
  dangerBtn: { backgroundColor: '#fff1f1' },
  dangerText: { color: '#c62828', fontWeight: '900' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#8a99a8', marginTop: 10 },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { paddingTop: 46, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: '#102a43', fontWeight: '900', fontSize: 18 },
  saveText: { color: '#1a3a5c', fontWeight: '900', fontSize: 16 },
  modalScroll: { padding: 12, paddingBottom: 80, gap: 10 },
  stepCard: { backgroundColor: '#f8fbfd', borderWidth: 1, borderColor: '#d7e0ea', borderRadius: 14, padding: 12 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stepNumber: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  stepTitle: { color: '#102a43', fontWeight: '900', fontSize: 15 },
  stepSub: { color: '#718096', fontSize: 12, marginTop: 2, lineHeight: 16 },
  label: { color: '#718096', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  labelCompact: { color: '#718096', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 8, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#d7e0ea', borderRadius: 10, paddingHorizontal: 12, minHeight: 48, fontSize: 15, backgroundColor: '#fff' },
  textArea: { minHeight: 92, textAlignVertical: 'top', paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#f1f6fb', borderWidth: 1, borderColor: '#d7e0ea', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  chipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  chipText: { color: '#4d5b6a', fontWeight: '900' },
  chipTextAtivo: { color: '#fff' },
  optionList: { marginTop: 8, maxHeight: 210 },
  optionListContent: { gap: 8 },
  option: { borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 10, backgroundColor: '#f8fbfd' },
  optionAtiva: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  optionTitle: { color: '#1a2b3c', fontWeight: '900' },
  optionSub: { color: '#7b8794', fontSize: 12, marginTop: 2 },
  optionTitleAtivo: { color: '#fff' },
  optionSubAtivo: { color: '#dbeafe' },
  sectionHeader: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#102a43', fontSize: 16, fontWeight: '900' },
  addItemBtn: { backgroundColor: '#2e7d32', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addItemText: { color: '#fff', fontWeight: '900' },
  itemFormCard: { marginTop: 9, padding: 9, backgroundColor: '#f8fbfd', borderRadius: 10, borderWidth: 1, borderColor: '#dce5ee', borderLeftWidth: 4 },
  itemFormCardNeutro: { backgroundColor: '#f4f7fa', borderColor: '#e2e8f0', opacity: 0.82 },
  itemFormCardDestaque: { backgroundColor: '#fffdf5', borderColor: '#f9b233', shadowColor: '#f9b233', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  itemFormTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemFormTitle: { color: '#102a43', fontWeight: '900', fontSize: 13 },
  itemFormTitleNeutro: { color: '#5f6f7f' },
  itemResumo: { color: '#607080', fontSize: 12, fontWeight: '700', marginTop: 2 },
  itemFormHint: { color: '#9a5b00', fontSize: 11, fontWeight: '800', marginTop: 2 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemAddBtn: { minHeight: 30, borderRadius: 15, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3, backgroundColor: '#2e7d32' },
  itemAddBtnDisabled: { backgroundColor: '#eef2f6' },
  itemAddText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  itemAddTextDisabled: { color: '#9aa6b2' },
  itemTrashBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f1' },
  itemInput: { borderWidth: 1, borderColor: '#d7e0ea', borderRadius: 9, paddingHorizontal: 10, minHeight: 38, fontSize: 14, backgroundColor: '#fff', marginTop: 5 },
  itemInputErro: { borderColor: '#d32f2f', backgroundColor: '#fff8f8' },
  itemTextArea: { minHeight: 58, textAlignVertical: 'top', paddingTop: 8 },
  modoBox: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  modoChip: { flex: 1, borderRadius: 999, backgroundColor: '#eef4f9', borderWidth: 1, borderColor: '#d7e0ea', paddingVertical: 9, alignItems: 'center' },
  modoChipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  modoChipText: { color: '#4d5b6a', fontWeight: '900' },
  modoChipTextAtivo: { color: '#fff' },
  loteBox: { backgroundColor: '#fffdf5', borderWidth: 1, borderColor: '#ffe0a3', borderRadius: 12, padding: 10 },
  loteHelp: { color: '#7a5a00', fontSize: 12, fontWeight: '700', lineHeight: 17, marginBottom: 8 },
  loteInput: { minHeight: 150, textAlignVertical: 'top', paddingTop: 10 },
  loteBtn: { marginTop: 10, backgroundColor: '#2e7d32', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loteBtnText: { color: '#fff', fontWeight: '900' },
  anexosHeader: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  attachBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#e8f0fe', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  attachBtnMini: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e8f0fe', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  attachText: { color: '#1a3a5c', fontWeight: '900', fontSize: 12 },
  itemAnexoLabel: { color: '#718096', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  anexoLinha: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#eef4f9', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 },
  anexoNome: { flex: 1, color: '#334e68', fontWeight: '800', fontSize: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  cancel: { padding: 14, alignItems: 'center' },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 12 },
  cancelText: { color: '#7b8794', fontWeight: '900' },
  alertBox: { backgroundColor: '#fff8e1', borderWidth: 1, borderColor: '#ffe0a3', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 14 },
  alertText: { color: '#6d4c00', flex: 1, fontWeight: '700', lineHeight: 19 },
  compareGrid: { flexDirection: 'row', gap: 10 },
  compareCol: { flex: 1, backgroundColor: '#f8fbfd', borderRadius: 12, borderWidth: 1, borderColor: '#dce5ee', padding: 10 },
  compareTitle: { color: '#102a43', fontWeight: '900', fontSize: 16 },
  compareSub: { color: '#607080', fontSize: 12, marginTop: 2, marginBottom: 8 },
  compareItemOld: { backgroundColor: '#fff', borderRadius: 10, padding: 9, marginTop: 7, borderLeftWidth: 4, borderLeftColor: '#90a4ae' },
  compareItemNew: { backgroundColor: '#fff', borderRadius: 10, padding: 9, marginTop: 7, borderLeftWidth: 4, borderLeftColor: '#2e7d32' },
  compareItemTitle: { color: '#1a2b3c', fontWeight: '900', fontSize: 13 },
  compareItemDesc: { color: '#6b7a89', fontSize: 12, marginTop: 4 },
  saveVersionBtn: { marginTop: 16, backgroundColor: '#2e7d32', borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveVersionText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
