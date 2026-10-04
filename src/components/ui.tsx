import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCores } from '../stores/temaStore';
import { estiloCartao, textoSobre } from '../lib/tema';

/**
 * Componentes do protótipo aprovado (dbvp-frontend). Medidas, raios e sombras
 * sólidas seguem o CSS de referência: .card, .chips, .tabs, .search, .tag,
 * .btn, .jump, .row e .empty. Primária/secundária vêm da paleta do usuário.
 */

/** Tons das tags/selos (.tag, .tag.green, .tag.orange e variações). */
export const TONS = {
  roxo:    { fundo: '#ebe0fc', fundoEscuro: '#3b2a55', texto: '', textoEscuro: '#d2b5ff' },
  verde:   { fundo: '#dcf6c2', fundoEscuro: '#234633', texto: '#3e651c', textoEscuro: '#c7f4b4' },
  laranja: { fundo: '#ffe3b1', fundoEscuro: '#4e371b', texto: '#7b4b09', textoEscuro: '#ffda94' },
  amarelo: { fundo: '#fff1c7', fundoEscuro: '#42341e', texto: '#75500e', textoEscuro: '#f4dfac' },
  ciano:   { fundo: '#c9f7f5', fundoEscuro: '#173f45', texto: '#155a63', textoEscuro: '#9ef0f4' },
  vermelho:{ fundo: '#ffe0e3', fundoEscuro: '#4a1f27', texto: '#9b1c2c', textoEscuro: '#ffb3bd' },
} as const;
export type Tom = keyof typeof TONS;

/** Cartão (.card): painel, borda fina, raio 20, sombra sólida inferior. */
export function Cartao({ children, onPress, style, rotulo, destaque }: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  rotulo?: string;
  destaque?: boolean;
}) {
  const cores = useCores();
  const estilo = [estiloCartao(cores), s.cartao, destaque && s.destaque, destaque && { backgroundColor: cores.isEscuro ? '#40321e' : '#fff2b6' }, style];
  if (!onPress) return <View style={estilo}>{children}</View>;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} accessibilityRole="button" accessibilityLabel={rotulo} style={estilo}>
      {children}
    </TouchableOpacity>
  );
}

/** Chip de filtro (.chips button): selecionado = preenchido com a primária. */
export function Chip({ rotulo, ativo, onPress, icone, contagem, cor }: {
  rotulo: string; ativo?: boolean; onPress: () => void; icone?: string; contagem?: number;
  /** Cor própria quando ativo (ex.: cor da unidade); padrão é a primária. */
  cor?: string;
}) {
  const cores = useCores();
  const fundoAtivo = cor ?? cores.primaria;
  const texto = ativo ? textoSobre(fundoAtivo) : cores.texto;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!ativo }}
      accessibilityLabel={contagem != null ? `${rotulo}, ${contagem}` : rotulo}
      style={[s.chip, { backgroundColor: ativo ? fundoAtivo : cores.cartao, borderColor: ativo ? fundoAtivo : cores.borda }]}
    >
      {icone ? <Ionicons name={icone as any} size={14} color={texto} /> : null}
      <Text style={[s.chipTexto, { color: texto }]} numberOfLines={1}>{rotulo}</Text>
      {contagem != null ? <Text style={[s.chipTexto, { color: texto, opacity: 0.85 }]}>({contagem})</Text> : null}
    </TouchableOpacity>
  );
}

export interface OpcaoSegmento<T extends string> {
  valor: T;
  rotulo: string;
  /** Destaque de "sua categoria" (borda e selo "Você"), independente da seleção. */
  minha?: boolean;
  contagem?: number;
}

/** Abas segmentadas (.tabs): container branco, selecionada preenchida com sombra sólida. */
export function Segmentado<T extends string>({ opcoes, valor, onChange, style }: {
  opcoes: OpcaoSegmento<T>[];
  valor: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const cores = useCores();
  return (
    <View style={[s.segmentos, { backgroundColor: cores.cartao }, style]} accessibilityRole="tablist">
      {opcoes.map((o) => {
        const sel = o.valor === valor;
        return (
          <TouchableOpacity
            key={o.valor}
            onPress={() => onChange(o.valor)}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={o.minha ? `${o.rotulo} (sua categoria)` : o.rotulo}
            style={[
              s.segmento,
              sel && { backgroundColor: cores.primaria, boxShadow: `0px 3px 0px ${cores.profundo}` },
              o.minha && { borderColor: sel ? cores.secundaria : '#f19f10' },
            ]}
          >
            <Text style={[s.segmentoTexto, { color: sel ? textoSobre(cores.primaria) : cores.textoSecundario }]} numberOfLines={1}>
              {o.rotulo}{o.contagem != null ? ` (${o.contagem})` : ''}
            </Text>
            {o.minha ? (
              <View style={[s.voce, { backgroundColor: cores.secundaria }]}>
                <Text style={[s.voceTexto, { color: textoSobre(cores.secundaria) === '#ffffff' ? '#ffffff' : '#542559' }]}>Você</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Campo de busca (.search). */
export function CampoBusca({ valor, onChange, placeholder = 'Buscar', ...resto }: {
  valor: string; onChange: (v: string) => void; placeholder?: string;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'onChange' | 'placeholder'>) {
  const cores = useCores();
  return (
    <View style={[s.busca, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
      <Ionicons name="search" size={17} color={cores.textoSecundario} />
      <TextInput
        {...resto}
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={cores.placeholder}
        accessibilityLabel={placeholder}
        style={[s.buscaInput, { color: cores.texto }]}
      />
      {valor ? (
        <TouchableOpacity onPress={() => onChange('')} accessibilityLabel="Limpar busca" hitSlop={10}>
          <Ionicons name="close-circle" size={18} color={cores.textoSecundario} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Tag (.tag). `tom` padrão usa fundo suave e texto na cor da marca. */
export function Tag({ texto, tom = 'roxo', icone }: { texto: string; tom?: Tom; icone?: string }) {
  const cores = useCores();
  const t = TONS[tom];
  const cor = tom === 'roxo' ? cores.acento : (cores.isEscuro ? t.textoEscuro : t.texto);
  const fundo = tom === 'roxo' ? cores.acentoSuave : (cores.isEscuro ? t.fundoEscuro : t.fundo);
  return (
    <View style={[s.tag, { backgroundColor: fundo }]}>
      {icone ? <Ionicons name={icone as any} size={11} color={cor} /> : null}
      <Text style={[s.tagTexto, { color: cor }]}>{texto}</Text>
    </View>
  );
}

/** Mantido por compatibilidade: mesmo visual da Tag. */
export function Selo(props: { texto: string; tom?: Tom; icone?: string }) {
  return <Tag {...props} />;
}

/** Botão (.btn): secundária com sombra sólida; `secundario` = fundo suave. */
export function Botao({ rotulo, onPress, icone, secundario, bloco, desabilitado }: {
  rotulo: string; onPress: () => void; icone?: string; secundario?: boolean; bloco?: boolean; desabilitado?: boolean;
}) {
  const cores = useCores();
  const fundo = secundario ? cores.acentoSuave : cores.secundaria;
  const texto = secundario ? cores.acento : '#4b284d';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={desabilitado}
      accessibilityRole="button"
      style={[
        s.botao,
        { backgroundColor: fundo, boxShadow: `0px ${secundario ? 3 : 4}px 0px ${secundario ? cores.sombra : '#be971d'}` },
        bloco && { alignSelf: 'stretch' },
        desabilitado && { opacity: 0.55 },
      ]}
    >
      {icone ? <Ionicons name={icone as any} size={16} color={texto} /> : null}
      <Text style={[s.botaoTexto, { color: texto }]}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

/** Título de seção (.section-head) com ação opcional (.jump). */
export function TituloSecao({ titulo, acao, aoAcao, subtitulo }: { titulo: string; acao?: string; aoAcao?: () => void; subtitulo?: string }) {
  const cores = useCores();
  return (
    <View style={s.tituloLinha}>
      <Text style={[s.titulo, { color: cores.texto }]} accessibilityRole="header">{titulo}</Text>
      {acao && aoAcao ? (
        <TouchableOpacity onPress={aoAcao} accessibilityRole="button" style={[s.jump, { backgroundColor: cores.acentoSuave }]}>
          <Text style={[s.jumpTexto, { color: cores.acento }]}>{acao}</Text>
        </TouchableOpacity>
      ) : subtitulo ? (
        <Text style={[s.subtitulo, { color: cores.textoSecundario }]}>{subtitulo}</Text>
      ) : null}
    </View>
  );
}

/** Estado vazio/erro (.empty): ilustração, título e texto centralizados. */
export function EstadoVazio({ icone = 'sparkles-outline', titulo, texto, acao, aoAcao }: {
  icone?: string; titulo: string; texto?: string; acao?: string; aoAcao?: () => void;
}) {
  const cores = useCores();
  return (
    <View style={s.vazio} accessible accessibilityLabel={texto ? `${titulo}. ${texto}` : titulo}>
      <View style={[s.vazioIcone, { backgroundColor: cores.acentoSuave }]}>
        <Ionicons name={icone as any} size={30} color={cores.acento} />
      </View>
      <Text style={[s.vazioTitulo, { color: cores.texto }]}>{titulo}</Text>
      {texto ? <Text style={[s.vazioTexto, { color: cores.textoSecundario }]}>{texto}</Text> : null}
      {acao && aoAcao ? <View style={{ marginTop: 10 }}><Botao rotulo={acao} onPress={aoAcao} /></View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  cartao: { padding: 18, marginBottom: 18 },
  destaque: { borderWidth: 3, borderColor: '#f2ad19' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 8, minHeight: 38, borderRadius: 12, borderWidth: 1, justifyContent: 'center' },
  chipTexto: { fontSize: 12, fontWeight: '800' },
  segmentos: { flexDirection: 'row', gap: 5, borderRadius: 14, padding: 5 },
  segmento: { flex: 1, minWidth: 0, minHeight: 40, borderWidth: 2, borderColor: 'transparent', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  segmentoTexto: { fontSize: 12, fontWeight: '800' },
  voce: { position: 'absolute', bottom: -13, alignSelf: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  voceTexto: { fontSize: 10, fontWeight: '800' },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 15, paddingHorizontal: 16, minHeight: 52 },
  buscaInput: { flex: 1, fontSize: 16, paddingVertical: 14 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7 },
  tagTexto: { fontSize: 11, fontWeight: '700' },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 17, minHeight: 44 },
  botaoTexto: { fontSize: 13, fontWeight: '900' },
  tituloLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  titulo: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 },
  subtitulo: { fontSize: 13 },
  jump: { borderRadius: 11, paddingVertical: 9, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  jumpTexto: { fontSize: 12, fontWeight: '800' },
  vazio: { alignItems: 'center', paddingVertical: 42, paddingHorizontal: 18, gap: 8 },
  vazioIcone: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  vazioTitulo: { fontSize: 20, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  vazioTexto: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
