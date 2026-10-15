import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCores } from '../stores/temaStore';
import { corIcone } from '../lib/tema';
import { avisar } from '../stores/avisoStore';
import { registrarAuditoria } from '../lib/auditoria';
import { getClubeAtivoId } from '../lib/contextoAtual';
import { PERFIS_EDITAVEIS } from '../lib/permissoesRemotas';
import {
  MENUS_CONFIGURAVEIS, MENUS_TRAVADOS_ADMIN_CLUBE, carregarMenusOcultos, salvarMenusOcultos, type MenusOcultos,
} from '../lib/menusPerfil';

const mesmaLista = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Admin do clube: escolhe quais menus da Início cada tipo de perfil enxerga. */
export function PainelMenusPerfil() {
  const cores = useCores();
  const clubeId = getClubeAtivoId();
  const [salvos, setSalvos] = useState<MenusOcultos>({});
  const [edicao, setEdicao] = useState<MenusOcultos>({});
  const [aberto, setAberto] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      const atual = await carregarMenusOcultos(clubeId);
      if (!ativo) return;
      setSalvos(atual);
      setEdicao(JSON.parse(JSON.stringify(atual)));
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [clubeId]));

  function alternar(perfil: string, menu: string) {
    setEdicao((atual) => {
      const lista = atual[perfil] ?? [];
      return { ...atual, [perfil]: lista.includes(menu) ? lista.filter((m) => m !== menu) : [...lista, menu] };
    });
  }

  function marcarTodos(perfil: string, visivel: boolean) {
    setEdicao((atual) => ({
      ...atual,
      [perfil]: visivel ? [] : MENUS_CONFIGURAVEIS.map((m) => m.id),
    }));
  }

  async function salvar(perfil: string, rotulo: string) {
    if (!clubeId) return;
    setSalvando(perfil);
    try {
      const novo: MenusOcultos = { ...salvos, [perfil]: edicao[perfil] ?? [] };
      if ((novo[perfil] ?? []).length === 0) delete novo[perfil];
      await salvarMenusOcultos(clubeId, novo);
      registrarAuditoria({
        acao: 'menus_perfil_alterados', entidade: 'clubes', entidadeId: String(clubeId),
        antes: { ocultos: salvos[perfil] ?? [] }, depois: { ocultos: edicao[perfil] ?? [] },
        metadata: { perfil: rotulo },
      });
      setSalvos(novo);
      avisar(`Menus de ${rotulo} salvos. Quem já está logado vê a mudança na próxima abertura do app.`, 'sucesso', 'Pronto');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar. Aplique a migration 152 no banco.', 'erro', 'Erro');
    } finally {
      setSalvando(null);
    }
  }

  const texto = { color: cores.texto };
  const suave = { color: cores.textoSecundario };

  if (carregando) return <ActivityIndicator style={{ marginTop: 40 }} color={corIcone(cores)} />;

  return (
    <View style={s.conteudo}>
      <Text style={[s.ajuda, suave]}>
        Marque os menus que cada tipo de perfil vê na tela Início. Desmarcar esconde o menu só para aquele perfil (ex.: tirar Aparência dos Desbravadores). O Admin TI sempre vê tudo. Esconder um menu não muda as permissões do perfil.
      </Text>

      {PERFIS_EDITAVEIS.map((perfil) => {
        const ocultos = edicao[perfil.chave] ?? [];
        const alterado = !mesmaLista(ocultos, salvos[perfil.chave] ?? []);
        const expandido = aberto === perfil.chave;
        return (
          <View key={perfil.chave} style={[s.card, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
            <TouchableOpacity style={s.cardTopo} activeOpacity={0.8} onPress={() => setAberto(expandido ? null : perfil.chave)}>
              <View style={{ flex: 1 }}>
                <Text style={[s.perfil, texto]}>{perfil.rotulo}</Text>
                <Text style={[s.sub, suave]}>
                  {ocultos.length === 0 ? 'Vê todos os menus' : `${ocultos.length} ${ocultos.length === 1 ? 'menu oculto' : 'menus ocultos'}`}{alterado ? ' · não salvo' : ''}
                </Text>
              </View>
              <Ionicons name={expandido ? 'chevron-up' : 'chevron-down'} size={20} color={cores.textoSecundario} />
            </TouchableOpacity>

            {expandido && (
              <View style={[s.corpo, { borderTopColor: cores.borda }]}>
                <View style={s.atalhos}>
                  <TouchableOpacity onPress={() => marcarTodos(perfil.chave, true)}><Text style={[s.atalho, { color: cores.acento }]}>Mostrar todos</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => marcarTodos(perfil.chave, false)}><Text style={[s.atalho, { color: cores.acento }]}>Ocultar todos</Text></TouchableOpacity>
                </View>
                {MENUS_CONFIGURAVEIS.map((m) => {
                  const visivel = !ocultos.includes(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id} style={s.linha} activeOpacity={0.7}
                      onPress={() => alternar(perfil.chave, m.id)}
                      accessibilityRole="checkbox" accessibilityState={{ checked: visivel }}
                    >
                      <Ionicons name={visivel ? 'checkbox' : 'square-outline'} size={23} color={corIcone(cores)} />
                      <Ionicons name={m.icone as any} size={18} color={cores.textoSecundario} />
                      <Text style={[s.rotulo, texto, !visivel && { opacity: 0.55 }]}>{m.rotulo}</Text>
                    </TouchableOpacity>
                  );
                })}
                {perfil.chave === 'admin_clube' ? <Text style={[s.ajuda, suave, { marginTop: 6 }]}>O menu Modelos nunca é escondido do Admin do clube.</Text> : null}

                <TouchableOpacity
                  style={[s.botaoSalvar, (!alterado || salvando === perfil.chave) && { opacity: 0.5 }]}
                  disabled={!alterado || salvando === perfil.chave}
                  onPress={() => salvar(perfil.chave, perfil.rotulo)}
                >
                  {salvando === perfil.chave ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                  <Text style={s.botaoSalvarTexto}>Salvar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  conteudo: { gap: 10 },
  ajuda: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  perfil: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 2 },
  corpo: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingBottom: 14 },
  atalhos: { flexDirection: 'row', gap: 18, paddingVertical: 10 },
  atalho: { fontSize: 13, fontWeight: '800' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  rotulo: { flex: 1, fontSize: 14, fontWeight: '700' },
  botaoSalvar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7c39e7', borderRadius: 22, padding: 12, marginTop: 10 },
  botaoSalvarTexto: { color: '#fff', fontWeight: '800' },
});
