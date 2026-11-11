/**
 * Testes das regras dos mestrados (espelho da contagem do banco). Roda com "node --test" (ver "npm run test:mestrados").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  avaliarMestrado, decisaoAutomatica, lerProgressoMestrados, situacaoDoMestrado, mestradosParaMostrar, chaveEspecialidade,
  type RegraMestrado, type ProgressoMestrado,
} from '../mestradoProgressoNucleo.ts';

const nomes = (prefixo: string, n: number) => Array.from({ length: n }, (_, i) => `${prefixo} ${i + 1}`);
const regraSimples = (qtd = 7): RegraMestrado => ({ quantidade: qtd, especialidades: nomes('Vida', 20).map((nome) => ({ nome })) });
const regraObrig: RegraMestrado = {
  quantidade: 7,
  especialidades: [
    { nome: 'Obrigatória A', obrigatoria: true }, { nome: 'Obrigatória B', obrigatoria: true }, { nome: 'Obrigatória C', obrigatoria: true },
    ...nomes('Opcional', 12).map((nome) => ({ nome })),
  ],
};

test('1. seis especialidades para um mestrado de sete: não elegível', () => {
  const r = avaliarMestrado(regraSimples(), nomes('Vida', 6));
  assert.equal(r.total, 6);
  assert.equal(r.atende, false);
});

test('2. sete especialidades válidas: pronto', () => {
  assert.equal(avaliarMestrado(regraSimples(), nomes('Vida', 7)).atende, true);
});

test('3. dez especialidades, só seis válidas: não elegível', () => {
  const r = avaliarMestrado(regraSimples(), [...nomes('Vida', 6), ...nomes('Outra', 4)]);
  assert.equal(r.total, 6);
  assert.equal(r.atende, false);
});

test('4. opcionais suficientes, mas falta uma obrigatória: não elegível', () => {
  const r = avaliarMestrado(regraObrig, ['Obrigatória A', 'Obrigatória B', ...nomes('Opcional', 8)]);
  assert.equal(r.total, 10);
  assert.equal(r.obrigatoriasOk, 2);
  assert.equal(r.atende, false);
});

test('5. todas as obrigatórias e as opcionais exigidas: pronto', () => {
  const r = avaliarMestrado(regraObrig, ['Obrigatória A', 'Obrigatória B', 'Obrigatória C', ...nomes('Opcional', 4)]);
  assert.equal(r.total, 7);
  assert.equal(r.obrigatoriasOk, 3);
  assert.equal(r.atende, true);
});

test('6. retroativo: quem já tinha tudo antes é reconhecido (sem exigir que tenha iniciado o mestrado)', () => {
  const concluidas = nomes('Vida', 9); // histórico antigo
  const r = avaliarMestrado(regraSimples(), concluidas);
  assert.equal(r.atende, true);
  assert.equal(decisaoAutomatica(r.atende, null), 'encaminhar'); // sem processo ainda: nasce encaminhado
});

test('7. a última especialidade concluída libera o mestrado', () => {
  const antes = avaliarMestrado(regraSimples(), nomes('Vida', 6));
  const depois = avaliarMestrado(regraSimples(), nomes('Vida', 7));
  assert.equal(decisaoAutomatica(antes.atende, null), 'nada');
  assert.equal(decisaoAutomatica(depois.atende, null), 'encaminhar');
});

test('8. aprovação cancelada: elegibilidade recalculada; investidura/aprovação já feita é preservada', () => {
  const concluidas = nomes('Vida', 7);
  const sem = avaliarMestrado(regraSimples(), concluidas.slice(1));
  assert.equal(sem.atende, false);
  assert.equal(decisaoAutomatica(sem.atende, 'diretoria'), 'sinalizar'); // pendente: perde a elegibilidade
  assert.equal(decisaoAutomatica(sem.atende, 'investido'), 'nada');      // já investido: histórico intacto
});

test('9. já investido: não cria nova pendência', () => {
  const r = avaliarMestrado(regraSimples(), nomes('Vida', 12));
  assert.equal(decisaoAutomatica(r.atende, 'investido'), 'nada');
  assert.equal(decisaoAutomatica(r.atende, 'aprovado'), 'nada');
});

test('10. a mesma especialidade vale em dois mestrados', () => {
  const a: RegraMestrado = { quantidade: 2, especialidades: [{ nome: 'Nós e amarras' }, { nome: 'Pioneirias' }] };
  const b: RegraMestrado = { quantidade: 2, especialidades: [{ nome: 'Nos e Amarras' }, { nome: 'Jogos cooperativos' }] };
  const feitas = ['Nós e amarras', 'Pioneirias', 'Jogos cooperativos'];
  assert.equal(avaliarMestrado(a, feitas).atende, true);
  assert.equal(avaliarMestrado(b, feitas).atende, true);
});

test('11. recalcular de novo não muda nada (idempotente) e a mesma especialidade não conta duas vezes', () => {
  const concluidas = [...nomes('Vida', 7), 'vida 1', 'VIDA 2']; // repetidas
  const r1 = avaliarMestrado(regraSimples(), concluidas);
  const r2 = avaliarMestrado(regraSimples(), concluidas);
  assert.deepEqual(r1, r2);
  assert.equal(r1.total, 7);
  // com processo já existente, a decisão repetida não cria outro
  assert.equal(decisaoAutomatica(r1.atende, 'diretoria'), 'restabelecer');
  assert.equal(avaliarMestrado(regraSimples(), nomes('Vida', 6).concat(['vida 1'])).total, 6);
});

test('12. regra diferente de sete: 14 especialidades (Ensinos Bíblicos) e combinação de obrigatórias', () => {
  const regra14 = regraSimples(14);
  assert.equal(avaliarMestrado(regra14, nomes('Vida', 13)).atende, false);
  assert.equal(avaliarMestrado(regra14, nomes('Vida', 14)).atende, true);
  // Básica e avançada são especialidades distintas, cada uma conta uma vez.
  const ba: RegraMestrado = { quantidade: 2, especialidades: [{ nome: 'Acampamento I' }, { nome: 'Acampamento I - avançado' }] };
  assert.equal(avaliarMestrado(ba, ['Acampamento I']).atende, false);
  assert.equal(avaliarMestrado(ba, ['Acampamento I', 'Acampamento I - avançado']).atende, true);
});

test('chave: sem acento, minúscula e espaços simples (igual ao banco)', () => {
  assert.equal(chaveEspecialidade('  Nós  e   Amarras '), 'nos e amarras');
});

test('ignora especialidades devolvidas pela diretoria ao reavaliar', () => {
  const r = avaliarMestrado(regraSimples(), nomes('Vida', 7), ['Vida 1']);
  assert.equal(r.total, 6);
  assert.equal(r.atende, false);
});

// ---- Situação e apresentação --------------------------------------------------------------------------------------

function progresso(parcial: Partial<ProgressoMestrado>): ProgressoMestrado {
  return {
    id: 'x', codigo: 'ME-009', nome: 'Vida Campestre', imagemUrl: null, etapa: null, alertaRequisitos: false,
    total: 0, necessarias: 7, obrigatoriasOk: 0, obrigatoriasTotal: 0, atende: false, especialidades: [], ...parcial,
  };
}

test('situação: em andamento mostra x/y e o que falta', () => {
  const s = situacaoDoMestrado(progresso({ total: 5 }));
  assert.equal(s.tom, 'andamento');
  assert.equal(s.progresso, '5/7 especialidades');
  assert.match(s.detalhe ?? '', /Faltam 2 especialidades/);
});

test('situação: obrigatórias e opcionais separadas (Ecologia 2/3 e 5/4)', () => {
  const s = situacaoDoMestrado(progresso({ total: 7, necessarias: 7, obrigatoriasOk: 2, obrigatoriasTotal: 3 }));
  assert.equal(s.tom, 'andamento');
  assert.match(s.progresso, /Obrigatórias 2\/3/);
  assert.match(s.detalhe ?? '', /Falta 1 especialidade obrigatória/);
});

test('situação: aprovado é PRONTO PARA INVESTIDURA; investido preserva o histórico', () => {
  assert.equal(situacaoDoMestrado(progresso({ total: 8, atende: true, etapa: 'aprovado' })).rotulo, 'PRONTO PARA INVESTIDURA');
  assert.equal(situacaoDoMestrado(progresso({ total: 8, atende: true, etapa: 'investido' })).tom, 'investido');
  assert.equal(situacaoDoMestrado(progresso({ total: 8, atende: true, etapa: 'diretoria' })).tom, 'diretoria');
  assert.equal(situacaoDoMestrado(progresso({ total: 6, etapa: 'diretoria', alertaRequisitos: true })).tom, 'alerta');
});

test('lerProgressoMestrados lê a resposta do banco e a lista omite os zerados', () => {
  const lista = lerProgressoMestrados([
    { id: 'a', codigo: 'ME-009', nome: 'Vida Campestre', imagem_url: null, etapa: null, contagem: { total: 5, necessarias: 7, obrigatorias_ok: 0, obrigatorias_total: 0, atende: false, contadas: [{ id: '1', nome: 'Nós e amarras' }] } },
    { id: 'b', codigo: 'ME-012', nome: 'Zoologia', imagem_url: null, etapa: null, contagem: { total: 0, necessarias: 7, obrigatorias_ok: 0, obrigatorias_total: 0, atende: false, contadas: [] } },
    { id: 'c', codigo: 'ME-006', nome: 'Ciência e Tecnologia', imagem_url: null, etapa: 'aprovado', contagem: { total: 8, necessarias: 7, obrigatorias_ok: 0, obrigatorias_total: 0, atende: true, contadas: [] } },
  ]);
  assert.equal(lista[0].especialidades[0], 'Nós e amarras');
  const mostrar = mestradosParaMostrar(lista);
  assert.deepEqual(mostrar.map((p) => p.codigo), ['ME-006', 'ME-009']); // pronto primeiro; Zoologia (0) fora
  assert.deepEqual(lerProgressoMestrados(null), []);
});
