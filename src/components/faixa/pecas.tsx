import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type { EspecialidadeCatalogo } from '../../lib/especialidades';
import { chaveEspecialidade, type FaixaMestrados, type MestradoNaFaixa } from '../../lib/mestrados';

export interface Membro { id: number; nome: string; genero: string | null; idade: number | null }
export interface Conquista { nome: string; insignia: string | null; catalogo: EspecialidadeCatalogo | null; concluidaEm: string | null; aguardando: boolean }

/** Velocidade do giro automático da faixa (px/ms): bem devagar. */
export const VELOCIDADE_AUTO = 0.014;

/** Uma linha da faixa: ou o mestrado (divisória) ou uma fileira de especialidades. */
export type LinhaFaixa = { tipo: 'divisor'; mestrado: MestradoNaFaixa } | { tipo: 'itens'; itens: Conquista[] };

/** Fora de um mestrado: por área (sem área, por último) e, dentro dela, por nome. */
export function organizarPorArea(lista: Conquista[]): Conquista[] {
  const peso = (c: Conquista) => ((c.catalogo?.categoria ?? '').trim() ? 0 : 1);
  const area = (c: Conquista) => (c.catalogo?.categoria ?? '').trim();
  return [...lista].sort((a, b) =>
    peso(a) - peso(b) || area(a).localeCompare(area(b), 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Cada mestrado conquistado é uma divisória; logo abaixo ficam todas as especialidades conquistadas do
 * grupo dele (sem repetir nenhuma). O que não pertence a mestrado conquistado vem depois, por área.
 */
export function montarLinhas(itens: Conquista[], faixa: FaixaMestrados, colunas: number): LinhaFaixa[] {
  const linhas: LinhaFaixa[] = [];
  const usados = new Set<string>();
  const empacotar = (lista: Conquista[]) => {
    for (let i = 0; i < lista.length; i += colunas) linhas.push({ tipo: 'itens', itens: lista.slice(i, i + colunas) });
  };
  for (const m of faixa.mestrados) {
    const doGrupo = itens
      .filter((c) => !usados.has(c.nome) && faixa.grupos[chaveEspecialidade(c.nome)] === m.id)
      .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
    doGrupo.forEach((c) => usados.add(c.nome));
    linhas.push({ tipo: 'divisor', mestrado: m });
    empacotar(doGrupo);
  }
  empacotar(itens.filter((c) => !usados.has(c.nome)));
  return linhas;
}

/** Nome para a tarja: o completo se couber; senão primeiro + último; senão só o primeiro. Sempre numa linha. */
export function nomeNaTarja(nome: string, larguraDisponivel: number, alturaDisponivel: number) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const candidatos = [partes.join(' '), partes.length > 2 ? `${partes[0]} ${partes[partes.length - 1]}` : '', partes[0] ?? ''].filter(Boolean);
  const maximo = alturaDisponivel * 0.64;
  for (const c of candidatos) {
    const t = Math.min(maximo, larguraDisponivel / (c.length * 0.76));
    if (t >= maximo * 0.48) return { texto: c.toLocaleUpperCase('pt-BR'), tamanho: t };
  }
  const c = candidatos[candidatos.length - 1] ?? '';
  return { texto: c.toLocaleUpperCase('pt-BR'), tamanho: Math.max(7, Math.min(maximo, larguraDisponivel / Math.max(1, c.length * 0.76))) };
}

export function dataBr(iso?: string | null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/** Tamanho (px da tela) do ícone: grande o bastante para tocar, sempre dentro da faixa. */
export const ICONE_ALVO = 46;
/** Largura máxima da cena: em tela larga a foto não estica nem mostra bordas vazias. */
export const LARGURA_MAXIMA = 480;
/** Cor da faixa: os ícones se dissolvem nela ao entrar sob a plaquinha do nome. */
export const COR_FAIXA = '#021f1a';
/** Posição inicial da esteira (grande, para o módulo nunca ficar negativo ao rolar para os dois lados). */
export const BASE_ESTEIRA = 1_000_000;

export function IconeFaixa({ url, tamanho, aguardando = false }: { url: string | null; tamanho: number; aguardando?: boolean }) {
  const [erro, setErro] = useState(false);
  const corpo = url && !erro ? (
    <Image source={{ uri: url }} onError={() => setErro(true)} resizeMode="contain" style={{ width: tamanho, height: tamanho }} />
  ) : (
    <View style={{ width: tamanho * 0.9, height: tamanho * 0.9, borderRadius: tamanho * 0.45, backgroundColor: '#f2c14e', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="ribbon" size={tamanho * 0.5} color="#432958" />
    </View>
  );
  if (!aguardando) return corpo;
  // Tarja de "aguardando" (investidura) sobre a parte de baixo do ícone.
  return (
    <View style={{ width: tamanho, height: tamanho, alignItems: 'center', justifyContent: 'center' }}>
      {corpo}
      <View style={{ position: 'absolute', left: -2, right: -2, bottom: tamanho * 0.08, height: Math.max(9, tamanho * 0.26), borderRadius: 4, backgroundColor: '#e8420f', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' }}>
        <Text numberOfLines={1} style={{ color: '#fff', fontSize: Math.max(5.5, tamanho * 0.15), fontWeight: '900' }}>Aguardando</Text>
      </View>
    </View>
  );
}

/** Divisória: a imagem do mestrado (leve e com fundo transparente), com a tarja de "aguardando" quando ainda não foi investido. */
export function DivisorMestrado({ m, largura, altura }: { m: MestradoNaFaixa; largura: number; altura: number }) {
  const [erro, setErro] = useState(false);
  const w = largura * 0.78;
  const h = altura * 0.82;
  return (
    <View
      style={{ width: largura, height: altura, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityLabel={`Mestre em ${m.nome}${m.aguardando ? ', aguardando investidura' : ''}`}
    >
      {m.imagemUrl && !erro ? (
        <Image source={{ uri: m.imagemUrl }} onError={() => setErro(true)} resizeMode="contain" style={{ width: w, height: h }} />
      ) : (
        <View style={{ width: w * 0.8, height: h * 0.92, borderRadius: h / 2, backgroundColor: '#f2c14e', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
          <Text numberOfLines={2} style={{ color: '#432958', fontSize: Math.max(8, h * 0.17), fontWeight: '900', textAlign: 'center' }}>MESTRE EM {m.nome.toUpperCase()}</Text>
        </View>
      )}
      {m.aguardando ? (
        <View style={{ position: 'absolute', bottom: altura * 0.04, height: Math.max(11, altura * 0.17), paddingHorizontal: 10, borderRadius: 5, backgroundColor: '#e8420f', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' }}>
          <Text numberOfLines={1} style={{ color: '#fff', fontSize: Math.max(6.5, altura * 0.095), fontWeight: '900' }}>Aguardando investidura</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Esmaece o conteúdo na cor da faixa, no topo da janela: os ícones somem sob a plaquinha do nome. */
export function EsmaecerTopo({ altura, largura }: { altura: number; largura: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: largura, height: altura }}>
      <Svg width={largura} height={altura}>
        <Defs>
          <LinearGradient id="esmaecerTopo" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COR_FAIXA} stopOpacity={1} />
            <Stop offset="1" stopColor={COR_FAIXA} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={largura} height={altura} fill="url(#esmaecerTopo)" />
      </Svg>
    </View>
  );
}

