import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { avisar, confirmar } from '../../src/stores/avisoStore';
import { useCores } from '../../src/stores/temaStore';
import { biometriaDisponivel, nomeBiometria } from '../../src/lib/dispositivoSeguro';
import {
  acessoOfflineSuportado, bloquearAcessoOffline, desbloquearComBiometria, desbloquearComPin, estaDesbloqueado,
  prepararAcessoOffline, renovarAcessoOffline, revogarAcessoOffline, situacaoAcessoOffline,
  type SituacaoAcessoOffline,
} from '../../src/lib/acessoOffline';
import { TAMANHO_PIN, validarFormatoPin } from '../../src/lib/acessoOfflineNucleo';

const PERFIS_DIRETORIA = ['admin_ti', 'admin_clube', 'usuario_diretoria', 'usuario_secretaria'];

const soNumeros = (v: string) => v.replace(/\D/g, '').slice(0, TAMANHO_PIN);
const dataBr = (ms: number) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function textoEspera(ms: number) {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`;
}

/** Sessão online utilizável agora? Sem rede ou com token vencido não bloqueia nada: só informa. */
async function sessaoOnline(): Promise<boolean> {
  try {
    const rede = await NetInfo.fetch();
    if (!rede.isConnected || rede.isInternetReachable === false) return false;
    const r = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    return !!r && !!(r as any).data?.session;
  } catch {
    return false;
  }
}

export default function AcampClassesScreen() {
  const cores = useCores();
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const [situacao, setSituacao] = useState<SituacaoAcessoOffline | null>(null);
  const [online, setOnline] = useState(false);
  const [liberado, setLiberado] = useState(estaDesbloqueado());
  const [bioDisp, setBioDisp] = useState(false);
  const [nomeBio, setNomeBio] = useState('biometria');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [usarBio, setUsarBio] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [agora, setAgora] = useState(Date.now());
  const bioTentada = useRef(false);

  const podePreparar = !!usuario && permissoes.temPerfil(PERFIS_DIRETORIA);

  const atualizar = useCallback(async () => {
    const [s, on, disp, nome] = await Promise.all([situacaoAcessoOffline(), sessaoOnline(), biometriaDisponivel(), nomeBiometria()]);
    setSituacao(s);
    setOnline(on);
    setBioDisp(disp);
    setNomeBio(nome);
    return s;
  }, []);

  // Ao abrir: lê a situação e, se já houver autorização, pede a biometria sozinha (uma vez por abertura).
  useFocusEffect(useCallback(() => {
    let ativo = true;
    (async () => {
      const s = await atualizar();
      if (!ativo) return;
      // Online e logado: renova o prazo em silêncio (a autorização acompanha o uso do app).
      if (s.valida && usuario && (await sessaoOnline())) {
        await renovarAcessoOffline({
          usuarioId: usuario.id, nome: usuario.nome, perfil: usuario.perfil, clubeId: getClubeAtivoId(),
        }).catch(() => {});
        if (ativo) await atualizar();
      }
      if (ativo && s.valida && s.concessao?.biometria && !estaDesbloqueado() && !bioTentada.current) {
        bioTentada.current = true;
        if (await desbloquearComBiometria()) setLiberado(true);
      }
    })();
    return () => { ativo = false; };
  }, [atualizar, usuario?.id]));

  // Trancado de novo sempre que o app sai de primeiro plano.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') { bloquearAcessoOffline(); setLiberado(false); setPin(''); bioTentada.current = false; }
    });
    return () => sub.remove();
  }, []);

  // Contagem regressiva da espera após erros de PIN.
  useEffect(() => {
    if (!situacao || situacao.tentativas.bloqueadoAte <= Date.now()) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [situacao]);

  const esperaMs = situacao ? Math.max(0, situacao.tentativas.bloqueadoAte - agora) : 0;

  async function enviarPin(valor: string) {
    if (ocupado || valor.length !== TAMANHO_PIN) return;
    setOcupado(true);
    try {
      const r = await desbloquearComPin(valor);
      setPin('');
      if (r.ok) { setMensagem(''); setLiberado(true); await atualizar(); return; }
      if (r.motivo === 'apagado') {
        setMensagem('PIN errado demais. A autorização foi apagada: entre com internet e prepare de novo.');
      } else if (r.motivo === 'bloqueado') {
        setMensagem(`Muitas tentativas. Aguarde ${textoEspera(r.restanteMs ?? 30000)}.`);
      } else if (r.motivo === 'incorreto') {
        setMensagem(`PIN incorreto. ${r.tentativasRestantes} tentativa(s) antes de apagar a autorização.`);
      } else {
        setMensagem('Autorização indisponível. Prepare o acesso com internet.');
      }
      setAgora(Date.now());
      await atualizar();
    } finally {
      setOcupado(false);
    }
  }

  async function preparar() {
    if (!usuario) return;
    const erro = validarFormatoPin(pin);
    if (erro) { setMensagem(erro); return; }
    if (pin !== pin2) { setMensagem('Os dois PINs não são iguais.'); return; }
    if (!(await sessaoOnline())) { setMensagem('Preparar exige internet e login ativo.'); return; }
    setOcupado(true);
    try {
      await prepararAcessoOffline(
        { usuarioId: usuario.id, nome: usuario.nome, perfil: usuario.perfil, clubeId: getClubeAtivoId() },
        pin, usarBio && bioDisp,
      );
      setPin(''); setPin2(''); setMensagem('');
      setLiberado(true);
      await atualizar();
      avisar('Pronto: o AcampClasses abre sem internet neste aparelho por 14 dias.', 'sucesso', 'Acesso offline');
    } catch (e: any) {
      setMensagem(e?.message ?? 'Não foi possível preparar o acesso offline.');
    } finally {
      setOcupado(false);
    }
  }

  async function removerAcesso() {
    const ok = await confirmar('Remover o acesso offline deste aparelho? Será preciso internet e um novo PIN para preparar de novo. Os lançamentos já salvos não são apagados.', 'Remover acesso offline');
    if (!ok) return;
    await revogarAcessoOffline();
    setLiberado(false);
    await atualizar();
  }

  function voltar() {
    if (router.canGoBack()) router.back(); else router.replace('/');
  }

  const cartao = [s.cartao, { backgroundColor: cores.cartao, borderColor: cores.borda }];
  const campo = [s.campo, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }];

  let corpo: React.ReactNode;
  if (!acessoOfflineSuportado) {
    corpo = (
      <View style={cartao}>
        <Text style={[s.titulo, { color: cores.texto }]}>Use o aplicativo instalado</Text>
        <Text style={[s.texto, { color: cores.textoSecundario }]}>O acesso offline com biometria ou PIN funciona no app do celular. No navegador, instale o PWA para abrir sem internet.</Text>
      </View>
    );
  } else if (!situacao) {
    corpo = <ActivityIndicator color={cores.acento} style={{ marginTop: 40 }} />;
  } else if (situacao.valida && !liberado) {
    corpo = (
      <View style={cartao}>
        <Ionicons name="lock-closed" size={28} color={cores.acento} />
        <Text style={[s.titulo, { color: cores.texto }]}>Desbloqueie o AcampClasses</Text>
        <Text style={[s.texto, { color: cores.textoSecundario }]}>
          {situacao.concessao?.nome ? `Autorizado para ${situacao.concessao.nome}. ` : ''}Vale até {situacao.concessao ? dataBr(situacao.concessao.expiraEm) : ''}.
        </Text>
        {situacao.concessao?.biometria ? (
          <TouchableOpacity style={[s.botaoSec, { borderColor: cores.borda }]} onPress={async () => { if (await desbloquearComBiometria()) setLiberado(true); }} accessibilityRole="button">
            <Ionicons name="finger-print" size={20} color={cores.acento} />
            <Text style={[s.botaoSecTxt, { color: cores.acento }]}>Usar {nomeBio}</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={[s.rotulo, { color: cores.texto }]}>Ou digite o PIN de {TAMANHO_PIN} números</Text>
        <TextInput
          style={[...campo, s.pin]} value={pin} onChangeText={(v) => { const n = soNumeros(v); setPin(n); if (n.length === TAMANHO_PIN) void enviarPin(n); }}
          keyboardType="number-pad" secureTextEntry maxLength={TAMANHO_PIN} editable={!ocupado && esperaMs === 0}
          accessibilityLabel="PIN do AcampClasses" autoComplete="off" importantForAutofill="no" textContentType="none"
        />
        {esperaMs > 0 ? <Text style={[s.aviso, { color: '#c62828' }]}>Muitas tentativas. Aguarde {textoEspera(esperaMs)}.</Text> : null}
        {mensagem ? <Text style={[s.aviso, { color: '#c62828' }]}>{mensagem}</Text> : null}
      </View>
    );
  } else if (situacao.valida && liberado) {
    corpo = (
      <>
        <View style={cartao}>
          <Ionicons name="checkmark-circle" size={28} color="#2e7d32" />
          <Text style={[s.titulo, { color: cores.texto }]}>Acesso liberado</Text>
          <Text style={[s.texto, { color: cores.textoSecundario }]}>Autorização offline válida até {situacao.concessao ? dataBr(situacao.concessao.expiraEm) : ''}.</Text>
          <Text style={[s.texto, { color: cores.textoSecundario }]}>
            {online ? 'Conectado: a sincronização usa a sua sessão.' : 'Sem internet ou sem sessão: o módulo abre e os lançamentos ficam salvos no aparelho. Para sincronizar, entre online — nada pendente é perdido.'}
          </Text>
        </View>
        <View style={cartao}>
          <Text style={[s.titulo, { color: cores.texto }]}>Módulo AcampClasses</Text>
          <Text style={[s.texto, { color: cores.textoSecundario }]}>A área de pontuação será ligada aqui. A porta de entrada offline já está pronta e protegida.</Text>
        </View>
        <TouchableOpacity style={[s.botaoSec, { borderColor: cores.borda }]} onPress={() => { bloquearAcessoOffline(); setLiberado(false); bioTentada.current = true; }} accessibilityRole="button">
          <Ionicons name="lock-closed-outline" size={18} color={cores.acento} />
          <Text style={[s.botaoSecTxt, { color: cores.acento }]}>Bloquear agora</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.link} onPress={removerAcesso} accessibilityRole="button">
          <Text style={[s.linkTxt, { color: '#c62828' }]}>Remover acesso offline deste aparelho</Text>
        </TouchableOpacity>
      </>
    );
  } else if (podePreparar) {
    corpo = (
      <View style={cartao}>
        <Ionicons name="cloud-offline-outline" size={28} color={cores.acento} />
        <Text style={[s.titulo, { color: cores.texto }]}>Preparar para usar sem internet</Text>
        <Text style={[s.texto, { color: cores.textoSecundario }]}>
          Com internet e logado, crie um PIN de {TAMANHO_PIN} números. Depois disso o AcampClasses abre sem rede por 14 dias, mesmo após fechar o app ou reiniciar o celular. O PIN fica só neste aparelho e nunca é a senha da sua conta.
          {situacao.motivoInvalida === 'expirada' ? ' (A autorização anterior expirou.)' : ''}
        </Text>
        <TextInput style={campo} value={pin} onChangeText={(v) => setPin(soNumeros(v))} keyboardType="number-pad" secureTextEntry maxLength={TAMANHO_PIN} placeholder="Novo PIN" placeholderTextColor={cores.textoSecundario} accessibilityLabel="Novo PIN" autoComplete="off" importantForAutofill="no" textContentType="none" />
        <TextInput style={campo} value={pin2} onChangeText={(v) => setPin2(soNumeros(v))} keyboardType="number-pad" secureTextEntry maxLength={TAMANHO_PIN} placeholder="Repita o PIN" placeholderTextColor={cores.textoSecundario} accessibilityLabel="Repita o PIN" autoComplete="off" importantForAutofill="no" textContentType="none" />
        {bioDisp ? (
          <View style={s.linha}>
            <Text style={[s.texto, { color: cores.texto, flex: 1 }]}>Desbloquear com {nomeBio}</Text>
            <Switch value={usarBio} onValueChange={setUsarBio} />
          </View>
        ) : null}
        {!online ? <Text style={[s.aviso, { color: '#c62828' }]}>Sem internet ou sem sessão ativa. Conecte-se para preparar.</Text> : null}
        {mensagem ? <Text style={[s.aviso, { color: '#c62828' }]}>{mensagem}</Text> : null}
        <TouchableOpacity style={[s.botao, (ocupado || !online) && { opacity: 0.6 }]} onPress={preparar} disabled={ocupado || !online} accessibilityRole="button">
          {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoTxt}>Preparar acesso offline</Text>}
        </TouchableOpacity>
      </View>
    );
  } else {
    const motivo = situacao.motivoInvalida === 'expirada' ? 'A autorização offline expirou.'
      : situacao.motivoInvalida === 'relogio' ? 'O relógio do aparelho foi alterado.'
      : 'Este aparelho ainda não foi preparado.';
    corpo = (
      <View style={cartao}>
        <Ionicons name="alert-circle-outline" size={28} color={cores.acento} />
        <Text style={[s.titulo, { color: cores.texto }]}>{motivo}</Text>
        <Text style={[s.texto, { color: cores.textoSecundario }]}>
          Entre no app com internet usando uma conta da diretoria e abra o AcampClasses para preparar o acesso offline.
        </Text>
        <TouchableOpacity style={s.botao} onPress={() => router.replace('/auth/login' as any)} accessibilityRole="button">
          <Text style={s.botaoTxt}>Ir para o login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[s.tela, { backgroundColor: cores.fundo }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.topo, { backgroundColor: cores.primaria }]}>
        <TouchableOpacity onPress={voltar} accessibilityRole="button" accessibilityLabel="Voltar" style={s.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topoTitulo}>AcampClasses</Text>
        <View style={[s.status, { backgroundColor: online ? '#2e7d32' : '#6d4c41' }]}>
          <Text style={s.statusTxt}>{online ? 'ONLINE' : 'OFFLINE'}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">{corpo}</ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 54 : 38, paddingBottom: 14 },
  voltar: { padding: 4 },
  topoTitulo: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '900' },
  status: { borderRadius: 14, paddingHorizontal: 9, paddingVertical: 4 },
  statusTxt: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  conteudo: { padding: 16, gap: 12 },
  cartao: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 10, alignItems: 'stretch' },
  titulo: { fontSize: 17, fontWeight: '900' },
  texto: { fontSize: 14, lineHeight: 20 },
  rotulo: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  campo: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  pin: { textAlign: 'center', fontSize: 24, letterSpacing: 8 },
  aviso: { fontSize: 13, fontWeight: '700' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botao: { backgroundColor: '#4b2bb0', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  botaoTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  botaoSec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 12 },
  botaoSecTxt: { fontWeight: '800', fontSize: 14 },
  link: { alignItems: 'center', paddingVertical: 10 },
  linkTxt: { fontSize: 13, fontWeight: '700' },
});
