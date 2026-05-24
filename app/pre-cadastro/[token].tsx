import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { buscarTermoAtivo, TERMO_LGPD_PADRAO } from '../../src/lib/lgpd';

interface LinkPreCadastro {
  id: string;
  clube_id: number;
  titulo: string | null;
}

const VAZIO = {
  nome: '',
  data_nascimento: '',
  genero: 'M',
  email: '',
  contato: '',
  camisa: '',
  calca: '',
  nome_responsavel: '',
  email_responsavel: '',
  contato_responsavel: '',
  parentesco_responsavel: '',
  observacoes: '',
};

type ResponsavelForm = {
  nome: string;
  email: string;
  telefone: string;
  parentesco: string;
};

const RESPONSAVEL_VAZIO: ResponsavelForm = {
  nome: '',
  email: '',
  telefone: '',
  parentesco: 'Responsável',
};

export default function PreCadastroScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = String(params.token ?? '');
  const [link, setLink] = useState<LinkPreCadastro | null>(null);
  const [termo, setTermo] = useState(TERMO_LGPD_PADRAO);
  const [form, setForm] = useState(VAZIO);
  const [responsaveis, setResponsaveis] = useState<ResponsavelForm[]>([{ ...RESPONSAVEL_VAZIO }]);
  const [aceite, setAceite] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      const [{ data, error }, termoAtivo] = await Promise.all([
        supabase
          .from('pre_cadastro_links')
          .select('id, clube_id, titulo')
          .eq('token', token)
          .eq('ativo', true)
          .maybeSingle(),
        buscarTermoAtivo().catch(() => null),
      ]);
      if (!ativo) return;
      if (error || !data) {
        setLink(null);
      } else {
        setLink(data as LinkPreCadastro);
      }
      setTermo(termoAtivo?.conteudo || TERMO_LGPD_PADRAO);
      setCarregando(false);
    }
    carregar();
    return () => { ativo = false; };
  }, [token]));

  function setCampo(campo: keyof typeof VAZIO, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function setResponsavel(index: number, campo: keyof ResponsavelForm, valor: string) {
    setResponsaveis((atuais) => atuais.map((r, i) => i === index ? { ...r, [campo]: valor } : r));
  }

  function adicionarResponsavel() {
    setResponsaveis((atuais) => [...atuais, { ...RESPONSAVEL_VAZIO }]);
  }

  function removerResponsavel(index: number) {
    setResponsaveis((atuais) => atuais.length <= 1 ? atuais : atuais.filter((_, i) => i !== index));
  }

  async function enviar() {
    if (!link) return;
    if (!form.nome.trim()) {
      Alert.alert('Pré-cadastro', 'Informe o nome completo.');
      return;
    }
    if (!aceite) {
      Alert.alert('LGPD', 'É necessário aceitar o termo para enviar o pré-cadastro.');
      return;
    }
    const responsaveisValidos = responsaveis
      .map((r) => ({
        nome: r.nome.trim(),
        email: r.email.trim().toLowerCase(),
        telefone: r.telefone.trim(),
        parentesco: r.parentesco.trim() || 'Responsável',
      }))
      .filter((r) => r.nome || r.email || r.telefone);

    if (responsaveisValidos.length === 0) {
      Alert.alert('Responsável', 'Informe pelo menos um responsável.');
      return;
    }

    if (responsaveisValidos.some((r) => !r.nome.trim())) {
      Alert.alert('Responsável', 'Todo responsável informado precisa ter nome.');
      return;
    }

    setEnviando(true);
    try {
      const principal = responsaveisValidos[0];
      const { data: pre, error } = await supabase.from('pre_cadastros').insert({
        clube_id: link.clube_id,
        link_id: link.id,
        nome: form.nome.trim(),
        data_nascimento: form.data_nascimento || null,
        genero: form.genero || null,
        email: form.email.trim() || null,
        contato: form.contato.trim() || null,
        camisa: form.camisa.trim() || null,
        calca: form.calca.trim() || null,
        nome_responsavel: principal.nome || null,
        email_responsavel: principal.email || null,
        contato_responsavel: principal.telefone || null,
        parentesco_responsavel: principal.parentesco || null,
        observacoes: form.observacoes.trim() || null,
        lgpd_aceito: true,
        lgpd_aceito_em: new Date().toISOString(),
      }).select('id, clube_id').single();
      if (error) throw error;

      const respPayload = responsaveisValidos.map((r, idx) => ({
        pre_cadastro_id: (pre as any).id,
        clube_id: link.clube_id,
        nome: r.nome,
        email: r.email || null,
        telefone: r.telefone || null,
        parentesco: r.parentesco,
        responsavel_principal: idx === 0,
      }));
      const { error: erroResp } = await supabase.from('pre_cadastro_responsaveis').insert(respPayload);
      if (erroResp) throw erroResp;

      setEnviado(true);
      setForm(VAZIO);
      setResponsaveis([{ ...RESPONSAVEL_VAZIO }]);
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível enviar o pré-cadastro.');
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#1a3a5c" />
        <Text style={s.centerText}>Carregando pré-cadastro...</Text>
      </View>
    );
  }

  if (!link) {
    return (
      <View style={s.center}>
        <Ionicons name="warning" size={48} color="#b42318" />
        <Text style={s.centerTitle}>Link indisponível</Text>
        <Text style={s.centerText}>Este link de pré-cadastro não existe, expirou ou foi desativado.</Text>
      </View>
    );
  }

  if (enviado) {
    return (
      <View style={s.center}>
        <Ionicons name="checkmark-circle" size={64} color="#2e7d32" />
        <Text style={s.centerTitle}>Pré-cadastro enviado</Text>
        <Text style={s.centerText}>A diretoria recebeu suas informações e fará a análise.</Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => setEnviado(false)}>
          <Text style={s.primaryText}>Enviar outro cadastro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <View style={s.logo}>
          <Ionicons name="person-add" size={28} color="#fff" />
        </View>
        <Text style={s.title}>{link.titulo || 'Pré-cadastro'}</Text>
        <Text style={s.subtitle}>Preencha os dados para análise da secretaria.</Text>
      </View>

      <View style={s.card}>
        <Campo label="Nome completo *">
          <TextInput style={s.input} value={form.nome} onChangeText={(v) => setCampo('nome', v)} placeholder="Nome do membro" />
        </Campo>
        <Campo label="Data de nascimento">
          <TextInput style={s.input} value={form.data_nascimento} onChangeText={(v) => setCampo('data_nascimento', v)} placeholder="AAAA-MM-DD" />
        </Campo>
        <Campo label="Gênero">
          <View style={s.row}>
            {[
              ['M', 'Masculino'],
              ['F', 'Feminino'],
            ].map(([valor, label]) => (
              <TouchableOpacity key={valor} style={[s.chip, form.genero === valor && s.chipAtivo]} onPress={() => setCampo('genero', valor)}>
                <Text style={[s.chipText, form.genero === valor && s.chipTextAtivo]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Campo>
        <Campo label="E-mail">
          <TextInput style={s.input} value={form.email} onChangeText={(v) => setCampo('email', v)} placeholder="email@exemplo.com" keyboardType="email-address" autoCapitalize="none" />
        </Campo>
        <Campo label="Telefone/WhatsApp">
          <TextInput style={s.input} value={form.contato} onChangeText={(v) => setCampo('contato', v)} placeholder="(00) 00000-0000" keyboardType="phone-pad" />
        </Campo>
        <View style={s.duasColunas}>
          <Campo label="Camisa">
            <TextInput style={s.input} value={form.camisa} onChangeText={(v) => setCampo('camisa', v)} placeholder="P, M, G..." />
          </Campo>
          <Campo label="Calça">
            <TextInput style={s.input} value={form.calca} onChangeText={(v) => setCampo('calca', v)} placeholder="10, 12, 38..." />
          </Campo>
        </View>
        <Text style={s.subsection}>Responsáveis com acesso ao app</Text>
        {responsaveis.map((resp, idx) => (
          <View key={idx} style={s.respBox}>
            <View style={s.respHead}>
              <Text style={s.respTitle}>Responsável {idx + 1}{idx === 0 ? ' · principal' : ''}</Text>
              {responsaveis.length > 1 ? (
                <TouchableOpacity onPress={() => removerResponsavel(idx)}>
                  <Ionicons name="trash-outline" size={20} color="#b42318" />
                </TouchableOpacity>
              ) : null}
            </View>
            <Campo label="Nome do responsável">
              <TextInput style={s.input} value={resp.nome} onChangeText={(v) => setResponsavel(idx, 'nome', v)} placeholder="Pai, mãe ou responsável" />
            </Campo>
            <Campo label="E-mail para acesso">
              <TextInput style={s.input} value={resp.email} onChangeText={(v) => setResponsavel(idx, 'email', v)} placeholder="responsavel@email.com" keyboardType="email-address" autoCapitalize="none" />
            </Campo>
            <Campo label="Telefone">
              <TextInput style={s.input} value={resp.telefone} onChangeText={(v) => setResponsavel(idx, 'telefone', v)} placeholder="(00) 00000-0000" keyboardType="phone-pad" />
            </Campo>
            <Campo label="Parentesco">
              <View style={s.row}>
                {['Pai', 'Mãe', 'Responsável', 'Avô/Avó', 'Outro'].map((valor) => (
                  <TouchableOpacity key={valor} style={[s.chip, resp.parentesco === valor && s.chipAtivo]} onPress={() => setResponsavel(idx, 'parentesco', valor)}>
                    <Text style={[s.chipText, resp.parentesco === valor && s.chipTextAtivo]}>{valor}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Campo>
          </View>
        ))}
        <TouchableOpacity style={s.addRespBtn} onPress={adicionarResponsavel}>
          <Ionicons name="add-circle-outline" size={18} color="#1a3a5c" />
          <Text style={s.addRespText}>Adicionar outro responsável</Text>
        </TouchableOpacity>
        <Campo label="Observações">
          <TextInput style={[s.input, s.textarea]} value={form.observacoes} onChangeText={(v) => setCampo('observacoes', v)} placeholder="Informações importantes" multiline />
        </Campo>
      </View>

      <View style={s.card}>
        <Text style={s.termoTitle}>Termo LGPD</Text>
        <Text style={s.termo}>{termo}</Text>
        <TouchableOpacity style={s.aceiteRow} onPress={() => setAceite((v) => !v)}>
          <Ionicons name={aceite ? 'checkbox' : 'square-outline'} size={24} color={aceite ? '#2e7d32' : '#789'} />
          <Text style={s.aceiteText}>Li e aceito o termo de consentimento e responsabilidade.</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[s.primaryBtn, (!aceite || enviando) && s.disabled]} onPress={enviar} disabled={!aceite || enviando}>
        {enviando ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
        <Text style={s.primaryText}>{enviando ? 'Enviando...' : 'Enviar pré-cadastro'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.campo}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  content: { padding: 18, paddingBottom: 42 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#eef3f8' },
  centerTitle: { color: '#1a3a5c', fontSize: 22, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  centerText: { color: '#667', fontSize: 14, textAlign: 'center', marginTop: 8 },
  header: { alignItems: 'center', paddingVertical: 24 },
  logo: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a3a5c', marginBottom: 12 },
  title: { color: '#1a3a5c', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: '#667', marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#dce5ee' },
  campo: { marginBottom: 12, flex: 1 },
  label: { color: '#5f7180', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#d4dde6', borderRadius: 12, paddingHorizontal: 12, color: '#1f2933', backgroundColor: '#fbfdff' },
  textarea: { minHeight: 92, textAlignVertical: 'top', paddingTop: 12 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderRadius: 20, borderWidth: 1, borderColor: '#d6dee8', paddingHorizontal: 14, paddingVertical: 10 },
  chipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  chipText: { color: '#1a3a5c', fontWeight: '800' },
  chipTextAtivo: { color: '#fff' },
  duasColunas: { flexDirection: 'row', gap: 10 },
  subsection: { color: '#1a3a5c', fontSize: 16, fontWeight: '900', marginTop: 8, marginBottom: 10 },
  respBox: { borderWidth: 1, borderColor: '#dce5ee', borderRadius: 14, padding: 12, marginBottom: 10, backgroundColor: '#f8fbfe' },
  respHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  respTitle: { color: '#1a3a5c', fontWeight: '900', fontSize: 14 },
  addRespBtn: { minHeight: 44, borderRadius: 12, backgroundColor: '#eef5fb', borderWidth: 1, borderColor: '#d6e5f2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 },
  addRespText: { color: '#1a3a5c', fontWeight: '900' },
  termoTitle: { color: '#1a3a5c', fontSize: 17, fontWeight: '900', marginBottom: 8 },
  termo: { color: '#465866', fontSize: 12, lineHeight: 18 },
  aceiteRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 14 },
  aceiteText: { flex: 1, color: '#223', fontWeight: '700' },
  primaryBtn: { minHeight: 52, backgroundColor: '#1a3a5c', borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  disabled: { backgroundColor: '#aab7c3' },
});
