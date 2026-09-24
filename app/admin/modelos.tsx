import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { buscarPaginado } from '../../src/lib/supabasePaginado';
import { getClubeAtivoId, getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { avisar, useAvisoStore } from '../../src/stores/avisoStore';
import { carregarConfigRanking, salvarConfigRanking, CONFIG_RANKING_PADRAO, type ConfigRanking } from '../../src/lib/rankingConfig';
import * as ImagePicker from 'expo-image-picker';
import { uriParaUploadBody } from '../../src/lib/storageUpload';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { corIcone } from '../../src/lib/tema';
import { useLogoClubeStore } from '../../src/stores/logoClubeStore';
import {
  abrirBackupRanking,
  gerarBackupEZerarRanking,
  listarBackupsRanking,
  type RankingBackupSalvo,
} from '../../src/lib/rankingBackup';

interface PontuacaoItem {
  id: number;
  titulo: string;
  sigla: string;
  valor: number;
  ordem: number;
  ativo: boolean;
}

interface DocumentoItem {
  id: number;
  campo: string;
  nome: string;
  obrigatorio: boolean;
  permite_anexo: boolean;
  limite_anexos: number;
  ordem: number;
  ativo: boolean;
}

type Aba = 'pontuacao' | 'documentos' | 'config' | 'ranking' | 'clube';

const PONTUACAO_VAZIA = { titulo: '', sigla: '', valor: '0' };
const DOCUMENTO_VAZIO = { nome: '', campo: '', limite_anexos: '1', obrigatorio: true };

function slugCampo(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 42);
}

function confirmar(titulo: string, msg: string, textoConfirmar = 'Excluir') {
  return new Promise<boolean>((resolve) => {
    useAvisoStore.getState().mostrar({
      titulo,
      mensagem: msg,
      tipo: 'erro',
      botoes: [
        { texto: 'Cancelar', estilo: 'cancelar', onPress: () => resolve(false) },
        { texto: textoConfirmar, estilo: 'padrao', onPress: () => resolve(true) },
      ],
    });
  });
}

function normalizarHoraPush(valor?: string | null) {
  const match = String(valor ?? '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '06:00';
  const hora = Math.max(0, Math.min(23, Number(match[1]) || 0));
  const minuto = Math.max(0, Math.min(59, Number(match[2]) || 0));
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

export default function ModelosAdminScreen() {
  const corCabecalho = useCorCabecalho();
  const cores = useCores();
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const permissoes = usePermissoes();
  const { aba: abaParam } = useLocalSearchParams<{ aba?: string }>();
  const abaInicial: Aba = ['pontuacao', 'documentos', 'config', 'ranking', 'clube'].includes(String(abaParam))
    ? abaParam as Aba
    : 'pontuacao';
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [abaDropdownAberto, setAbaDropdownAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pontuacoes, setPontuacoes] = useState<PontuacaoItem[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoItem[]>([]);
  const [modalPont, setModalPont] = useState<PontuacaoItem | null | 'novo'>(null);
  const [modalDoc, setModalDoc] = useState<DocumentoItem | null | 'novo'>(null);
  const [formPont, setFormPont] = useState(PONTUACAO_VAZIA);
  const [formDoc, setFormDoc] = useState(DOCUMENTO_VAZIO);
  const [minFaltas, setMinFaltas] = useState('3');
  const [configRanking, setConfigRanking] = useState<ConfigRanking>(CONFIG_RANKING_PADRAO);
  const [salvandoRanking, setSalvandoRanking] = useState(false);
  const [backupsRanking, setBackupsRanking] = useState<RankingBackupSalvo[]>([]);
  const [zerandoRanking, setZerandoRanking] = useState(false);
  const [baixandoBackupId, setBaixandoBackupId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [anoBiblicoPushAtivo, setAnoBiblicoPushAtivo] = useState(true);
  const [anoBiblicoPushHora, setAnoBiblicoPushHora] = useState('06:00');
  const [salvandoAnoBiblicoPush, setSalvandoAnoBiblicoPush] = useState(false);

  const podeConfigurarClube = permissoes.temPerfil(['admin_ti', 'admin_clube', 'usuario_diretoria']);
  const podeConfigurarLogo = permissoes.temPerfil(['admin_ti', 'admin_clube']);
  const podeGerenciar = permissoes.podeAlguma(['admin_clube', 'gerenciar_pontuacao', 'gerenciar_documentos']) || podeConfigurarClube;
  // Config de visibilidade do ranking é decisão de clube inteiro, não de
  // quem lança pontuação no dia a dia — só admin_ti/admin_clube mexem nela.
  const podeConfigurarRanking = permissoes.temPerfil(['admin_ti', 'admin_clube']);
  const clubeId = getClubeAtivoId();
  const programaId = getProgramaAtivoId();
  const versaoLogo = useLogoClubeStore((s) => (clubeId ? s.versoes[clubeId] ?? 0 : 0));
  const atualizarLogoClube = useLogoClubeStore((s) => s.atualizarLogoClube);

  const logoExibicao = useMemo(() => {
    if (!logoUrl) return null;
    const separador = logoUrl.includes('?') ? '&' : '?';
    return `${logoUrl}${separador}v=${versaoLogo || 1}`;
  }, [logoUrl, versaoLogo]);

  useFocusEffect(useCallback(() => {
    carregar();
  }, []));

  useEffect(() => {
    if (['pontuacao', 'documentos', 'config', 'ranking', 'clube'].includes(String(abaParam))) {
      setAba(abaParam as Aba);
    }
  }, [abaParam]);

  async function carregar() {
    setLoading(true);
    try {
      const [{ data: pts, error: erroPts }, { data: docs, error: erroDocs }, { data: cfgClube }] = await Promise.all([
        supabase
          .from('pontuacao_itens')
          .select('id,titulo,sigla,valor,ordem,ativo')
          .eq('clube_id', clubeId)
          .order('ordem'),
        supabase
          .from('documentos_modelo')
          .select('id,campo,nome,obrigatorio,permite_anexo,limite_anexos,ordem,ativo')
          .eq('clube_id', clubeId)
          .order('ordem'),
        supabase.from('clubes').select('min_faltas_faltosos, logo_url').eq('id', clubeId).single(),
      ]);
      if (erroPts) throw erroPts;
      if (erroDocs) throw erroDocs;
      if (cfgClube) {
        setMinFaltas(String((cfgClube as any).min_faltas_faltosos ?? 3));
        const novaLogo = (cfgClube as any).logo_url ?? null;
        setLogoUrl(novaLogo);
        atualizarLogoClube(clubeId, novaLogo);
      }
      if (podeConfigurarClube) {
        const { data: cfgAnoBiblico, error: erroCfgAnoBiblico } = await supabase
          .from('clubes')
          .select('ano_biblico_push_ativo, ano_biblico_push_hora')
          .eq('id', clubeId)
          .maybeSingle();
        if (!erroCfgAnoBiblico && cfgAnoBiblico) {
          setAnoBiblicoPushAtivo((cfgAnoBiblico as any).ano_biblico_push_ativo !== false);
          setAnoBiblicoPushHora(normalizarHoraPush((cfgAnoBiblico as any).ano_biblico_push_hora));
        }
      }
      setPontuacoes((pts ?? []) as PontuacaoItem[]);
      setDocumentos((docs ?? []) as DocumentoItem[]);
      if (podeConfigurarRanking) {
        const [ranking, backups] = await Promise.all([
          carregarConfigRanking(clubeId),
          listarBackupsRanking(clubeId),
        ]);
        setConfigRanking(ranking);
        setBackupsRanking(backups);
      }
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível carregar os modelos.', 'erro');
    } finally {
      setLoading(false);
    }
  }

  const totalAtivos = useMemo(() => ({
    pontuacao: pontuacoes.filter((p) => p.ativo).length,
    documentos: documentos.filter((d) => d.ativo).length,
  }), [pontuacoes, documentos]);

  function abrirPont(item?: PontuacaoItem) {
    if (item) {
      setModalPont(item);
      setFormPont({ titulo: item.titulo, sigla: item.sigla, valor: String(item.valor) });
    } else {
      setModalPont('novo');
      setFormPont(PONTUACAO_VAZIA);
    }
  }

  function abrirDoc(item?: DocumentoItem) {
    if (item) {
      setModalDoc(item);
      setFormDoc({
        nome: item.nome,
        campo: item.campo,
        limite_anexos: String(item.limite_anexos ?? 1),
        obrigatorio: !!item.obrigatorio,
      });
    } else {
      setModalDoc('novo');
      setFormDoc(DOCUMENTO_VAZIO);
    }
  }

  async function salvarPontuacao() {
    const titulo = formPont.titulo.trim();
    const sigla = formPont.sigla.trim().toUpperCase().slice(0, 6);
    const valor = Number(formPont.valor) || 0;
    if (!titulo || !sigla) return avisar('Informe título e sigla.', 'info', 'Atenção');
    try {
      const base = {
        clube_id: clubeId,
        programa_id: programaId,
        titulo,
        sigla,
        valor,
        ativo: true,
        updated_at: new Date().toISOString(),
      };
      if (modalPont && modalPont !== 'novo') {
        const { error } = await supabase.from('pontuacao_itens').update(base).eq('id', modalPont.id);
        if (error) throw error;
      } else {
        const ordem = (pontuacoes[pontuacoes.length - 1]?.ordem ?? 0) + 1;
        const { error } = await supabase.from('pontuacao_itens').insert({ ...base, ordem, padrao: false });
        if (error) throw error;
      }
      setModalPont(null);
      await carregar();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar a pontuação.', 'erro');
    }
  }

  async function salvarDocumento() {
    const nome = formDoc.nome.trim();
    const campo = (formDoc.campo.trim() || slugCampo(nome)).slice(0, 50);
    if (!nome || !campo) return avisar('Informe nome e campo.', 'info', 'Atenção');
    try {
      const base = {
        clube_id: clubeId,
        programa_id: programaId,
        nome,
        campo,
        obrigatorio: formDoc.obrigatorio,
        permite_anexo: true,
        limite_anexos: Math.max(1, Number(formDoc.limite_anexos) || 1),
        ativo: true,
      };
      if (modalDoc && modalDoc !== 'novo') {
        const { error } = await supabase.from('documentos_modelo').update(base).eq('id', modalDoc.id);
        if (error) throw error;
      } else {
        const ordem = (documentos[documentos.length - 1]?.ordem ?? 0) + 1;
        const { error } = await supabase.from('documentos_modelo').insert({ ...base, ordem });
        if (error) throw error;
      }
      setModalDoc(null);
      await carregar();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar o documento.', 'erro');
    }
  }

  async function salvarConfig() {
    const valor = Math.max(1, Math.min(30, Number(minFaltas) || 3));
    try {
      const { error } = await supabase.from('clubes').update({ min_faltas_faltosos: valor }).eq('id', clubeId);
      if (error) throw error;
      setMinFaltas(String(valor));
      const msg = `Membros com ${valor} ou mais reuniões consecutivas sem presença serão exibidos na aba Faltosos.`;
      useAvisoStore.getState().mostrar({
        titulo: 'Configuração salva',
        mensagem: msg,
        tipo: 'sucesso',
        botoes: [
          { texto: 'Ver Faltosos', estilo: 'padrao', onPress: () => router.replace({ pathname: '/', params: { abaFaltosos: '1' } } as any) },
        ],
      });
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar.', 'erro');
    }
  }

  async function salvarAnoBiblicoPush() {
    const hora = normalizarHoraPush(anoBiblicoPushHora);
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      avisar('Informe o horário no formato HH:MM.', 'info', 'Atenção');
      return;
    }
    setSalvandoAnoBiblicoPush(true);
    try {
      const { error } = await supabase
        .from('clubes')
        .update({
          ano_biblico_push_ativo: anoBiblicoPushAtivo,
          ano_biblico_push_hora: `${hora}:00`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clubeId);
      if (error) throw error;
      setAnoBiblicoPushHora(hora);
      avisar('Notificação do Ano Bíblico salva.', 'sucesso');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar a notificação do Ano Bíblico. Verifique se a migration do banco já foi aplicada.', 'erro');
    } finally {
      setSalvandoAnoBiblicoPush(false);
    }
  }

  function alternarConfigRanking(campo: keyof ConfigRanking) {
    setConfigRanking((c) => ({ ...c, [campo]: !c[campo] }));
  }

  async function enviarLogoParaStorage(uri: string, nome: string, tipo: string): Promise<string> {
    const ext = (nome.split('.').pop() || 'jpg').toLowerCase();
    const body = await uriParaUploadBody(uri, tipo);
    // Reaproveita o bucket público de atividades, já provisionado e usado
    // pelos anexos do sistema. O bucket exclusivo antigo não era criado pela
    // migração e causava "Bucket not found" em instalações existentes.
    const bucket = 'atividades';
    const path = `logos-clube/${clubeId}/logo_${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, body as any, { upsert: false, contentType: tipo || 'image/jpeg' });
    if (error) throw error;
    if (!data?.path) throw new Error('O servidor não retornou o caminho da logo.');
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    if (!urlData.publicUrl) throw new Error('O servidor não retornou a URL da logo.');
    return urlData.publicUrl;
  }

  async function salvarLogoUrl(url: string) {
    const { data, error } = await supabase
      .from('clubes')
      .update({ logo_url: url })
      .eq('id', clubeId)
      .select('logo_url')
      .maybeSingle();
    if (error) throw error;
    if (!data || (data as any).logo_url !== url) {
      throw new Error('A logo não foi salva no cadastro do clube.');
    }
    setLogoUrl((data as any).logo_url);
    atualizarLogoClube(clubeId, (data as any).logo_url);
  }

  function escolherLogoWeb() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        avisar('A logo aceita apenas imagens.', 'erro', 'Formato inválido');
        return;
      }
      const localUrl = URL.createObjectURL(file);
      setEnviandoLogo(true);
      try {
        const url = await enviarLogoParaStorage(localUrl, file.name || 'logo.jpg', file.type || 'image/jpeg');
        await salvarLogoUrl(url);
        avisar('Logo do clube atualizada.', 'sucesso');
      } catch (e: any) {
        avisar(e?.message ?? 'Não foi possível enviar a logo.', 'erro');
      } finally {
        setEnviandoLogo(false);
      }
    };
    input.click();
  }

  async function escolherLogoNativo() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      avisar('Autorize o acesso às fotos para enviar a logo.', 'info', 'Permissão necessária');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (resultado.canceled || !resultado.assets?.[0]) return;
    const asset = resultado.assets[0];
    setEnviandoLogo(true);
    try {
      const url = await enviarLogoParaStorage(asset.uri, asset.fileName ?? 'logo.jpg', asset.mimeType ?? 'image/jpeg');
      await salvarLogoUrl(url);
      avisar('Logo do clube atualizada.', 'sucesso');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível enviar a logo.', 'erro');
    } finally {
      setEnviandoLogo(false);
    }
  }

  function enviarLogo() {
    if (Platform.OS === 'web') escolherLogoWeb();
    else escolherLogoNativo();
  }

  async function removerLogo() {
    if (!(await confirmar('Remover logo', 'Remover a logo do clube?'))) return;
    try {
      const { data, error } = await supabase
        .from('clubes')
        .update({ logo_url: null })
        .eq('id', clubeId)
        .select('logo_url')
        .maybeSingle();
      if (error) throw error;
      if (!data || (data as any).logo_url !== null) {
        throw new Error('A logo não foi removida do cadastro do clube.');
      }
      setLogoUrl(null);
      atualizarLogoClube(clubeId, null);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível remover a logo.', 'erro');
    }
  }

  async function salvarRanking() {
    setSalvandoRanking(true);
    try {
      await salvarConfigRanking(clubeId, configRanking);
      avisar('Configuração de ranking salva.', 'sucesso');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar a configuração de ranking.', 'erro');
    } finally {
      setSalvandoRanking(false);
    }
  }

  async function zerarRanking() {
    const ano = new Date().getFullYear();
    const ok = await confirmar(
      `Zerar pontuação de ${ano}`,
      `Esta ação vai gerar um PDF com a classificação e o extrato individual de todos os membros. Somente depois que o backup for salvo no servidor, todas as pontuações de ${ano}, inclusive as pontuações diretas das unidades, serão excluídas definitivamente do banco de dados.\n\nDeseja continuar?`,
      'Gerar backup e zerar',
    );
    if (!ok) return;
    setZerandoRanking(true);
    try {
      const resultado = await gerarBackupEZerarRanking(clubeId, ano);
      setBackupsRanking(await listarBackupsRanking(clubeId));
      avisar(`Backup ${resultado.nomeArquivo} salvo. A pontuação de ${ano} foi zerada.`, 'sucesso');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível gerar o backup e zerar a pontuação. Nenhum dado foi excluído.', 'erro');
    } finally {
      setZerandoRanking(false);
    }
  }

  async function baixarBackup(backup: RankingBackupSalvo) {
    setBaixandoBackupId(backup.id);
    try {
      await abrirBackupRanking(backup.arquivo_path);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível abrir este backup.', 'erro');
    } finally {
      setBaixandoBackupId(null);
    }
  }

  async function excluirPontuacao(item: PontuacaoItem) {
    const ok = await confirmar('Excluir pontuação', `Remover "${item.titulo}" da grade de pontuação?`);
    if (!ok) return;
    const { error } = await supabase.from('pontuacao_itens').update({ ativo: false }).eq('id', item.id);
    if (error) return avisar(error.message, 'erro');
    await carregar();
  }

  function extrairPathDocumentoStorage(valor?: string | null) {
    if (!valor) return null;
    const raw = String(valor);
    if (!raw.startsWith('http')) {
      return raw.startsWith('blob:') || raw.startsWith('file:') ? null : raw.replace(/^\/+/, '');
    }
    const marcador = '/storage/v1/object/';
    const idx = raw.indexOf(marcador);
    if (idx < 0 || !raw.includes('/documentos_fotos/')) return null;
    const aposObject = raw.slice(idx + marcador.length);
    const partes = aposObject.split('?')[0].split('/');
    const bucketIndex = partes.findIndex((p) => p === 'documentos_fotos');
    if (bucketIndex < 0) return null;
    return decodeURIComponent(partes.slice(bucketIndex + 1).join('/'));
  }

  async function excluirDocumento(item: DocumentoItem) {
    try {
      const [{ data: imagens, error: erroImagens }, { data: statusRows, error: erroStatus }] = await Promise.all([
        supabase.from('documento_imagens').select('id,dbv_id,url').eq('clube_id', clubeId).eq('campo', item.campo),
        supabase.from('documento_status').select('dbv_id').eq('clube_id', clubeId).eq('campo', item.campo),
      ]);
      if (erroImagens) throw erroImagens;
      if (erroStatus) throw erroStatus;

      const dbvIdsAfetados = [...new Set([
        ...((imagens ?? []).map((i: any) => Number(i.dbv_id))),
        ...((statusRows ?? []).map((s: any) => Number(s.dbv_id))),
      ])];

      let mensagem = `Remover "${item.nome}" da lista de documentos? O modelo será apagado definitivamente.`;
      if (dbvIdsAfetados.length) {
        const membros = await buscarPaginado(
          (q) => q.eq('clube_id', clubeId).in('id', dbvIdsAfetados),
          'desbravadores',
          'id,nome',
        );
        const nomes = membros.map((m: any) => m.nome);
        const listaNomes = nomes.length <= 6
          ? nomes.join(', ')
          : `${nomes.slice(0, 6).join(', ')} e mais ${nomes.length - 6}`;
        const qtdAnexos = (imagens ?? []).length;
        mensagem = `"${item.nome}" já tem envios salvos de ${dbvIdsAfetados.length} membro(s): ${listaNomes}.\n\n`
          + `Excluir este modelo vai apagar definitivamente ${qtdAnexos} anexo(s) enviado(s) e o status registrado para esses membros. Esta ação não pode ser desfeita.`;
      }

      const ok = await confirmar('Excluir documento', mensagem);
      if (!ok) return;

      for (const img of (imagens ?? []) as Array<{ url: string }>) {
        const path = extrairPathDocumentoStorage(img.url);
        if (path) await supabase.storage.from('documentos_fotos').remove([path]).catch(() => null);
      }
      if (imagens?.length) {
        const { error } = await supabase.from('documento_imagens').delete().eq('clube_id', clubeId).eq('campo', item.campo);
        if (error) throw error;
      }
      if (statusRows?.length) {
        const { error } = await supabase.from('documento_status').delete().eq('clube_id', clubeId).eq('campo', item.campo);
        if (error) throw error;
      }
      const { error } = await supabase.from('documentos_modelo').delete().eq('id', item.id);
      if (error) throw error;
      await carregar();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível excluir o documento.', 'erro');
    }
  }

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeGerenciar) return <Redirect href="/" />;

  return (
    <View style={[s.container, { backgroundColor: cores.fundo }]}>
      <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18, paddingRight: 76 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Modelos do Clube</Text>
          <Text style={s.sub}>{contextoAtivo?.clube_nome_curto ?? contextoAtivo?.clube_nome ?? 'Clube ativo'}</Text>
        </View>
        <TouchableOpacity onPress={carregar} style={s.iconBtn}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={s.abaSelectWrap}>
        <TouchableOpacity style={[s.abaSelectBtn, { backgroundColor: cores.cartao, borderColor: cores.borda }]} onPress={() => setAbaDropdownAberto(true)}>
          <Ionicons
            name={
              aba === 'pontuacao' ? 'checkmark-circle-outline'
              : aba === 'documentos' ? 'document-text-outline'
              : aba === 'ranking' ? 'trophy-outline'
              : aba === 'clube' ? 'image-outline'
              : 'calendar-outline'
            }
            size={17}
            color={cores.isEscuro ? '#fff' : '#1a3a5c'}
          />
          <Text style={[s.abaSelectText, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>
            {aba === 'pontuacao' ? `Pontuação (${totalAtivos.pontuacao})`
              : aba === 'documentos' ? `Documentos (${totalAtivos.documentos})`
              : aba === 'ranking' ? 'Ranking'
              : aba === 'clube' ? 'Clube'
              : 'Faltas'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
        </TouchableOpacity>
      </View>

      <Modal visible={abaDropdownAberto} transparent animationType="fade" onRequestClose={() => setAbaDropdownAberto(false)}>
        <TouchableOpacity style={[s.dropdownOverlay, { backgroundColor: cores.overlay }]} activeOpacity={1} onPress={() => setAbaDropdownAberto(false)}>
          <View style={[s.dropdownMenu, { backgroundColor: cores.cartao }]}>
            <TouchableOpacity
              style={[s.dropdownItem, aba === 'pontuacao' && { backgroundColor: cores.isEscuro ? cores.input : '#eef5fb' }]}
              onPress={() => { setAba('pontuacao'); setAbaDropdownAberto(false); }}
            >
              <Ionicons name="checkmark-circle-outline" size={17} color={aba === 'pontuacao' ? corIcone(cores) : cores.textoSecundario} />
              <Text style={[s.dropdownItemText, { color: aba === 'pontuacao' ? cores.texto : cores.textoSecundario }]}>Pontuação ({totalAtivos.pontuacao})</Text>
              {aba === 'pontuacao' && <Ionicons name="checkmark" size={16} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.dropdownItem, aba === 'documentos' && { backgroundColor: cores.isEscuro ? cores.input : '#eef5fb' }]}
              onPress={() => { setAba('documentos'); setAbaDropdownAberto(false); }}
            >
              <Ionicons name="document-text-outline" size={17} color={aba === 'documentos' ? corIcone(cores) : cores.textoSecundario} />
              <Text style={[s.dropdownItemText, { color: aba === 'documentos' ? cores.texto : cores.textoSecundario }]}>Documentos ({totalAtivos.documentos})</Text>
              {aba === 'documentos' && <Ionicons name="checkmark" size={16} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.dropdownItem, aba === 'config' && { backgroundColor: cores.isEscuro ? cores.input : '#eef5fb' }]}
              onPress={() => { setAba('config'); setAbaDropdownAberto(false); }}
            >
              <Ionicons name="calendar-outline" size={17} color={aba === 'config' ? corIcone(cores) : cores.textoSecundario} />
              <Text style={[s.dropdownItemText, { color: aba === 'config' ? cores.texto : cores.textoSecundario }]}>Faltas</Text>
              {aba === 'config' && <Ionicons name="checkmark" size={16} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />}
            </TouchableOpacity>
            {podeConfigurarRanking && (
              <TouchableOpacity
                style={[s.dropdownItem, aba === 'ranking' && { backgroundColor: cores.isEscuro ? cores.input : '#eef5fb' }]}
                onPress={() => { setAba('ranking'); setAbaDropdownAberto(false); }}
              >
                <Ionicons name="trophy-outline" size={17} color={aba === 'ranking' ? corIcone(cores) : cores.textoSecundario} />
                <Text style={[s.dropdownItemText, { color: aba === 'ranking' ? cores.texto : cores.textoSecundario }]}>Ranking</Text>
                {aba === 'ranking' && <Ionicons name="checkmark" size={16} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />}
              </TouchableOpacity>
            )}
            {podeConfigurarClube && (
              <TouchableOpacity
                style={[s.dropdownItem, aba === 'clube' && { backgroundColor: cores.isEscuro ? cores.input : '#eef5fb' }]}
                onPress={() => { setAba('clube'); setAbaDropdownAberto(false); }}
              >
                <Ionicons name="image-outline" size={17} color={aba === 'clube' ? corIcone(cores) : cores.textoSecundario} />
                <Text style={[s.dropdownItemText, { color: aba === 'clube' ? cores.texto : cores.textoSecundario }]}>Clube</Text>
                {aba === 'clube' && <Ionicons name="checkmark" size={16} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={s.dropdownItem}
              onPress={() => { setAbaDropdownAberto(false); router.push('/admin/formativos' as any); }}
            >
              <Ionicons name="school-outline" size={17} color={cores.textoSecundario} />
              <Text style={[s.dropdownItemText, { color: cores.textoSecundario }]}>Formativos</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <ActivityIndicator size="large" color={cores.isEscuro ? '#fff' : '#1a3a5c'} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {aba === 'pontuacao' ? (
            <>
              <TouchableOpacity style={s.add} onPress={() => abrirPont()}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={s.addText}>Nova pontuação</Text>
              </TouchableOpacity>
              {pontuacoes.map((p) => (
                <View key={p.id} style={[s.card, { backgroundColor: cores.cartao, borderColor: cores.borda }, !p.ativo && s.inativo]}>
                  <View style={[s.sigla, { backgroundColor: cores.fundo }]}><Text style={[s.siglaText, cores.isEscuro && { color: '#fff' }]}>{p.sigla}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardTitle, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{p.titulo}</Text>
                    <Text style={[s.cardSub, { color: cores.textoSecundario }]}>{p.valor} ponto(s) • ordem {p.ordem}</Text>
                  </View>
                  <TouchableOpacity style={[s.smallBtn, { backgroundColor: cores.fundo }]} onPress={() => abrirPont(p)}>
                    <Ionicons name="pencil" size={18} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                  </TouchableOpacity>
                  {p.ativo && (
                    <TouchableOpacity style={[s.smallBtn, { backgroundColor: cores.fundo }]} onPress={() => excluirPontuacao(p)}>
                      <Ionicons name="trash-outline" size={18} color="#c62828" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          ) : aba === 'documentos' ? (
            <>
              <TouchableOpacity style={s.add} onPress={() => abrirDoc()}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={s.addText}>Novo documento</Text>
              </TouchableOpacity>
              {documentos.map((d) => (
                <View key={d.id} style={[s.card, { backgroundColor: cores.cartao, borderColor: cores.borda }, !d.ativo && s.inativo]}>
                  <View style={[s.docIcon, { backgroundColor: cores.input }]}><Ionicons name="document-attach" size={20} color={corIcone(cores)} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardTitle, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{d.nome}</Text>
                    <Text style={[s.cardSub, { color: cores.textoSecundario }]}>{d.campo} • {d.obrigatorio ? 'obrigatório' : 'opcional'} • {d.limite_anexos} anexo(s)</Text>
                  </View>
                  <TouchableOpacity style={[s.smallBtn, { backgroundColor: cores.fundo }]} onPress={() => abrirDoc(d)}>
                    <Ionicons name="pencil" size={18} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                  </TouchableOpacity>
                  {d.ativo && (
                    <TouchableOpacity style={[s.smallBtn, { backgroundColor: cores.fundo }]} onPress={() => excluirDocumento(d)}>
                      <Ionicons name="trash-outline" size={18} color="#c62828" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          ) : aba === 'config' ? (
            <View style={[s.configCard, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
              <View style={s.configHeader}>
                <View style={[s.docIcon, { backgroundColor: cores.input }]}><Ionicons name="alert-circle" size={20} color={corIcone(cores)} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Aba "Faltosos"</Text>
                  <Text style={[s.cardSub, { color: cores.textoSecundario }]}>Mínimo de reuniões consecutivas sem presença para o membro aparecer na aba Faltosos do dashboard.</Text>
                </View>
              </View>
              <Text style={[s.label, { color: cores.textoSecundario }]}>Reuniões consecutivas</Text>
              <TextInput
                style={[s.input, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
                value={minFaltas}
                keyboardType="numeric"
                onChangeText={(v) => setMinFaltas(v.replace(/[^0-9]/g, ''))}
              />
              <TouchableOpacity style={[s.secondarySave, { backgroundColor: cores.fundo, borderColor: cores.borda }]} onPress={salvarConfig}>
                <Ionicons name="save-outline" size={18} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                <Text style={[s.secondarySaveText, cores.isEscuro && { color: '#fff' }]}>Salvar limiar de faltas</Text>
              </TouchableOpacity>
            </View>
          ) : aba === 'ranking' && podeConfigurarRanking ? (
            <View style={[s.configCard, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
              <View style={s.configHeader}>
                <View style={[s.docIcon, { backgroundColor: cores.input }]}><Ionicons name="trophy" size={20} color={corIcone(cores)} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Visibilidade do ranking</Text>
                  <Text style={[s.cardSub, { color: cores.textoSecundario }]}>Marque quais rankings aparecem pra cada público. Se nenhum ficar marcado num grupo, quem for desse público vê só a própria posição no ranking e pode abrir o próprio extrato de pontos.</Text>
                </View>
              </View>

              <Text style={[s.label, { color: cores.textoSecundario }]}>Diretoria</Text>
              <TouchableOpacity style={s.checkRow} onPress={() => alternarConfigRanking('diretoria_tipo_dbv')}>
                <Ionicons name={configRanking.diretoria_tipo_dbv ? 'checkbox' : 'square-outline'} size={22} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                <Text style={[s.checkText, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>DBV</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.checkRow} onPress={() => alternarConfigRanking('diretoria_tipo_conselheiros')}>
                <Ionicons name={configRanking.diretoria_tipo_conselheiros ? 'checkbox' : 'square-outline'} size={22} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                <Text style={[s.checkText, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Conselheiros</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.checkRow} onPress={() => alternarConfigRanking('diretoria_tipo_diretoria')}>
                <Ionicons name={configRanking.diretoria_tipo_diretoria ? 'checkbox' : 'square-outline'} size={22} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                <Text style={[s.checkText, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Diretoria</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.checkRow} onPress={() => alternarConfigRanking('diretoria_tipo_unidades')}>
                <Ionicons name={configRanking.diretoria_tipo_unidades ? 'checkbox' : 'square-outline'} size={22} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                <Text style={[s.checkText, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Unidades</Text>
              </TouchableOpacity>

              <Text style={[s.label, { color: cores.textoSecundario, marginTop: 16 }]}>Desbravadores e Pais</Text>
              <TouchableOpacity style={s.checkRow} onPress={() => alternarConfigRanking('membros_tipo_dbv')}>
                <Ionicons name={configRanking.membros_tipo_dbv ? 'checkbox' : 'square-outline'} size={22} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                <Text style={[s.checkText, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>DBV</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.checkRow} onPress={() => alternarConfigRanking('membros_tipo_conselheiros')}>
                <Ionicons name={configRanking.membros_tipo_conselheiros ? 'checkbox' : 'square-outline'} size={22} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                <Text style={[s.checkText, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Conselheiros</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.checkRow} onPress={() => alternarConfigRanking('membros_tipo_diretoria')}>
                <Ionicons name={configRanking.membros_tipo_diretoria ? 'checkbox' : 'square-outline'} size={22} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                <Text style={[s.checkText, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Diretoria</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.checkRow} onPress={() => alternarConfigRanking('membros_tipo_unidades')}>
                <Ionicons name={configRanking.membros_tipo_unidades ? 'checkbox' : 'square-outline'} size={22} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                <Text style={[s.checkText, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Unidades</Text>
              </TouchableOpacity>

              <Text style={[s.label, { color: cores.textoSecundario, marginTop: 16 }]}>Sem lista completa, Desbravadores e Pais podem ver</Text>
              <Text style={[s.cardSub, { color: cores.textoSecundario }]}>Vale só pra quem não tem nenhum tipo marcado acima — decide o que aparece no cartão de "minha posição".</Text>
              <TouchableOpacity style={s.checkRow} onPress={() => alternarConfigRanking('membros_ve_pontuacao')}>
                <Ionicons name={configRanking.membros_ve_pontuacao ? 'checkbox' : 'square-outline'} size={22} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                <Text style={[s.checkText, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Própria pontuação</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.checkRow} onPress={() => alternarConfigRanking('membros_ve_posicao')}>
                <Ionicons name={configRanking.membros_ve_posicao ? 'checkbox' : 'square-outline'} size={22} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                <Text style={[s.checkText, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Própria colocação/posição</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.secondarySave, { backgroundColor: cores.fundo, borderColor: cores.borda }]} onPress={salvarRanking} disabled={salvandoRanking}>
                <Ionicons name="save-outline" size={18} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                <Text style={[s.secondarySaveText, cores.isEscuro && { color: '#fff' }]}>{salvandoRanking ? 'Salvando...' : 'Salvar configuração de ranking'}</Text>
              </TouchableOpacity>

              <View style={[s.rankingDanger, { borderTopColor: cores.borda }]}>
                <View style={s.configHeader}>
                  <View style={s.dangerIcon}><Ionicons name="warning" size={21} color="#c62828" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardTitle, { color: cores.texto }]}>Zeragem anual</Text>
                    <Text style={[s.cardSub, { color: cores.textoSecundario }]}>O ranking considera somente {new Date().getFullYear()}. Antes da exclusão, o sistema gera um PDF completo e privado.</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    s.dangerButton,
                    (zerandoRanking || backupsRanking.some((b) => Number(b.ano) === new Date().getFullYear())) && s.disabledButton,
                  ]}
                  onPress={zerarRanking}
                  disabled={zerandoRanking || backupsRanking.some((b) => Number(b.ano) === new Date().getFullYear())}
                >
                  {zerandoRanking
                    ? <ActivityIndicator color="#fff" />
                    : <Ionicons name="trash-outline" size={19} color="#fff" />}
                  <Text style={s.dangerButtonText}>{zerandoRanking ? 'Gerando backup e zerando...' : `Zerar pontuação de ${new Date().getFullYear()}`}</Text>
                </TouchableOpacity>
                {backupsRanking.some((b) => Number(b.ano) === new Date().getFullYear()) && (
                  <Text style={[s.backupHint, { color: cores.textoSecundario }]}>A zeragem de {new Date().getFullYear()} já foi realizada. É permitido apenas um backup por ano.</Text>
                )}

                <Text style={[s.label, { color: cores.textoSecundario, marginTop: 8 }]}>Backups anuais</Text>
                {backupsRanking.length === 0 ? (
                  <Text style={[s.cardSub, { color: cores.textoSecundario }]}>Nenhum backup gerado.</Text>
                ) : backupsRanking.map((backup) => (
                  <TouchableOpacity
                    key={backup.id}
                    style={[s.backupRow, { backgroundColor: cores.fundo, borderColor: cores.borda }]}
                    onPress={() => baixarBackup(backup)}
                    disabled={baixandoBackupId === backup.id}
                  >
                    <View style={[s.backupIcon, { backgroundColor: cores.input }]}>
                      <Ionicons name="document-text" size={20} color={corIcone(cores)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.backupTitle, { color: cores.texto }]}>{backup.ano}</Text>
                      <Text numberOfLines={1} style={[s.backupName, { color: cores.textoSecundario }]}>{backup.nome_arquivo}</Text>
                    </View>
                    {baixandoBackupId === backup.id
                      ? <ActivityIndicator color={corIcone(cores)} />
                      : <Ionicons name="download-outline" size={22} color={corIcone(cores)} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : aba === 'clube' && podeConfigurarClube ? (
            <>
              <View style={[s.configCard, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
                <View style={s.configHeader}>
                  <View style={[s.docIcon, { backgroundColor: cores.input }]}><Ionicons name="book" size={20} color={corIcone(cores)} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardTitle, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Notificação do Ano Bíblico</Text>
                    <Text style={[s.cardSub, { color: cores.textoSecundario }]}>Envia a leitura do dia para os usuários vinculados ao clube. Ao tocar, abre direto o capítulo de hoje.</Text>
                  </View>
                </View>

                <TouchableOpacity style={s.checkRow} onPress={() => setAnoBiblicoPushAtivo((v) => !v)}>
                  <Ionicons name={anoBiblicoPushAtivo ? 'checkbox' : 'square-outline'} size={22} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                  <Text style={[s.checkText, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Enviar notificação diária</Text>
                </TouchableOpacity>

                <Text style={[s.label, { color: cores.textoSecundario }]}>Horário</Text>
                <View style={s.pushHoraRow}>
                  <TextInput
                    style={[s.input, s.pushHoraInput, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
                    value={anoBiblicoPushHora}
                    placeholder="06:00"
                    placeholderTextColor={cores.textoSecundario}
                    keyboardType="numbers-and-punctuation"
                    onBlur={() => setAnoBiblicoPushHora((v) => normalizarHoraPush(v))}
                    onChangeText={(v) => setAnoBiblicoPushHora(v.replace(/[^\d:]/g, '').slice(0, 5))}
                  />
                  <TouchableOpacity
                    style={[s.secondarySave, s.pushHoraSalvar, { backgroundColor: cores.fundo, borderColor: cores.borda }, salvandoAnoBiblicoPush && s.disabledButton]}
                    onPress={salvarAnoBiblicoPush}
                    disabled={salvandoAnoBiblicoPush}
                  >
                    {salvandoAnoBiblicoPush
                      ? <ActivityIndicator color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
                      : <Ionicons name="save-outline" size={18} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />}
                    <Text style={[s.secondarySaveText, cores.isEscuro && { color: '#fff' }]}>{salvandoAnoBiblicoPush ? 'Salvando...' : 'Salvar'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {podeConfigurarLogo && (
                <View style={[s.configCard, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
                  <View style={s.configHeader}>
                    <View style={[s.docIcon, { backgroundColor: cores.input }]}><Ionicons name="image" size={20} color={corIcone(cores)} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardTitle, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Logo do clube</Text>
                      <Text style={[s.cardSub, { color: cores.textoSecundario }]}>Aparece no topo das telas junto da foto do usuário.</Text>
                    </View>
                  </View>

                  {logoExibicao ? (
                    <Image key={logoExibicao} source={{ uri: logoExibicao }} style={[s.logoPreview, { backgroundColor: cores.fundo }]} resizeMode="contain" />
                  ) : (
                    <View style={[s.logoPreview, { backgroundColor: cores.fundo }, s.logoPreviewVazio, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
                      <Ionicons name="image-outline" size={32} color={cores.textoSecundario} />
                      <Text style={[s.logoVazioTexto, { color: cores.textoSecundario }]}>Nenhuma logo enviada ainda</Text>
                    </View>
                  )}

                  <TouchableOpacity style={[s.secondarySave, { backgroundColor: cores.fundo, borderColor: cores.borda }]} onPress={enviarLogo} disabled={enviandoLogo}>
                    {enviandoLogo ? <ActivityIndicator color={cores.isEscuro ? '#fff' : '#1a3a5c'} /> : <Ionicons name="cloud-upload-outline" size={18} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />}
                    <Text style={[s.secondarySaveText, cores.isEscuro && { color: '#fff' }]}>{enviandoLogo ? 'Enviando...' : logoUrl ? 'Trocar logo' : 'Enviar logo'}</Text>
                  </TouchableOpacity>

                  {!!logoUrl && (
                    <TouchableOpacity style={s.logoRemoverBtn} onPress={removerLogo}>
                      <Ionicons name="trash-outline" size={16} color="#c0392b" />
                      <Text style={s.logoRemoverTexto}>Remover logo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={!!modalPont} transparent animationType="slide" onRequestClose={() => setModalPont(null)}>
        {/* Dentro de um Modal nativo o Android não encolhe a janela sozinho
            (adjustResize só vale pra tela principal) — sem behavior="height"
            aqui, o teclado cobria metade da folha sem nenhum ajuste. */}
        <KeyboardAvoidingView style={[s.overlay, { backgroundColor: cores.overlay }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={[s.sheet, { backgroundColor: cores.cartao }]} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
            <Text style={[s.modalTitle, cores.isEscuro && { color: '#fff' }]}>{modalPont === 'novo' ? 'Nova pontuação' : 'Editar pontuação'}</Text>
            <Text style={[s.label, { color: cores.textoSecundario }]}>Título</Text>
            <TextInput style={[s.input, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={formPont.titulo} onChangeText={(v) => setFormPont((f) => ({ ...f, titulo: v }))} />
            <Text style={[s.label, { color: cores.textoSecundario }]}>Sigla</Text>
            <TextInput style={[s.input, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={formPont.sigla} autoCapitalize="characters" onChangeText={(v) => setFormPont((f) => ({ ...f, sigla: v }))} />
            <Text style={[s.label, { color: cores.textoSecundario }]}>Valor</Text>
            <TextInput style={[s.input, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={formPont.valor} keyboardType="numeric" onChangeText={(v) => setFormPont((f) => ({ ...f, valor: v }))} />
            <TouchableOpacity style={s.save} onPress={salvarPontuacao}><Text style={s.saveText}>Salvar</Text></TouchableOpacity>
            <TouchableOpacity style={s.cancel} onPress={() => setModalPont(null)}><Text style={[s.cancelText, { color: cores.textoSecundario }]}>Cancelar</Text></TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!modalDoc} transparent animationType="slide" onRequestClose={() => setModalDoc(null)}>
        <KeyboardAvoidingView style={[s.overlay, { backgroundColor: cores.overlay }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={[s.sheet, { backgroundColor: cores.cartao }]} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
            <Text style={[s.modalTitle, cores.isEscuro && { color: '#fff' }]}>{modalDoc === 'novo' ? 'Novo documento' : 'Editar documento'}</Text>
            <Text style={[s.label, { color: cores.textoSecundario }]}>Nome</Text>
            <TextInput style={[s.input, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={formDoc.nome} onChangeText={(v) => setFormDoc((f) => ({ ...f, nome: v, campo: f.campo || slugCampo(v) }))} />
            <Text style={[s.label, { color: cores.textoSecundario }]}>Campo técnico</Text>
            <TextInput style={[s.input, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={formDoc.campo} onChangeText={(v) => setFormDoc((f) => ({ ...f, campo: slugCampo(v) }))} />
            <Text style={[s.label, { color: cores.textoSecundario }]}>Limite de anexos</Text>
            <TextInput style={[s.input, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={formDoc.limite_anexos} keyboardType="numeric" onChangeText={(v) => setFormDoc((f) => ({ ...f, limite_anexos: v }))} />
            <TouchableOpacity style={s.checkRow} onPress={() => setFormDoc((f) => ({ ...f, obrigatorio: !f.obrigatorio }))}>
              <Ionicons name={formDoc.obrigatorio ? 'checkbox' : 'square-outline'} size={22} color={cores.isEscuro ? '#fff' : '#1a3a5c'} />
              <Text style={[s.checkText, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Documento obrigatório</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.save} onPress={salvarDocumento}><Text style={s.saveText}>Salvar</Text></TouchableOpacity>
            <TouchableOpacity style={s.cancel} onPress={() => setModalDoc(null)}><Text style={[s.cancelText, { color: cores.textoSecundario }]}>Cancelar</Text></TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 54, paddingHorizontal: 22, paddingBottom: 26, flexDirection: 'row', alignItems: 'center', gap: 14 },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  sub: { color: '#bdd2e6', fontSize: 14, marginTop: 2 },
  abaSelectWrap: { marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  abaSelectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#dbe4ec',
    paddingVertical: 12, paddingHorizontal: 14, elevation: 2,
  },
  abaSelectText: { flex: 1, color: '#1a3a5c', fontWeight: '800', fontSize: 14 },
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(10,20,35,0.35)', paddingTop: 150, paddingHorizontal: 16 },
  dropdownMenu: {
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 6,
    elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingHorizontal: 16,
  },
  dropdownItemAtivo: { backgroundColor: '#eef5fb' },
  dropdownItemText: { flex: 1, color: '#607d8b', fontWeight: '700', fontSize: 14 },
  dropdownItemTextAtivo: { color: '#1a3a5c' },
  content: { padding: 16, paddingBottom: 40 },
  add: { backgroundColor: '#1a3a5c', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 },
  addText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#dde6ee' },
  configCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#dbe6ef', gap: 10 },
  configHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inativo: { opacity: 0.48 },
  sigla: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center' },
  siglaText: { color: '#1a3a5c', fontWeight: '900' },
  docIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#eef5f9', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1f2933' },
  cardSub: { color: '#78909c', marginTop: 3 },
  smallBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f3f7fa', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, gap: 8 },
  modalTitle: { color: '#1a3a5c', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  label: { color: '#546e7a', fontWeight: '800', textTransform: 'uppercase', fontSize: 12, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#d7e0e8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#1f2933' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  checkText: { color: '#1f2933', fontWeight: '700' },
  pushHoraRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pushHoraInput: { flex: 1, minWidth: 96 },
  pushHoraSalvar: { minWidth: 126, marginTop: 0 },
  rankingDanger: { borderTopWidth: 1, marginTop: 10, paddingTop: 18, gap: 10 },
  dangerIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#ffebee', alignItems: 'center', justifyContent: 'center' },
  dangerButton: { minHeight: 48, borderRadius: 12, backgroundColor: '#c62828', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dangerButtonText: { color: '#fff', fontWeight: '900', fontSize: 14, textAlign: 'center' },
  disabledButton: { opacity: 0.48 },
  backupHint: { fontSize: 12, lineHeight: 17 },
  backupRow: { minHeight: 62, borderRadius: 12, borderWidth: 1, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backupIcon: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  backupTitle: { fontSize: 15, fontWeight: '900' },
  backupName: { fontSize: 11, marginTop: 2 },
  logoPreview: { width: '100%', height: 140, borderRadius: 12, backgroundColor: '#f3f7fb', marginBottom: 12 },
  logoPreviewVazio: { alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#dce5ee', borderStyle: 'dashed' },
  logoVazioTexto: { color: '#9aa5b1', fontSize: 12, fontWeight: '700' },
  logoRemoverBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, padding: 8 },
  logoRemoverTexto: { color: '#c0392b', fontWeight: '800', fontSize: 12 },
  dateGrid: { flexDirection: 'row', gap: 10 },
  secondarySave: { borderWidth: 1, borderColor: '#bfd0de', backgroundColor: '#f3f8fc', borderRadius: 14, padding: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondarySaveText: { color: '#1a3a5c', fontWeight: '900', fontSize: 15 },
  save: { backgroundColor: '#1a3a5c', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 10 },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  cancel: { padding: 14, alignItems: 'center' },
  cancelText: { color: '#78909c', fontWeight: '800' },
});
