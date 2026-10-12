import { Image, TouchableOpacity } from 'react-native';
import { IMAGEM_CLASSE, NOME_AVANCADA } from '../../lib/classesRequisitos';
import { chaveSlotClasse, ORDEM_CLASSES } from '../../lib/faixaClasses';
import { disposicaoPeito, type ChaveUniforme, type LugarInsignia } from '../../lib/faixaUniforme';

export interface InsigniaAberta { nome: string; imagem: any; avancada: boolean }

/**
 * Centro do desenho dentro do quadro 320×268 de cada faixinha avançada: os PNGs têm sobra transparente
 * diferente em cima e embaixo, então sem esta correção cada uma ficaria numa altura diferente.
 */
const CENTRO_AVANCADA: Record<string, { cx: number; cy: number }> = {
  Amigo: { cx: 162, cy: 92 },
  Companheiro: { cx: 162, cy: 135 },
  Pesquisador: { cx: 162, cy: 136.5 },
  Pioneiro: { cx: 162, cy: 117 },
  Excursionista: { cx: 162, cy: 124.5 },
  Guia: { cx: 162, cy: 124 },
};

interface Slot { chave: string; nome: string; imagem: any; avancada: boolean; lugar: LugarInsignia; centro?: { cx: number; cy: number } }

/** Monta os lugares: só as conquistadas aparecem, cada uma no seu lugar fixo do uniforme. */
function slotsConquistados(chave: ChaveUniforme, conquistadas: Set<string>): Slot[] {
  const temLider = ['Líder', 'Líder Máster'].some((n) => conquistadas.has(chaveSlotClasse(n, false))) || conquistadas.has(chaveSlotClasse('Líder Máster', true));
  const d = disposicaoPeito(chave, temLider);
  const slots: Slot[] = [];
  ORDEM_CLASSES.forEach((base, i) => {
    slots.push({ chave: chaveSlotClasse(base, false), nome: base, imagem: IMAGEM_CLASSE[base]?.regular, avancada: false, lugar: d.regulares[i] });
    slots.push({ chave: chaveSlotClasse(base, true), nome: NOME_AVANCADA[base] ?? base, imagem: IMAGEM_CLASSE[base]?.avancada, avancada: true, lugar: d.avancadas[i], centro: CENTRO_AVANCADA[base] });
  });
  slots.push({ chave: chaveSlotClasse('Líder', false), nome: 'Líder', imagem: IMAGEM_CLASSE['Líder']?.regular, avancada: false, lugar: d.lideres[0] });
  slots.push({ chave: chaveSlotClasse('Líder Máster', false), nome: 'Líder Máster', imagem: IMAGEM_CLASSE['Líder Máster']?.regular, avancada: false, lugar: d.lideres[1] });
  slots.push({ chave: chaveSlotClasse('Líder Máster', true), nome: 'Líder Máster avançado', imagem: IMAGEM_CLASSE['Líder Máster']?.avancada, avancada: true, lugar: d.lideres[2] });
  return slots.filter((s) => s.imagem && conquistadas.has(s.chave));
}

/**
 * Insígnias das classes sobre o lado esquerdo da camisa (acima do bolso): embaixo as classes
 * (Amigo, Companheiro…), acima as de liderança e, mais acima, as faixinhas das avançadas.
 */
export function InsigniasPeito({ chave, conquistadas, escala, offX, offY, aoAbrir }: {
  chave: ChaveUniforme; conquistadas: Set<string>; escala: number; offX: number; offY: number;
  aoAbrir: (i: InsigniaAberta) => void;
}) {
  return (
    <>
      {slotsConquistados(chave, conquistadas).map((s) => (
        <TouchableOpacity
          key={s.chave}
          activeOpacity={0.8}
          onPress={() => aoAbrir({ nome: s.nome, imagem: s.imagem, avancada: s.avancada })}
          accessibilityRole="button"
          accessibilityLabel={`Classe ${s.nome}`}
          style={{
            position: 'absolute',
            left: offX + (s.lugar.cx - s.lugar.w / 2) * escala,
            top: offY + (s.lugar.cy - s.lugar.h / 2) * escala,
            width: s.lugar.w * escala,
            height: s.lugar.h * escala,
          }}
        >
          <Image
            source={s.imagem}
            resizeMode="contain"
            style={{
              width: '100%',
              height: '100%',
              ...(s.centro ? { transform: [{ translateX: (160 - s.centro.cx) * ((s.lugar.w * escala) / 320) }, { translateY: (134 - s.centro.cy) * ((s.lugar.h * escala) / 268) }] } : null),
            }}
          />
        </TouchableOpacity>
      ))}
    </>
  );
}
