import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { avisar } from '../../src/stores/avisoStore';

function QrCode({ uri }: { uri: string }) {
  if (Platform.OS === 'web') {
    return React.createElement('img', {
      src: uri,
      alt: 'QR Code do Google Authenticator',
      style: {
        width: 220,
        height: 220,
        backgroundColor: '#fff',
        borderRadius: 10,
        objectFit: 'contain',
      },
    });
  }

  return <Image source={{ uri }} style={styles.qr} resizeMode="contain" />;
}

export default function MfaScreen() {
  const modo = useAuthStore((s) => s.mfaPendente);
  const usuario = useAuthStore((s) => s.usuarioMfaPendente);
  const concluirMfa = useAuthStore((s) => s.concluirMfa);
  const cancelarMfa = useAuthStore((s) => s.cancelarMfa);
  const carregarContextos = useContextoStore((s) => s.carregarContextos);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [codigo, setCodigo] = useState('');
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [finalizando, setFinalizando] = useState(false);
  const codigoRef = useRef<TextInput>(null);

  const qrUri = useMemo(() => {
    if (!qr) return '';
    if (qr.startsWith('data:')) return qr;
    if (qr.startsWith('otpauth://')) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(qr)}`;
    }
    return `data:image/svg+xml;utf8,${encodeURIComponent(qr)}`;
  }, [qr]);

  useEffect(() => {
    if (!modo) return;
    if (modo === 'setup') iniciarCadastro();
    else carregarFatorVerificado();
  }, [modo]);

  if ((!modo || !usuario) && !finalizando) return <Redirect href="/auth/login" />;

  async function colarCodigo() {
    try {
      const texto = await Clipboard.getStringAsync();
      const code = texto.replace(/\D/g, '').slice(0, 6);
      if (!code) {
        avisar('Não encontrei nenhum código numérico na área de transferência.', 'info', 'Colar código');
        return;
      }
      setCodigo(code);
      setErro('');
      if (code.length === 6) {
        await verificarCodigo(code);
      }
    } catch {
      avisar('Não foi possível ler a área de transferência.', 'erro', 'Colar código');
    }
  }

  async function removerFatoresPendentes() {
    const mfa = (supabase.auth as any).mfa;
    const { data } = await mfa.listFactors();
    const pendentes = (data?.totp ?? []).filter((f: any) => f.status !== 'verified');
    for (const fator of pendentes) {
      await mfa.unenroll({ factorId: fator.id }).catch(() => {});
    }
  }

  async function iniciarCadastro() {
    setCarregando(true);
    setErro('');
    try {
      const mfa = (supabase.auth as any).mfa;
      await removerFatoresPendentes();
      const { data, error } = await mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Fonseca',
      });
      if (error) throw error;
      setFactorId(data.id);
      setQr(data.totp?.uri ?? data.totp?.qr_code ?? '');
      setSecret(data.totp?.secret ?? '');
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível iniciar a dupla autenticação.');
    } finally {
      setCarregando(false);
    }
  }

  async function carregarFatorVerificado() {
    setCarregando(true);
    setErro('');
    try {
      const mfa = (supabase.auth as any).mfa;
      const { data, error } = await mfa.listFactors();
      if (error) throw error;
      const fator = (data?.totp ?? []).find((f: any) => f.status === 'verified');
      if (!fator) {
        await iniciarCadastro();
        return;
      }
      setFactorId(fator.id);
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar o fator MFA.');
    } finally {
      setCarregando(false);
    }
  }

  async function verificarCodigo(codigoInformado = codigo) {
    if (carregando) return;
    const code = codigoInformado.trim().replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) {
      limparCodigoInvalido('Digite o código de 6 números do Google Authenticator.');
      return;
    }
    if (!factorId) {
      avisar('O fator de autenticação ainda está sendo preparado.', 'info', 'Aguarde');
      return;
    }

    setCarregando(true);
    setErro('');
    try {
      const mfa = (supabase.auth as any).mfa;
      const challenge = await mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verify.error) throw verify.error;

      setFinalizando(true);
      await concluirMfa();
      const auth = useAuthStore.getState();
      if (auth.consentimentoPendente) {
        router.replace('/auth/consent');
        return;
      }
      if (auth.usuario) {
        await carregarContextos(auth.usuario);
      }
      router.replace(useContextoStore.getState().selecaoPendente ? '/auth/contexto' : '/(tabs)');
    } catch (e: any) {
      limparCodigoInvalido('Código incorreto. Digite ou cole novamente.');
    } finally {
      setCarregando(false);
    }
  }

  function limparCodigoInvalido(mensagem: string) {
    setCodigo('');
    setErro(mensagem);
    setTimeout(() => codigoRef.current?.focus(), 80);
  }

  function alterarCodigo(valor: string) {
    const code = valor.replace(/\D/g, '').slice(0, 6);
    setCodigo(code);
    if (erro) setErro('');
    if (code.length === 6) {
      setTimeout(() => verificarCodigo(code), 0);
    }
  }

  async function sair() {
    if (modo === 'setup') {
      await removerFatoresPendentes().catch(() => {});
    }
    await cancelarMfa();
    router.replace('/auth/login');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={34} color="#fff" />
        </View>

        <Text style={styles.title}>Dupla autenticação</Text>
        <Text style={styles.subtitle}>
          {modo === 'setup'
            ? 'Como seu acesso é de diretoria/admin, cadastre o Google Authenticator para continuar.'
            : 'Digite o código do Google Authenticator para liberar o acesso.'}
        </Text>

        {modo === 'setup' && (
          <View style={styles.setupBox}>
            {carregando && !qrUri ? (
              <ActivityIndicator color="#1a3a5c" />
            ) : qrUri ? (
              <QrCode uri={qrUri} />
            ) : null}
            {secret ? (
              <>
                <Text style={styles.secretLabel}>Código manual</Text>
                <Text selectable style={styles.secret}>{secret}</Text>
              </>
            ) : null}
          </View>
        )}

        <Text style={styles.label}>Código de 6 dígitos</Text>
        <View style={styles.codigoField}>
          <TextInput
            ref={codigoRef}
            style={styles.input}
            value={codigo}
            onChangeText={alterarCodigo}
            placeholder="000000"
            keyboardType="number-pad"
            returnKeyType="go"
            autoFocus
            onSubmitEditing={() => verificarCodigo()}
          />
          <TouchableOpacity style={styles.pasteBtn} onPress={colarCodigo}>
            <Ionicons name="clipboard-outline" size={15} color="#1a3a5c" />
            <Text style={styles.pasteText}>Colar</Text>
          </TouchableOpacity>
        </View>

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, carregando && styles.btnDisabled]}
          onPress={() => verificarCodigo()}
          disabled={carregando}
        >
          {carregando
            ? <ActivityIndicator color="#fff" />
            : (
              <View style={styles.btnContent}>
                <Ionicons name="lock-open-outline" size={20} color="#fff" />
                <Text style={styles.btnText}>Verificar e entrar</Text>
              </View>
            )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={sair}>
          <Text style={styles.cancelText}>Cancelar login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a3a5c', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, elevation: 8 },
  iconCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '900', color: '#1a3a5c', textAlign: 'center' },
  subtitle: { color: '#607d8b', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 18 },
  setupBox: { width: '100%', alignItems: 'center', backgroundColor: '#f4f8fb', borderRadius: 14, padding: 14, marginBottom: 16 },
  qr: { width: 220, height: 220, backgroundColor: '#fff', borderRadius: 10 },
  secretLabel: { marginTop: 10, color: '#607d8b', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  secret: { marginTop: 4, color: '#1a3a5c', fontWeight: '900', textAlign: 'center' },
  label: { alignSelf: 'stretch', color: '#333', fontWeight: '800', marginBottom: 6 },
  codigoField: { alignSelf: 'stretch', position: 'relative', justifyContent: 'center' },
  input: { width: '100%', borderWidth: 1, borderColor: '#d8e0e7', borderRadius: 12, backgroundColor: '#fafafa', paddingVertical: 14, paddingLeft: 14, paddingRight: 92, fontSize: 22, fontWeight: '900', letterSpacing: 6, textAlign: 'center', color: '#1a3a5c', outlineStyle: 'none' as any },
  pasteBtn: { position: 'absolute', right: 8, top: 8, bottom: 8, paddingHorizontal: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, backgroundColor: '#eef3f8' },
  pasteText: { color: '#1a3a5c', fontWeight: '900', fontSize: 12 },
  erro: { color: '#c62828', marginTop: 10, textAlign: 'center' },
  btn: { alignSelf: 'stretch', marginTop: 18, backgroundColor: '#1a3a5c', borderRadius: 12, padding: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.65 },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  cancelBtn: { marginTop: 14, padding: 8 },
  cancelText: { color: '#78909c', fontWeight: '800' },
});
