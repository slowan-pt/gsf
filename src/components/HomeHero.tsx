import { ReactNode, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCores } from '../stores/temaStore';
import { Avatar, avatarCor, type BadgeFoto } from './common/Avatar';
import { FundoDegrade, useCoresDegrade } from './Gradiente';
import { Carrossel } from './Carrossel';
import { TituloSecao } from './ui';

/**
 * Bloco de boas-vindas (.hero): degradê da marca com raios, avatar com aro na
 * secundária, etiqueta inclinada, saudação em itálico, data e, quando o perfil
 * pode ver, a faixa de pontuação (.score-banner) que abre o próprio extrato.
 */
export function HeroInicio({ nome, data, fotoUrl, corAvatar, responsavel, pontos, posicao, rotuloPontos, aoAbrirPerfil, aoAbrirExtrato, classeAtual, aoAbrirClasse }: {
  /** Classe em andamento (para dar continuidade). */
  classeAtual?: { label: string; pct: number; emblema?: any } | null;
  aoAbrirClasse?: () => void;
  nome: string;
  data: string;
  fotoUrl?: string | null;
  corAvatar?: string;
  /** Nome do responsável logado quando o contexto é de responsável. */
  responsavel?: string | null;
  pontos?: number | null;
  posicao?: number | null;
  rotuloPontos?: string;
  aoAbrirPerfil?: () => void;
  aoAbrirExtrato?: () => void;
}) {
  const cores = useCores();
  const [de] = useCoresDegrade();
  const [, ate] = useCoresDegrade('#a747ef');
  const mostrarFaixa = pontos != null || posicao != null;
  if (classeAtual) {
    const comecou = classeAtual.pct > 0;
    return (
      <View style={{ marginBottom: 22 }}>
        <View style={[s.cartaoClasse, { boxShadow: `0px 5px 0px ${cores.profundo}` }]}>
          <FundoDegrade de={de} ate={ate} raios />
          <View style={s.classeCorpo}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={[s.etiqueta, { backgroundColor: cores.secundaria }]}>
                <Ionicons name="flash" size={11} color="#52266a" />
                <Text style={s.etiquetaTexto}>{comecou ? 'CLASSE EM ANDAMENTO' : 'PRÓXIMA CLASSE'}</Text>
              </View>
              <Text style={s.classeTitulo}>Próxima conquista:{'\n'}{classeAtual.label}!</Text>
              <Text style={s.classeSub}>
                {comecou ? `Você já completou ${classeAtual.pct}% dos requisitos.` : 'Comece os requisitos desta classe.'}
              </Text>
            </View>
            {classeAtual.emblema ? (
              <Image source={classeAtual.emblema} resizeMode="contain" style={s.classeEmblema} accessibilityIgnoresInvertColors />
            ) : null}
          </View>
          <View style={s.barraLinha} accessible accessibilityLabel={`Progresso: ${classeAtual.pct}%`}>
            <View style={s.barraFundo}>
              <View style={[s.barraCheia, { width: `${Math.max(2, Math.min(100, classeAtual.pct))}%`, backgroundColor: cores.secundaria }]} />
            </View>
            <Text style={s.barraPct}>{classeAtual.pct}%</Text>
          </View>
          <TouchableOpacity
            onPress={aoAbrirClasse}
            disabled={!aoAbrirClasse}
            accessibilityRole="button"
            accessibilityLabel={`Continuar ${classeAtual.label}`}
            style={[s.botaoContinuar, { backgroundColor: cores.secundaria }]}
          >
            <Text style={s.botaoContinuarTexto}>CONTINUAR</Text>
            <Ionicons name="arrow-forward" size={18} color="#3b2145" />
          </TouchableOpacity>
        </View>

        {mostrarFaixa ? (
          <TouchableOpacity
            onPress={aoAbrirExtrato}
            disabled={!aoAbrirExtrato}
            accessibilityRole="button"
            accessibilityLabel={`${rotuloPontos ?? 'Minha pontuação'}: ${pontos != null ? `${pontos} pontos` : ''}${posicao != null ? `, ${posicao}º lugar` : ''}`}
            style={[s.faixa, { backgroundColor: cores.secundaria, marginTop: 16 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.faixaRotulo}>{rotuloPontos ?? 'Minha pontuação'}</Text>
              {pontos != null ? <Text style={s.faixaPontos}>{pontos.toLocaleString('pt-BR')} pontos</Text> : null}
              {posicao != null ? <Text style={pontos != null ? s.faixaRotulo : s.faixaPontos}>{posicao}º lugar no ranking</Text> : null}
            </View>
            <Ionicons name="trophy-outline" size={30} color="#47214f" />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (!mostrarFaixa) return null;
  return (
    <View style={[s.hero, { boxShadow: `0px 5px 0px ${cores.profundo}` }]}>
      <FundoDegrade de={de} ate={ate} raios />
      {mostrarFaixa ? (
        <TouchableOpacity
          onPress={aoAbrirExtrato}
          disabled={!aoAbrirExtrato}
          accessibilityRole="button"
          accessibilityLabel={`${rotuloPontos ?? 'Minha pontuação'}: ${pontos != null ? `${pontos} pontos` : ''}${posicao != null ? `, ${posicao}º lugar` : ''}`}
          style={[s.faixa, { backgroundColor: cores.secundaria }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.faixaRotulo}>{rotuloPontos ?? 'Minha pontuação'}</Text>
            {pontos != null ? <Text style={s.faixaPontos}>{pontos.toLocaleString('pt-BR')} pontos</Text> : null}
            {posicao != null ? <Text style={pontos != null ? s.faixaRotulo : s.faixaPontos}>{posicao}º lugar no ranking</Text> : null}
          </View>
          <Ionicons name="trophy-outline" size={30} color="#47214f" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Pontos de um cartão de resumo (.card.compact). */
export function ResumoCompacto({ itens }: { itens: { valor: string | number; rotulo: string }[] }) {
  const cores = useCores();
  return (
    <View style={[s.compacto, { backgroundColor: cores.cartao, borderColor: cores.borda, boxShadow: `0px 4px 0px ${cores.sombra}` }]}>
      {itens.map((i) => (
        <View key={i.rotulo} style={s.compactoItem} accessible accessibilityLabel={`${i.rotulo}: ${i.valor}`}>
          <Text style={[s.compactoValor, { color: cores.texto }]}>{i.valor}</Text>
          <Text style={[s.compactoRotulo, { color: cores.textoSecundario }]}>{i.rotulo}</Text>
        </View>
      ))}
    </View>
  );
}

export interface PessoaCarrossel {
  id: number;
  nome: string;
  foto_url?: string | null;
  detalhe: string;
  badges?: BadgeFoto[];
}

/** Carrossel de pessoas (.person-tile) para aniversariantes e faltosos. */
export function PessoasCarrossel({ titulo, pessoas, aoAbrir, aoVerTodas }: {
  titulo: string;
  pessoas: PessoaCarrossel[];
  aoAbrir: (p: PessoaCarrossel) => void;
  /** Sem isto, "Ver todas" expande a lista completa aqui mesmo. */
  aoVerTodas?: () => void;
}) {
  const cores = useCores();
  const [aberta, setAberta] = useState(false);
  if (pessoas.length === 0) return null;
  const temMais = pessoas.length > 3;
  const renderPessoa = (p: PessoaCarrossel, lista = false) => (
    <TouchableOpacity
      key={p.id}
      onPress={() => aoAbrir(p)}
      accessibilityRole="button"
      accessibilityLabel={`${p.nome}, ${p.detalhe}. Ver mais`}
      style={[s.pessoa, lista && { width: '100%' }, { backgroundColor: cores.cartao, boxShadow: `0px 3px 0px ${cores.sombra}` }]}
    >
      <Avatar nome={p.nome} foto_url={p.foto_url ?? undefined} cor={avatarCor(p.nome)} size={40} badgeFotos={p.badges} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.pessoaNome, { color: cores.texto }]} numberOfLines={1}>{lista ? p.nome : p.nome.split(' ')[0]}</Text>
        <Text style={[s.pessoaDetalhe, { color: cores.textoSecundario }]} numberOfLines={1}>{p.detalhe}</Text>
      </View>
    </TouchableOpacity>
  );
  if (aberta) {
    return (
      <View style={s.secao}>
        <TituloSecao titulo={titulo} />
        <View style={{ gap: 8 }}>{pessoas.map((p) => renderPessoa(p, true))}</View>
        <TouchableOpacity onPress={() => setAberta(false)} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 12 }}>
          <Text style={{ color: cores.acento, fontWeight: '800' }}>Recolher</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={s.secao}>
      <TituloSecao titulo={titulo} />
      <Carrossel rotulo={titulo} topoSeta={8} aoVerTodas={temMais ? (aoVerTodas ?? (() => setAberta(true))) : undefined}>
        {pessoas.map((p) => renderPessoa(p))}
      </Carrossel>
    </View>
  );
}

export function Secao({ children }: { children: ReactNode }) {
  return <View style={s.secao}>{children}</View>;
}

const s = StyleSheet.create({
  hero: { borderRadius: 22, padding: 20, marginBottom: 22, overflow: 'hidden' },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  aro: { borderWidth: 3, borderRadius: 30, padding: 0 },
  etiqueta: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, transform: [{ rotate: '-3deg' }] },
  etiquetaTexto: { color: '#52266a', fontSize: 11, fontWeight: '900' },
  ola: { color: '#fff', fontSize: 25, fontWeight: '800', fontStyle: 'italic', marginTop: 10, marginBottom: 4 },
  data: { color: '#f7efff', fontSize: 13 },
  resp: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 6, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  respTexto: { color: '#fff', fontSize: 11, fontWeight: '700' },
  continuar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, minHeight: 44 },
  continuarTexto: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '800' },
  faixa: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18, marginTop: 18, boxShadow: '0px 4px 0px #bf9b17' },
  faixaRotulo: { color: '#63451d', fontSize: 13 },
  faixaPontos: { color: '#47214f', fontSize: 23, fontWeight: '800' },
  compacto: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 20, borderWidth: 1, marginBottom: 18 },
  compactoItem: { flex: 1, minWidth: 0, alignItems: 'center' },
  compactoValor: { fontSize: 19, fontWeight: '800' },
  compactoRotulo: { fontSize: 11 },
  secao: { marginVertical: 12 },
  pessoa: { width: 168, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 14 },
  pessoaNome: { fontSize: 12, fontWeight: '800' },
  pessoaDetalhe: { fontSize: 11 },
  pessoaMais: { fontSize: 11, fontWeight: '700' },
  saudacaoLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  saudacaoNome: { fontSize: 17, fontWeight: '900' },
  saudacaoData: { fontSize: 12, marginTop: 2 },
  cartaoClasse: { borderRadius: 22, padding: 20, overflow: 'hidden' },
  classeCorpo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  classeTitulo: { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.6, marginTop: 14 },
  classeSub: { color: '#f7efff', fontSize: 13, marginTop: 10 },
  classeEmblema: { width: 96, height: 96 },
  barraLinha: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  barraFundo: { flex: 1, height: 12, borderRadius: 20, backgroundColor: 'rgba(40,10,90,0.45)', overflow: 'hidden' },
  barraCheia: { height: '100%', borderRadius: 20 },
  barraPct: { color: '#fff', fontSize: 14, fontWeight: '900', minWidth: 38 },
  botaoContinuar: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 18, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 20, minHeight: 48, boxShadow: '0px 4px 0px #bf9b17' },
  botaoContinuarTexto: { color: '#3b2145', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
});

/**
 * Foto no formato quadrado arredondado do protótipo (borda grossa + sombra
 * sólida). Sem foto, mostra a inicial sobre a cor secundária.
 */
export function FotoQuadrada({ nome, fotoUrl, tamanho = 56 }: { nome: string; fotoUrl?: string | null; tamanho?: number }) {
  const cores = useCores();
  const [erro, setErro] = useState(false);
  const raio = Math.round(tamanho * 0.3);
  return (
    <View style={[q.quadro, { width: tamanho, height: tamanho, borderRadius: raio, backgroundColor: cores.secundaria, boxShadow: `0px 3px 0px ${cores.profundo}` }]}>
      {fotoUrl && !erro ? (
        <Image source={{ uri: fotoUrl }} onError={() => setErro(true)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Text style={[q.inicial, { fontSize: tamanho * 0.5 }]}>{(nome?.[0] ?? '?').toUpperCase()}</Text>
      )}
    </View>
  );
}

/** Saudação para o cabeçalho da Início: foto quadrada, "Olá, Nome!" e data · clube. */
export function SaudacaoCabecalho({ nome, fotoUrl, data, clube, responsavel, aoAbrirPerfil }: {
  nome: string; fotoUrl?: string | null; data: string; clube?: string | null; responsavel?: string | null; aoAbrirPerfil?: () => void;
}) {
  const detalhe = [data, clube].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity
      onPress={aoAbrirPerfil}
      disabled={!aoAbrirPerfil}
      accessibilityRole="button"
      accessibilityLabel={`Olá, ${nome}. Abrir meu perfil`}
      style={q.linha}
    >
      <FotoQuadrada nome={nome} fotoUrl={fotoUrl} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={q.ola} numberOfLines={1}>Olá, {nome}!</Text>
        <Text style={q.detalhe} numberOfLines={1}>{detalhe}</Text>
        {responsavel ? <Text style={q.detalhe} numberOfLines={1}>Responsável: {responsavel}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const q = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quadro: { borderWidth: 3, borderColor: '#ffffff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  inicial: { color: '#4b284d', fontWeight: '900' },
  ola: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  detalhe: { color: 'rgba(255,255,255,0.88)', fontSize: 12, marginTop: 2 },
});
