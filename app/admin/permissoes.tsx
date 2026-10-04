import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { usePermissoes, type Permissao } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { useCores } from '../../src/stores/temaStore';
import { corIcone } from '../../src/lib/tema';
import { avisar, useAvisoStore } from '../../src/stores/avisoStore';
import { registrarAuditoria } from '../../src/lib/auditoria';
import {
  PERFIS_EDITAVEIS, PERMISSOES_EDITAVEIS, PERMISSOES_TRAVADAS,
  lerMatrizParaEdicao, padraoDoPerfil, restaurarPadraoDoPerfil, salvarPermissoesDoPerfil,
} from '../../src/lib/permissoesRemotas';

const mesmoConjunto = (a: Permissao[], b: Permissao[]) =>
  a.length === b.length && a.every((p) => b.includes(p));

/** Admin TI: liga e desliga, por tipo de acesso, o que cada um pode fazer no app. */
export default function PermissoesAdmin() {
  const cores = useCores();
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const podeGerenciar = permissoes.pode('admin_plataforma');
  const [salvas, setSalvas] = useState<Record<string, Permissao[]>>({});
  const [edicao, setEdicao] = useState<Record<string, Permissao[]>>({});
  const [aberto, setAberto] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const matriz = await lerMatrizParaEdicao();
      setSalvas(matriz);
      setEdicao(JSON.parse(JSON.stringify(matriz)));
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível carregar as permissões. Aplique a migration 127 no banco.', 'erro', 'Erro');
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  function alternar(perfil: string, permissao: Permissao) {
    if ((PERMISSOES_TRAVADAS[perfil] ?? []).includes(permissao)) return;
    setEdicao((atual) => {
      const lista = atual[perfil] ?? [];
      return { ...atual, [perfil]: lista.includes(permissao) ? lista.filter((p) => p !== permissao) : [...lista, permissao] };
    });
  }

  async function salvar(perfil: string, rotulo: string) {
    setSalvando(perfil);
    try {
      await salvarPermissoesDoPerfil(perfil, edicao[perfil] ?? []);
      registrarAuditoria({
        acao: 'permissoes_perfil_alteradas', entidade: 'perfil_permissoes', entidadeId: perfil,
        antes: { permissoes: salvas[perfil] ?? [] }, depois: { permissoes: edicao[perfil] ?? [] },
        metadata: { perfil: rotulo },
      });
      setSalvas((s) => ({ ...s, [perfil]: [...(edicao[perfil] ?? [])] }));
      avisar(`Permissões de ${rotulo} salvas. Quem já está logado recebe na próxima abertura do app.`, 'sucesso', 'Pronto');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar.', 'erro', 'Erro');
    } finally {
      setSalvando(null);
    }
  }

  function confirmarRestaurar(perfil: string, rotulo: string) {
    useAvisoStore.getState().mostrar({
      titulo: 'Restaurar padrão?',
      mensagem: `As permissões de ${rotulo} voltam ao padrão de fábrica.`,
      tipo: 'info',
      botoes: [
        { texto: 'Cancelar', estilo: 'cancelar' },
        {
          texto: 'Restaurar', estilo: 'padrao',
          onPress: async () => {
            try {
              await restaurarPadraoDoPerfil(perfil);
              await carregar();
            } catch (e: any) {
              avisar(e?.message ?? 'Não foi possível restaurar.', 'erro', 'Erro');
            }
          },
        },
      ],
    });
  }

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeGerenciar) return <Redirect href="/" />;

  const texto = { color: cores.texto };
  const suave = { color: cores.textoSecundario };

  return (
    <View style={[s.container, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Permissões" />

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={corIcone(cores)} />
      ) : (
        <ScrollView contentContainerStyle={s.conteudo}>
          <Text style={[s.ajuda, suave]}>
            Marque o que cada perfil pode fazer. Itens com “Banco” também são exigidos pelo servidor. Os demais controlam só o que aparece no app.
            O Admin TI sempre tem acesso total.
          </Text>

          {PERFIS_EDITAVEIS.map((perfil) => {
            const atuais = edicao[perfil.chave] ?? [];
            const alterado = !mesmoConjunto(atuais, salvas[perfil.chave] ?? []);
            const ehPadrao = mesmoConjunto(atuais, padraoDoPerfil(perfil.chave));
            const expandido = aberto === perfil.chave;
            return (
              <View key={perfil.chave} style={[s.card, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
                <TouchableOpacity style={s.cardTopo} activeOpacity={0.8} onPress={() => setAberto(expandido ? null : perfil.chave)}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.perfil, texto]}>{perfil.rotulo}</Text>
                    <Text style={[s.sub, suave]}>
                      {atuais.length} {atuais.length === 1 ? 'permissão' : 'permissões'}{ehPadrao ? ' · padrão' : ' · personalizado'}{alterado ? ' · não salvo' : ''}
                    </Text>
                  </View>
                  <Ionicons name={expandido ? 'chevron-up' : 'chevron-down'} size={20} color={cores.textoSecundario} />
                </TouchableOpacity>

                {expandido && (
                  <View style={[s.corpo, { borderTopColor: cores.borda }]}>
                    {PERMISSOES_EDITAVEIS.map((p) => {
                      const marcada = atuais.includes(p.chave);
                      const travada = (PERMISSOES_TRAVADAS[perfil.chave] ?? []).includes(p.chave);
                      return (
                        <TouchableOpacity key={p.chave} style={s.linha} activeOpacity={travada ? 1 : 0.7} onPress={() => alternar(perfil.chave, p.chave)}>
                          <Ionicons
                            name={marcada ? 'checkbox' : 'square-outline'} size={24}
                            color={travada ? '#9e9e9e' : corIcone(cores)}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[s.rotulo, texto]}>
                              {p.rotulo}
                              {p.noBanco ? <Text style={[s.tagBanco, cores.isEscuro && { color: '#9cc2ff' }]}>  Banco</Text> : null}
                              {travada ? <Text style={[s.tagTravada, suave]}>  fixa</Text> : null}
                            </Text>
                            <Text style={[s.descricao, suave]}>{p.descricao}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    <View style={s.botoes}>
                      <TouchableOpacity
                        style={[s.botaoSalvar, (!alterado || salvando === perfil.chave) && { opacity: 0.5 }]}
                        disabled={!alterado || salvando === perfil.chave}
                        onPress={() => salvar(perfil.chave, perfil.rotulo)}
                      >
                        {salvando === perfil.chave ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                        <Text style={s.botaoSalvarTexto}>Salvar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.botaoSec, { borderColor: cores.borda }, ehPadrao && !alterado && { opacity: 0.5 }]}
                        disabled={ehPadrao && !alterado}
                        onPress={() => confirmarRestaurar(perfil.chave, perfil.rotulo)}
                      >
                        <Text style={[s.botaoSecTexto, texto]}>Restaurar padrão</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { padding: 16, paddingBottom: 48, gap: 10 },
  ajuda: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  perfil: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 2 },
  corpo: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingBottom: 14 },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  rotulo: { fontSize: 14, fontWeight: '700' },
  descricao: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  tagBanco: { fontSize: 10, fontWeight: '800', color: '#1565c0' },
  tagTravada: { fontSize: 10, fontWeight: '700' },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 8 },
  botaoSalvar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7c39e7', borderRadius: 22, padding: 12 },
  botaoSalvarTexto: { color: '#fff', fontWeight: '800' },
  botaoSec: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12, padding: 12 },
  botaoSecTexto: { fontWeight: '700' },
});
