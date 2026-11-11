/**
 * Testes da autorização de investidura no modelo Word: regras de texto e, com o modelo real do projeto,
 * o preenchimento completo (nomes, região, quantidades, anexo) e a integridade do XML gerado.
 * Roda com "node --test" (ver "npm run test:autorizacao-investidura").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import {
  dataPorExtenso, horaPorExtenso, juntarComE, juntarComVirgula, montarRelacao, frasePrevisao, tituloDocumento,
  preencherDocumento, preencherCabecalho, montarAnexo, anexarRelacao, nomeArquivoAutorizacao, chaveNome,
  montarTabelaInvestidos, substituirImagensPelaTabela, listaDeTexto, type DadosAutorizacao,
} from '../autorizacaoInvestiduraNucleo.ts';
import type { ItemAguardando } from '../investidura.ts';

const item = (o: Partial<ItemAguardando> & Pick<ItemAguardando, 'dbvId' | 'membroNome' | 'nome' | 'tipo'>): ItemAguardando => ({
  id: Math.floor(Math.random() * 1e6), unidadeNome: 'Leões', origem: null, aprovadoEm: null, ...o,
});

const ITENS: ItemAguardando[] = [
  item({ dbvId: 1, membroNome: 'Ana Souza', nome: 'Nós e Cordas', tipo: 'especialidade', unidadeNome: 'Leões', dataNascimento: '2013-05-04', aprovadoEm: '2026-10-01T12:00:00Z' }),
  item({ dbvId: 1, membroNome: 'Ana Souza', nome: 'Amigo', tipo: 'classe', unidadeNome: 'Leões', dataNascimento: '2013-05-04', aprovadoEm: '2026-10-20T12:00:00Z' }),
  item({ dbvId: 2, membroNome: 'Bruno Lima', nome: 'Nós e Cordas', tipo: 'especialidade', unidadeNome: 'Águia Dourada', dataNascimento: '2012-11-30', aprovadoEm: '2026-09-15T12:00:00Z' }),
  item({ dbvId: 2, membroNome: 'Bruno Lima', nome: 'Acampamento I', tipo: 'especialidade', unidadeNome: 'Águia Dourada', dataNascimento: '2012-11-30', aprovadoEm: '2026-09-10T12:00:00Z' }),
];

const CODIGOS = { [chaveNome('Nós e Cordas')]: 'ENB13', [chaveNome('Acampamento I')]: 'ENB01' };

const DADOS: DadosAutorizacao = {
  clube: 'Fonseca', associacao: 'Associação Rio Fluminense', regiao: 'Região Leste',
  instrutores: ['Maria Silva', 'João Pereira'], cerimonia: 'Investidura', dataCerimonia: '2026-12-05', horaCerimonia: '09:30',
  localCerimonia: 'IASD Central do Fonseca', autoridades: ['Maria Silva', 'João Pereira', 'Pr. Paulo'], cidade: 'Niterói',
  dataDocumento: '2026-11-10', diretorNome: 'Maria Silva', regionalNome: 'Carlos Regional', coordenadorGeralNome: 'Lucas Coordenador',
  departamentalNome: 'Pr. Henrique Custódio', registro: '12',
};

test('datas e horas por extenso', () => {
  assert.equal(dataPorExtenso('2026-07-11'), '11 de julho de 2026');
  assert.equal(dataPorExtenso('2026-03-01'), '1 de março de 2026');
  assert.equal(dataPorExtenso('lixo'), '');
  assert.equal(horaPorExtenso('10:00'), '10h');
  assert.equal(horaPorExtenso('09:30'), '9h30');
  assert.equal(horaPorExtenso(''), '');
});

test('listas de nomes no estilo do modelo', () => {
  assert.equal(juntarComE(['ana', 'bia']), 'ANA E BIA');
  assert.equal(juntarComE(['ana', 'bia', 'cris']), 'ANA, BIA E CRIS');
  assert.equal(juntarComE(['ana']), 'ANA');
  assert.equal(juntarComE([]), '');
  assert.equal(juntarComVirgula(['ana', ' ', 'bia']), 'ANA, BIA');
});

test('relação: por membro em ordem alfabética, com código, nascimento, conclusão mais recente e quantidade de cada item', () => {
  const r = montarRelacao(ITENS, CODIGOS);
  assert.deepEqual(r.linhas.map((l) => l.nome), ['Ana Souza', 'Bruno Lima']);
  assert.deepEqual(r.linhas[1].itens.map((i) => `${i.nome}:${i.codigo}`), ['Acampamento I:ENB01', 'Nós e Cordas:ENB13']);
  assert.deepEqual(r.linhas[0].itens.map((i) => `${i.tipo}:${i.nome}`), ['classe:Amigo', 'especialidade:Nós e Cordas']); // classe antes
  assert.equal(r.linhas[0].dataNascimento, '2013-05-04');
  assert.equal(r.linhas[0].concluidoEm, '2026-10-20'); // a mais recente entre os itens do membro
  assert.equal(r.linhas[1].concluidoEm, '2026-09-15');
  assert.equal(chaveNome('  NÓS  e Cordas '), chaveNome('nos e cordas'));
  assert.equal(r.totalMembros, 2);
  assert.equal(r.totalClasses, 1);
  assert.equal(r.totalEspecialidades, 3);
  assert.deepEqual(r.quantidades.map((q) => `${q.tipo}:${q.nome}:${q.quantidade}`), ['classe:Amigo:1', 'especialidade:Acampamento I:1', 'especialidade:Nós e Cordas:2']);
});

test('frase de previsão e título conforme o conteúdo', () => {
  const r = montarRelacao(ITENS);
  assert.equal(frasePrevisao(r), 'Serão investidos 2 membros, com 3 especialidades e 1 classe, conforme a relação em anexo.');
  assert.equal(tituloDocumento(r), 'Autorização para Condecoração de Especialidades e Classes');
  const so = montarRelacao([ITENS[0]]);
  assert.equal(frasePrevisao(so), 'Será investido 1 membro, com 1 especialidade, conforme a relação em anexo.');
  assert.equal(tituloDocumento(so), 'Autorização para Condecoração de Especialidades');
  assert.equal(tituloDocumento(montarRelacao([ITENS[1]])), 'Autorização para Condecoração de Classes');
});

/** Verificador mínimo de XML bem formado (tags abertas e fechadas na ordem certa). */
function bemFormado(xml: string): void {
  const pilha: string[] = [];
  for (const m of xml.matchAll(/<\/?([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g)) {
    const [tag, nome, , auto] = m;
    if (tag.startsWith('</')) assert.equal(pilha.pop(), nome, `fechamento inesperado </${nome}>`);
    else if (!auto) pilha.push(nome);
  }
  assert.deepEqual(pilha, [], 'tags sem fechar');
}

const MODELO = fileURLToPath(new URL('../../../assets/modelos/autorizacao-investidura-modelo.docx', import.meta.url));

test('modelo real: preenche, anexa a relação e continua um .docx íntegro', () => {
  const arquivos = unzipSync(new Uint8Array(readFileSync(MODELO)));
  const rel = montarRelacao(ITENS, CODIGOS);
  const preenchido = preencherDocumento(strFromU8(arquivos['word/document.xml']), DADOS, rel);
  const original = strFromU8(arquivos['word/document.xml']);
  assert.equal((original.match(/<w:drawing>/g) ?? []).length, 6, 'o modelo traz 6 imagens da tabela');
  const comTabela = substituirImagensPelaTabela(preenchido, montarTabelaInvestidos(rel));
  assert.ok(!comTabela.includes('<w:drawing>'), 'as imagens do modelo foram trocadas pela tabela');
  const doc = anexarRelacao(comTabela, montarAnexo(DADOS, rel));
  const cab = preencherCabecalho(strFromU8(arquivos['word/header1.xml']), DADOS);
  bemFormado(doc);
  bemFormado(cab);

  const texto = Array.from(doc.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)).map((m) => m[1]).join('|');
  // dados do clube no lugar dos do modelo
  for (const novo of ['FONSECA', 'MARIA SILVA E JOÃO PEREIRA', 'Instrutores Responsáveis', '5 de dezembro de 2026', '9h30', 'IASD CENTRAL DO FONSECA',
    'MARIA SILVA, JOÃO PEREIRA, PR. PAULO', 'Niterói, 10 de novembro de 2026', 'CARLOS REGIONAL', 'Região Leste', 'LUCAS COORDENADOR',
    'PR. HENRIQUE CUSTÓDIO', 'REGISTRO: n° 12/ 2026', 'Autorização para Condecoração de Especialidades e Classes',
    'Serão investidos 2 membros, com 3 especialidades e 1 classe', 'QUANTIDADE DE CADA ITEM',
    // tabela dos investidos no formato do modelo
    'Data de Nascimento', 'Data da Conclusão dos Requisitos', 'Especialidades e classes (código)', 'Bruno Lima', 'Ana Souza',
    '04/05/2013', '20/10/2026', '30/11/2012', 'Nós e Cordas (ENB13)', 'Acampamento I (ENB01)', 'Classe Amigo']) {
    assert.ok(texto.includes(novo), `faltou: ${novo}`);
  }
  // nada do modelo original sobrou
  for (const velho of ['LUCIANO NUNES MAIA', 'SELMA MARIA', 'LILLIAN', 'LUCAS BRAGAN', 'Admissão de Lenço', 'Oceânica', 'IASD CENTRAL DE FONSCEA']) {
    assert.ok(!texto.includes(velho), `sobrou do modelo: ${velho}`);
  }
  // cabeçalho com a região do clube
  assert.ok(cab.includes('LESTE') && !cab.includes('OCEÂNICA'));
  // duas seções de página: a do modelo e a do anexo (próxima página)
  assert.ok(doc.includes('w:val="nextPage"'));

  // o pacote continua abrindo: zipa, lê de novo e confere um arquivo intocado
  const saida = zipSync({ ...arquivos, 'word/document.xml': strToU8(doc), 'word/header1.xml': strToU8(cab) });
  const volta = unzipSync(saida);
  assert.equal(strFromU8(volta['word/document.xml']), doc);
  assert.deepEqual(volta['word/media/image9.png'], arquivos['word/media/image9.png']);
  assert.ok(volta['[Content_Types].xml'].length > 0);
});

test('sem registro, o número fica em branco para a Associação preencher', () => {
  const arquivos = unzipSync(new Uint8Array(readFileSync(MODELO)));
  const doc = preencherDocumento(strFromU8(arquivos['word/document.xml']), { ...DADOS, registro: '' }, montarRelacao(ITENS, CODIGOS));
  assert.ok(doc.includes('REGISTRO: n° __________/ 2026'));
});

test('se o modelo mudar, falha em vez de preencher o lugar errado', () => {
  const arquivos = unzipSync(new Uint8Array(readFileSync(MODELO)));
  const alterado = strFromU8(arquivos['word/document.xml']).replace('Nome do Clube', 'Outro texto');
  assert.throws(() => preencherDocumento(alterado, DADOS, montarRelacao(ITENS, CODIGOS)), /modelo do Word mudou/);
  assert.throws(() => substituirImagensPelaTabela('<w:p><w:r><w:t>sem imagens</w:t></w:r></w:p>', ''), /modelo do Word mudou/);
});

test('lista digitada: uma por linha ou separada por ponto e vírgula, sem vazios nem repetidos', () => {
  assert.deepEqual(listaDeTexto('Ana\n Bruno ;ana\n\nCarla'), ['Ana', 'Bruno', 'Carla']);
  assert.deepEqual(listaDeTexto(''), []);
});

test('nome do arquivo', () => {
  assert.equal(nomeArquivoAutorizacao(DADOS), 'Autorizacao-Investidura-Fonseca-2026-12-05');
});

test('Word Esp / Word Cla: cada documento só tem o seu tipo, com título e nome de arquivo próprios', () => {
  const soEsp = ITENS.filter((i) => i.tipo !== 'classe');
  const soCla = ITENS.filter((i) => i.tipo === 'classe');
  const esp = montarRelacao(soEsp, CODIGOS);
  const cla = montarRelacao(soCla, CODIGOS);
  assert.equal(esp.totalClasses, 0);
  assert.equal(esp.totalEspecialidades, 3);
  assert.equal(cla.totalEspecialidades, 0);
  assert.equal(cla.totalClasses, 1);
  assert.equal(tituloDocumento(esp), 'Autorização para Condecoração de Especialidades');
  assert.equal(tituloDocumento(cla), 'Autorização para Condecoração de Classes');
  assert.equal(nomeArquivoAutorizacao(DADOS, esp), 'Autorizacao-Investidura-Fonseca-Especialidades-2026-12-05');
  assert.equal(nomeArquivoAutorizacao(DADOS, cla), 'Autorizacao-Investidura-Fonseca-Classes-2026-12-05');
  // Misturado não ganha sufixo.
  assert.equal(nomeArquivoAutorizacao(DADOS, montarRelacao(ITENS, CODIGOS)), 'Autorizacao-Investidura-Fonseca-2026-12-05');
});
