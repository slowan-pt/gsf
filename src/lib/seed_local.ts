import { getDB } from './database';

// Seed local com dados das planilhas (fallback offline)
// Na prática os dados são sobrescritos pelo puxarDeSupabase() no _layout.tsx

const UNIDADES = [
  { id: 1, nome: 'Amor Perfeito',  codigo_clube: 5659, senha_unidade: 2509 },
  { id: 2, nome: 'Sempre Viva',    codigo_clube: 5659, senha_unidade: 2510 },
  { id: 3, nome: 'Águia Dourada',  codigo_clube: 5659, senha_unidade: 2511 },
  { id: 4, nome: 'Leões',          codigo_clube: 5659, senha_unidade: 2512 },
];

const DESBRAVADORES = [
  // ── Amor Perfeito ────────────────────────────────────────────────────────
  { idx:1,  id_sgc:'2294859', nome:'Daniela Brito Pimentel',              data_nascimento:'2015-02-16', idade:11, genero:'F', unidade_id:1, unidade_nome:'Amor Perfeito', cargo:'DBV', campori_dsa:0, nome_responsavel:'Debora Brito de Vargas',              contato_responsavel:'21991418238' },
  { idx:2,  id_sgc:'1660976', nome:'Isabelle da Silva Nascimento',        data_nascimento:'2013-11-06', idade:12, genero:'F', unidade_id:1, unidade_nome:'Amor Perfeito', cargo:'DBV', campori_dsa:1, nome_responsavel:'Ketelyn Cristina da Silva Nascimento', contato_responsavel:'21996509439' },
  { idx:3,  id_sgc:'1949283', nome:'Kallyne Bitiato Guimarães',           data_nascimento:'2016-03-10', idade:10, genero:'F', unidade_id:1, unidade_nome:'Amor Perfeito', cargo:'DBV', campori_dsa:1, nome_responsavel:'Jean Carlos Braga Guimarães',          contato_responsavel:'67981748515' },
  { idx:4,  id_sgc:'2044904', nome:'Kauane Lima Pacheco',                 data_nascimento:'2013-06-03', idade:12, genero:'F', unidade_id:1, unidade_nome:'Amor Perfeito', cargo:'DBV', campori_dsa:1 },
  { idx:5,  id_sgc:'1983661', nome:'Laura Alves Pecly',                   data_nascimento:'2015-04-20', idade:11, genero:'F', unidade_id:1, unidade_nome:'Amor Perfeito', cargo:'DBV', campori_dsa:0, nome_responsavel:'Marilia Alves Pecly',                  contato_responsavel:'21996036559' },
  { idx:6,  id_sgc:'1978278', nome:'Luisy Pedrosa Rodrigues Zago',        data_nascimento:'2015-12-18', idade:10, genero:'F', unidade_id:1, unidade_nome:'Amor Perfeito', cargo:'DBV', campori_dsa:1, nome_responsavel:'Ana Cristina Pedrosa Rodrigues',       contato_responsavel:'21967012433' },
  { idx:7,  id_sgc:'1723533', nome:'Poliana Pessanha da Silva',           data_nascimento:'2013-11-13', idade:12, genero:'F', unidade_id:1, unidade_nome:'Amor Perfeito', cargo:'DBV', campori_dsa:1 },
  { idx:8,  id_sgc:'2098923', nome:'Valentina Rodrigues Marques',         data_nascimento:'2015-09-01', idade:10, genero:'F', unidade_id:1, unidade_nome:'Amor Perfeito', cargo:'DBV', campori_dsa:0, nome_responsavel:'Edineia Rodrigues da Silva',            contato_responsavel:'21981282941' },
  { idx:9,  id_sgc:'3055579', nome:'Cessia Verônica Condori Malpartida',  data_nascimento:null,         idade:0,  genero:'F', unidade_id:1, unidade_nome:'Amor Perfeito', cargo:'CON', campori_dsa:1 },
  { idx:10, id_sgc:'3089935', nome:'Cassia Jael Condori Malpartida',      data_nascimento:null,         idade:0,  genero:'F', unidade_id:1, unidade_nome:'Amor Perfeito', cargo:'CON', campori_dsa:1 },
  // ── Sempre Viva ──────────────────────────────────────────────────────────
  { idx:11, id_sgc:'610049',  nome:'Alice de Souza Miranda',              data_nascimento:'2011-09-12', idade:14, genero:'F', unidade_id:2, unidade_nome:'Sempre Viva',   cargo:'DBV', campori_dsa:1, nome_responsavel:'Elaine de Souza Pessoa',               contato_responsavel:'21995955441' },
  { idx:12, id_sgc:'3027489', nome:'Ana Luiza Batista de Paula',          data_nascimento:'2013-09-02', idade:12, genero:'F', unidade_id:2, unidade_nome:'Sempre Viva',   cargo:'DBV', campori_dsa:1, nome_responsavel:'Andreia Batista Peixoto',              contato_responsavel:'21987765753' },
  { idx:13, id_sgc:'2277107', nome:'Esther Azeredo Coelho Pires',         data_nascimento:'2010-03-18', idade:16, genero:'F', unidade_id:2, unidade_nome:'Sempre Viva',   cargo:'DBV', campori_dsa:0, nome_responsavel:'Vanessa azeredo coelho pires',          contato_responsavel:'21968351997' },
  { idx:14, id_sgc:'1414869', nome:'Gabriela Guerra Maia',                data_nascimento:'2013-04-24', idade:13, genero:'F', unidade_id:2, unidade_nome:'Sempre Viva',   cargo:'DBV', campori_dsa:1 },
  { idx:15, id_sgc:'1563046', nome:'Julia Silva Felizola',                data_nascimento:'2013-03-19', idade:13, genero:'F', unidade_id:2, unidade_nome:'Sempre Viva',   cargo:'DBV', campori_dsa:1, nome_responsavel:'Elisangela Santos Silva Felizola',     contato_responsavel:'21964840620' },
  { idx:16, id_sgc:'1903252', nome:'Laura Helena Pedrosa Rodrigues da Silva', data_nascimento:'2010-04-27', idade:16, genero:'F', unidade_id:2, unidade_nome:'Sempre Viva', cargo:'DBV', campori_dsa:1, nome_responsavel:'Ana Michelle Pedrosa Rodrigues',  contato_responsavel:'21996369804' },
  { idx:17, id_sgc:'919374',  nome:'Manuela Guerra Maia',                 data_nascimento:'2011-07-22', idade:14, genero:'F', unidade_id:2, unidade_nome:'Sempre Viva',   cargo:'DBV', campori_dsa:1 },
  { idx:18, id_sgc:'382297',  nome:'Nathaly Reis Pacheco',                data_nascimento:'2011-11-24', idade:14, genero:'F', unidade_id:2, unidade_nome:'Sempre Viva',   cargo:'DBV', campori_dsa:1, nome_responsavel:'Bruna Andrea Reis Pacheco',            contato_responsavel:'21969791211' },
  { idx:19, id_sgc:'2601851', nome:'Talita Santos Villar',                data_nascimento:'2012-06-28', idade:13, genero:'F', unidade_id:2, unidade_nome:'Sempre Viva',   cargo:'DBV', campori_dsa:1, nome_responsavel:'Roseni Santos Silva Marques',          contato_responsavel:'21964840620' },
  { idx:20, id_sgc:'581777',  nome:'Maria Eduarda de Souza Miranda',      data_nascimento:null,         idade:0,  genero:'F', unidade_id:2, unidade_nome:'Sempre Viva',   cargo:'CON', campori_dsa:1 },
  { idx:21, id_sgc:'3055577', nome:'Larissa Lima Bezerra',                data_nascimento:'1997-02-07', idade:29, genero:'F', unidade_id:2, unidade_nome:'Sempre Viva',   cargo:'CON', campori_dsa:1 },
  // ── Águia Dourada ────────────────────────────────────────────────────────
  { idx:22, id_sgc:'1945641', nome:'Benjamin Oliveira Rocha',             data_nascimento:'2016-02-28', idade:10, genero:'M', unidade_id:3, unidade_nome:'Águia Dourada', cargo:'DBV', campori_dsa:0, nome_responsavel:'Francisco José de Sousa Rocha',        contato_responsavel:'21979054795' },
  { idx:23, id_sgc:'xxxxx',   nome:'Bernardo Ramos Alves Pereira',        data_nascimento:'2014-09-05', idade:11, genero:null, unidade_id:null, unidade_nome:null,        cargo:'DBV', campori_dsa:0 },
  { idx:24, id_sgc:'2273952', nome:'Daniel Azeredo Coelho Pires',         data_nascimento:'2015-01-20', idade:11, genero:'M', unidade_id:3, unidade_nome:'Águia Dourada', cargo:'DBV', campori_dsa:0, nome_responsavel:'Vanessa azeredo coelho pires',          contato_responsavel:'21968351997' },
  { idx:25, id_sgc:'1080566', nome:'Davi Vitor de Lima Martins',          data_nascimento:'2013-10-24', idade:12, genero:'M', unidade_id:3, unidade_nome:'Águia Dourada', cargo:'DBV', campori_dsa:1, nome_responsavel:'Valdir Edson Martins',                 contato_responsavel:'21971185302' },
  { idx:26, id_sgc:'3092231', nome:'Enzo Guimarães Vieira',               data_nascimento:'2014-12-05', idade:11, genero:'M', unidade_id:3, unidade_nome:'Águia Dourada', cargo:'DBV', campori_dsa:1, nome_responsavel:'Marilia de Oliveira Guimarães Vieira', contato_responsavel:'21976994148' },
  { idx:27, id_sgc:'2129524', nome:'Khaled Ribeiro Nascimento',           data_nascimento:'2016-05-03', idade:9,  genero:'M', unidade_id:3, unidade_nome:'Águia Dourada', cargo:'DBV', campori_dsa:1, nome_responsavel:'Marcelo Nascimento',                   contato_responsavel:'62981608320' },
  { idx:28, id_sgc:'2357132', nome:'Mateus Ribeiro de Souza',             data_nascimento:'2016-05-19', idade:9,  genero:'M', unidade_id:3, unidade_nome:'Águia Dourada', cargo:'DBV', campori_dsa:0, nome_responsavel:'Monique Ribeiro de Moura',              contato_responsavel:'21977186008' },
  { idx:29, id_sgc:'2102040', nome:'Pedro Frossard Pinhel',               data_nascimento:'2014-05-05', idade:11, genero:'M', unidade_id:3, unidade_nome:'Águia Dourada', cargo:'DBV', campori_dsa:1, nome_responsavel:'Vivian Correa Frossard Pinhel',         contato_responsavel:'21986044469' },
  { idx:30, id_sgc:'1970148', nome:'Thales Frossard Gama',                data_nascimento:'2013-08-26', idade:12, genero:'M', unidade_id:3, unidade_nome:'Águia Dourada', cargo:'DBV', campori_dsa:1, nome_responsavel:'Flavia Correa Frossard',                contato_responsavel:'21986044467' },
  { idx:31, id_sgc:'3100303', nome:'William Santanna Teixeira Manhães',   data_nascimento:'2014-07-28', idade:11, genero:null, unidade_id:null, unidade_nome:null,        cargo:'DBV', campori_dsa:0 },
  { idx:32, id_sgc:'123537',  nome:'Dennis Juan Aceti da Silva',          data_nascimento:'1998-07-18', idade:27, genero:'M', unidade_id:3, unidade_nome:'Águia Dourada', cargo:'CON', campori_dsa:1 },
  { idx:33, id_sgc:'1798979', nome:'Diogo Gabriel Aceti Pereira',         data_nascimento:'2008-10-06', idade:17, genero:'M', unidade_id:3, unidade_nome:'Águia Dourada', cargo:'CON', campori_dsa:1 },
  // ── Leões ─────────────────────────────────────────────────────────────────
  { idx:34, id_sgc:'2473533', nome:'Caetano Chaves Alifias',              data_nascimento:'2012-12-05', idade:13, genero:'M', unidade_id:4, unidade_nome:'Leões',          cargo:'DBV', campori_dsa:1 },
  { idx:35, id_sgc:'3100294', nome:'Davi Carneiro Santanna Teixeira',     data_nascimento:'2012-06-18', idade:0,  genero:null, unidade_id:null, unidade_nome:null,        cargo:'DBV', campori_dsa:0 },
  { idx:36, id_sgc:'960145',  nome:'João Gabriel Oliveira Rosa',          data_nascimento:'2011-12-15', idade:14, genero:'M', unidade_id:4, unidade_nome:'Leões',          cargo:'DBV', campori_dsa:1, nome_responsavel:'Francisco José de Sousa Rocha',        contato_responsavel:'21979054795' },
  { idx:37, id_sgc:'1904611', nome:'Lucas Borges de Andrade',             data_nascimento:'2010-10-28', idade:15, genero:'M', unidade_id:4, unidade_nome:'Leões',          cargo:'DBV', campori_dsa:1, nome_responsavel:'Vanessa Martins Borges',               contato_responsavel:'21972624571' },
  { idx:38, id_sgc:'1501674', nome:'Luis Gustavo Ribeiro de Souza',       data_nascimento:'2011-10-16', idade:14, genero:'M', unidade_id:4, unidade_nome:'Leões',          cargo:'DBV', campori_dsa:1 },
  { idx:39, id_sgc:'2337649', nome:'Luiz Miguel da Silva do Amaral e Souza', data_nascimento:'2011-10-14', idade:14, genero:'M', unidade_id:4, unidade_nome:'Leões',      cargo:'DBV', campori_dsa:1 },
  { idx:40, id_sgc:'382339',  nome:'Nicolas Costa Gonçalves',             data_nascimento:'2010-07-13', idade:15, genero:'M', unidade_id:4, unidade_nome:'Leões',          cargo:'DBV', campori_dsa:1, nome_responsavel:'Michelli Souza Costa Gonçalves',        contato_responsavel:'21995412994' },
  { idx:41, id_sgc:'2206363', nome:'Pedro Domingos Venancio',             data_nascimento:'2010-09-13', idade:15, genero:'M', unidade_id:4, unidade_nome:'Leões',          cargo:'DBV', campori_dsa:1, nome_responsavel:'Davison Venancio da Silva',             contato_responsavel:'21968161292' },
  { idx:42, id_sgc:'1821079', nome:'Marcus Miller Nascimento e Silva',    data_nascimento:null,         idade:0,  genero:'M', unidade_id:4, unidade_nome:'Leões',          cargo:'CON', campori_dsa:0 },
  { idx:43, id_sgc:'915738',  nome:'Gabriel de Lima Martins',             data_nascimento:null,         idade:126,genero:'M', unidade_id:4, unidade_nome:'Leões',          cargo:'CON', campori_dsa:0 },
  // ── Diretoria ─────────────────────────────────────────────────────────────
  { idx:44, id_sgc:'2408162', nome:'Ágatha Miranda de Jesus',             data_nascimento:null,         idade:0,  genero:'F', unidade_id:null, unidade_nome:'Diretoria',   cargo:'INS', campori_dsa:0 },
  { idx:45, id_sgc:'1495045', nome:'Enderson Elias Modesto dos Santos',   data_nascimento:null,         idade:0,  genero:'M', unidade_id:null, unidade_nome:'Diretoria',   cargo:'INS', campori_dsa:0 },
  { idx:46, id_sgc:'2309147', nome:'Fernando do Espírito Santo de Medeiros', data_nascimento:'1966-12-20', idade:59, genero:'M', unidade_id:null, unidade_nome:'Diretoria', cargo:'TES', campori_dsa:1 },
  { idx:47, id_sgc:'1876657', nome:'Giselle Martins',                     data_nascimento:'1981-11-12', idade:44, genero:'F', unidade_id:null, unidade_nome:'Diretoria',   cargo:'INS', campori_dsa:1 },
  { idx:48, id_sgc:'2067462', nome:'Jean Guimarães',                      data_nascimento:null,         idade:0,  genero:'M', unidade_id:null, unidade_nome:'Diretoria',   cargo:'CAP', campori_dsa:1 },
  { idx:49, id_sgc:'1231224', nome:'Luciano Nunes Maia',                  data_nascimento:'1981-04-07', idade:45, genero:'M', unidade_id:null, unidade_nome:'Diretoria',   cargo:'DIR', campori_dsa:1 },
  { idx:50, id_sgc:'951949',  nome:'Mariane Quidorne',                    data_nascimento:null,         idade:0,  genero:'F', unidade_id:null, unidade_nome:'Diretoria',   cargo:'INS', campori_dsa:0 },
  { idx:51, id_sgc:'1231244', nome:'Millena Guerra Lourenço Nunes Maia',  data_nascimento:'1977-03-19', idade:49, genero:'F', unidade_id:null, unidade_nome:'Diretoria',   cargo:'SEC', campori_dsa:1 },
  { idx:52, id_sgc:'xxxxx',   nome:'Renan da Silva Vieira',               data_nascimento:null,         idade:0,  genero:'M', unidade_id:null, unidade_nome:'Diretoria',   cargo:'INS', campori_dsa:0 },
  { idx:53, id_sgc:'123309',  nome:'Rodrigo Gonzalez Castro',             data_nascimento:null,         idade:0,  genero:'M', unidade_id:null, unidade_nome:'Diretoria',   cargo:'DAS', campori_dsa:1 },
  { idx:54, id_sgc:'1880372', nome:'Selma Maria de Souza',                data_nascimento:null,         idade:0,  genero:'F', unidade_id:null, unidade_nome:'Diretoria',   cargo:'DAS', campori_dsa:1 },
  { idx:55, id_sgc:'486192',  nome:'Sloan Nascimento',                    data_nascimento:null,         idade:0,  genero:'M', unidade_id:null, unidade_nome:'Diretoria',   cargo:'INS', campori_dsa:1 },
  { idx:56, id_sgc:'1634472', nome:'Valdir Martins',                      data_nascimento:'1979-07-09', idade:46, genero:'M', unidade_id:null, unidade_nome:'Diretoria',   cargo:'INS', campori_dsa:1 },
  { idx:57, id_sgc:'2045470', nome:'Yann Guimarães de Morais Faro',       data_nascimento:'2009-09-25', idade:16, genero:'M', unidade_id:null, unidade_nome:'Diretoria',   cargo:'MID', campori_dsa:1 },
];

export async function popularBancoDeDados() {
  const db = await getDB();

  const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM desbravadores');
  if (count && count.n > 0) return;

  for (const u of UNIDADES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO unidades (id, nome, codigo_clube, senha_unidade) VALUES (?,?,?,?)',
      [u.id, u.nome, u.codigo_clube, u.senha_unidade]
    );
  }

  for (const d of DESBRAVADORES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO desbravadores
       (id, idx, id_sgc, nome, data_nascimento, idade, genero, unidade_id, unidade_nome, cargo, campori_dsa, nome_responsavel, contato_responsavel)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.idx, d.idx, d.id_sgc, d.nome, d.data_nascimento ?? null, d.idade, d.genero ?? null,
       d.unidade_id ?? null, d.unidade_nome ?? null, d.cargo, d.campori_dsa,
       (d as any).nome_responsavel ?? null, (d as any).contato_responsavel ?? null]
    );
    await db.runAsync('INSERT OR IGNORE INTO documentos (dbv_id) VALUES (?)', [d.idx]);
    await db.runAsync('INSERT OR IGNORE INTO progresso_classes (dbv_id) VALUES (?)', [d.idx]);
  }

  console.log('✅ Banco de dados populado com dados das planilhas (offline)!');
}
