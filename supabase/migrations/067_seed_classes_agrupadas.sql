-- Catalogo "Classes agrupadas" -- cada requisito vale so para a faixa de idade
-- indicada (idade_agrupada_min/max). Gerado por scripts/gerar-seed-classes-agrupadas.mjs
-- a partir de scripts/classes-dados-agrupadas.mjs. Total de linhas: 424.
--
-- Este cartao NAO entra no fluxo de "Receber"/investidura (orientacao oficial:
-- nao substitui os cartoes de classe regulares) -- ver ajuste no gatilho abaixo.

ALTER TABLE public.classes_requisitos_catalogo
  ADD COLUMN IF NOT EXISTS idade_agrupada_min INTEGER,
  ADD COLUMN IF NOT EXISTS idade_agrupada_max INTEGER;

UPDATE public.classes_requisitos_catalogo
SET ativo = FALSE
WHERE classe_nome IN ('Classes agrupadas', 'Classes agrupadas — Amigo da Natureza', 'Classes agrupadas — Companheiro de Excursionismo', 'Classes agrupadas — Pesquisador de Campo e Bosque', 'Classes agrupadas — Pioneiro de Novas Fronteiras', 'Classes agrupadas — Excursionista na Mata', 'Classes agrupadas — Guia de Exploração');

INSERT INTO public.classes_requisitos_catalogo
  (classe_nome, secao, secao_ordem, ordem, codigo, codigo_raiz, subitem, texto, tipo, pagina,
   especialidade_nome, avancada, pontua, formato_resposta, max_arquivos, idade_minima,
   chave_compartilhada, grupo_escolha, escolhas_necessarias, rotulo, documento_campo,
   idade_agrupada_min, idade_agrupada_max)
VALUES
  ('Classes agrupadas', 'I. Gerais', 1, 1, '1', '1', NULL, 'Ser membro ativo do Clube de Desbravadores.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 2, '2', '2', NULL, 'Memorizar e explicar o Voto e a Lei do Desbravador.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 3, '3', '3', NULL, 'Ilustrar de forma criativa o significado do Voto do Desbravador.', 'Requisito', NULL, NULL, false, true, 'texto_upload', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 4, '4', '4', NULL, 'Demonstrar sua compreensão do significado da Lei do Desbravador através de uma das seguintes atividades:', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 5, '4', '4', 'a', 'Representação', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::I. Gerais::4', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 6, '4', '4', 'b', 'Debate', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::I. Gerais::4', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 7, '4', '4', 'c', 'Redação', 'Opção', NULL, NULL, false, false, 'texto', 3, NULL, NULL, 'Classes agrupadas::I. Gerais::4', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 8, '5', '5', NULL, 'Memorizar e entender o Alvo e o Lema JA.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 9, '6', '6', NULL, 'Memorizar e explicar o significado do Objetivo JA.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 10, '7', '7', NULL, 'Memorizar e explicar o Voto de Fidelidade à Bíblia.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 11, '8', '8', NULL, 'Ler o livro do Clube de Leitura do ano em curso e escrever um parágrafo sobre o que mais lhe chamou atenção ou considerou mais importante.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, 11),
  ('Classes agrupadas', 'I. Gerais', 1, 12, '9', '9', NULL, 'Ler o livro do Clube de Leitura do ano em curso e escrever dois parágrafos sobre o que mais lhe chamou atenção ou considerou importante.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, 12),
  ('Classes agrupadas', 'I. Gerais', 1, 13, '10', '10', NULL, 'Ler o livro do Clube de Leitura do ano em curso e resumi-lo em uma página.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 14, '11', '11', NULL, 'Ler o livro Pela Graça de Deus.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 15, '12', '12', NULL, 'Ler o livro Caminho a Cristo.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 16, '13', '13', NULL, 'Ler o livro Além da Magia.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 17, '14', '14', NULL, 'Ler o livro A História da Vida.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 18, '15', '15', NULL, 'Ler o livro Nos Bastidores da Mídia.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 19, '16', '16', NULL, 'Ler o livro Nossa Herança.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'I. Gerais', 1, 20, '17', '17', NULL, 'Participar ativamente da Classe Bíblica do seu Clube.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, 13),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 21, '1', '1', NULL, 'Memorizar e demonstrar seu conhecimento:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 22, '1', '1', 'a', 'Criação: o que Deus criou em cada dia da criação.', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 23, '1', '1', 'b', '10 Pragas: quais as pragas que caíram sobre o Egito.', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 24, '1', '1', 'c', '12 Tribos: o nome de cada uma das 12 tribos de Israel.', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 25, '1', '1', 'd', '39 livros do Antigo Testamento e demonstrar habilidade para encontrar qualquer um deles.', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 26, '2', '2', NULL, 'Memorizar e demonstrar seu conhecimento:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 27, '2', '2', 'a', '10 Mandamentos: a Lei de Deus dada a Moisés.', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 28, '2', '2', 'b', '27 livros do Novo Testamento e demonstrar habilidade para encontrar qualquer um deles.', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 29, '3', '3', NULL, 'Memorizar e demonstrar seu conhecimento:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 30, '3', '3', 'a', 'Levítico 11: quais as regras dos alimentos considerados comestíveis e não comestíveis.', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 31, '4', '4', NULL, 'Memorizar e demonstrar seu conhecimento:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 32, '4', '4', 'a', 'Bem-Aventuranças: o Sermão da Montanha.', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 33, '5', '5', NULL, 'Memorizar e demonstrar seu conhecimento:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 34, '5', '5', 'a', '12 apóstolos: o nome dos 12 apóstolos de Cristo.', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 35, '5', '5', 'b', 'O fruto do Espírito: a relação de adjetivos do caráter de um cristão.', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 36, '6', '6', NULL, 'Memorizar e demonstrar seu conhecimento:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 37, '6', '6', 'a', '3 mensagens angélicas: reveladas em Apocalipse 14:6-12.', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 38, '6', '6', 'b', '7 Igrejas: o nome das igrejas do Apocalipse.', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 39, '6', '6', 'c', 'Pedras preciosas: os 12 fundamentos da Cidade Santa - A Nova Jerusalém.', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 40, '7', '7', NULL, 'Ler e explicar os versos abaixo:', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 41, '7', '7', 'a', 'João 3:16', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 42, '7', '7', 'b', 'Efésios 6:1-3', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 43, '7', '7', 'c', 'II Timóteo 3:16', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 44, '7', '7', 'd', 'Salmo 1', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 45, '8', '8', NULL, 'Ler e explicar os versos abaixo:', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 46, '8', '8', 'a', 'Isaías 41:9-10', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 47, '8', '8', 'b', 'Hebreus 13:5', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 48, '8', '8', 'c', 'Provérbios 22:6', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 49, '8', '8', 'd', 'I João 1:9', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 50, '8', '8', 'e', 'Salmo 8', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 51, '9', '9', NULL, 'Ler e explicar os versos abaixo:', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 52, '9', '9', 'a', 'Eclesiastes 12:13-14', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 53, '9', '9', 'b', 'Romanos 6:23', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 54, '9', '9', 'c', 'Apocalipse 1:3', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 55, '9', '9', 'd', 'Isaías 43:1-2', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 56, '9', '9', 'e', 'Salmo 51:10', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 57, '9', '9', 'f', 'Salmo 16', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 58, '10', '10', NULL, 'Ler e explicar os versos abaixo:', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 59, '10', '10', 'a', 'Isaías 26:3', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 60, '10', '10', 'b', 'Romanos 12:12', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 61, '10', '10', 'c', 'João 14:1-3', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 62, '10', '10', 'd', 'Salmo 37:5', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 63, '10', '10', 'e', 'Filipenses 3:12-14', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 64, '10', '10', 'f', 'Salmo 23', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 65, '10', '10', 'g', 'I Samuel 15:22', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 66, '11', '11', NULL, 'Ler e explicar os versos abaixo:', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 67, '11', '11', 'a', 'Romanos 8:28', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 68, '11', '11', 'b', 'Apocalipse 21:1-3', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 69, '11', '11', 'c', 'II Pedro 1:20-21', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 70, '11', '11', 'd', 'I João 2:14', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 71, '11', '11', 'e', 'II Crônicas 20:20', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 72, '11', '11', 'f', 'Salmo 46', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 73, '12', '12', NULL, 'Ler e explicar os versos abaixo:', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 74, '12', '12', 'a', 'I Coríntios 13', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 75, '12', '12', 'b', 'II Crônicas 7:14', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 76, '12', '12', 'c', 'Apocalipse 22:18-20', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 77, '12', '12', 'd', 'II Timóteo 4:6-7', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 78, '12', '12', 'e', 'Romanos 8:38-39', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 79, '12', '12', 'f', 'Mateus 6:33-34', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 80, '13', '13', NULL, 'Leitura bíblica — Gênesis: 1-9, 11-24, 27-33, 37, 40-45, 47, 50. Êxodo: 1-5, 7-10, 12-20, 24, 32, 33, 34, 35, 40.', 'Leitura', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 81, '14', '14', NULL, 'Leitura bíblica — Levítico 11; Números 9-14, 16, 17, 20-24; Deuteronômio 1, 32-34; Josué 1-7, 9, 24; Juízes 6, 7, 13-16; Rute 1-4; 1 Samuel 1-6, 8-13, 15-18, 20-22, 24-26, 31; 2 Samuel 1, 5-7, 9, 11, 12, 15, 18.', 'Leitura', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 82, '15', '15', NULL, 'Leitura bíblica — 1 Reis 1, 3-6, 8, 10-12, 16-19, 21; 2 Reis 2, 4-7, 20, 22-25; 2 Crônicas 24, 36; Esdras 1, 3, 6; Neemias 1, 2, 4, 8; Ester 1-8; Jó 1, 2, 42; Salmos diversos; Provérbios 1, 3, 4, 10, 15, 20, 25; Eclesiastes 1.', 'Leitura', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 83, '16', '16', NULL, 'Leitura bíblica — Eclesiastes 3, 5, 7, 11, 12; Isaías 5, 11, 26, 35, 40, 43, 52, 53, 58, 60, 61; Jeremias diversos; Daniel 1-12; Joel 2; Amós 7, 8; Jonas 1-4; Miqueias 4; Ageu 2; Zacarias 4; Malaquias 3, 4; Mateus 1-23.', 'Leitura', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 84, '17', '17', NULL, 'Leitura bíblica — Mateus 24-28; Marcos 7, 9-12, 16; Lucas 1, 2, 7, 8, 10-24; João 1-6, 8-15, 17-21; Atos 1-8.', 'Leitura', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 85, '18', '18', NULL, 'Leitura bíblica — Atos 9-28; Romanos 12-14; 1 Coríntios 13; 2 Coríntios 5, 11, 12; Gálatas 5, 6; Efésios 5, 6; Filipenses 4; Colossenses 3; 1 Tessalonicenses 4, 5; 2 Tessalonicenses 2, 3; 1 Timóteo 4-6; 2 Timóteo 2, 3; Filemom; Hebreus 11; Tiago 1, 3, 5; 1 Pedro 1, 5; 2 Pedro 3; 1 João 2-5; Judas 17-25; Apocalipse 1-3, 7, 12-14, 19-21.', 'Leitura', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 86, '19', '19', NULL, 'Conversar em seu Clube ou Unidade sobre:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 87, '19', '19', 'a', 'O que é cristianismo', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 88, '19', '19', 'b', 'Quais as características de um verdadeiro discípulo', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 89, '19', '19', 'c', 'O que fazer para ser um cristão verdadeiro', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 90, '20', '20', NULL, 'Estudar e entender a pessoa do Espírito Santo, como Ele se relaciona, e qual o Seu papel no crescimento espiritual de cada ser humano.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 91, '21', '21', NULL, 'Descrever os dons espirituais mencionados nos escritos de Paulo (Coríntios, Efésios, Filipenses) e para quais objetivos a igreja recebe esses dons.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 92, '22', '22', NULL, 'Em consulta com seu Conselheiro, escolher um dos seguintes temas e demonstrar seu conhecimento sobre ele:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 93, '22', '22', 'a', 'Uma parábola de Jesus', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::II. Descoberta espiritual::22', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 94, '22', '22', 'b', 'Um milagre de Jesus', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::II. Descoberta espiritual::22', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 95, '22', '22', 'c', 'O Sermão da Montanha', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::II. Descoberta espiritual::22', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 96, '22', '22', 'd', 'Um sermão sobre a Segunda Vinda de Cristo', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::II. Descoberta espiritual::22', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 97, '22', '22', 'e', 'Demonstrar via: troca de ideia com o Conselheiro, atividade em grupo ou redação.', 'Opção', NULL, NULL, false, false, 'texto', 3, NULL, NULL, 'Classes agrupadas::II. Descoberta espiritual::22', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 98, '23', '23', NULL, 'Conversar com seu líder e escolher uma das seguintes histórias, demonstrando sua compreensão de como Jesus salva as pessoas:', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 99, '23', '23', 'a', 'João 3 - Nicodemos', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::II. Descoberta espiritual::23', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 100, '23', '23', 'b', 'João 4 - A mulher samaritana', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::II. Descoberta espiritual::23', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 101, '23', '23', 'c', 'Lucas 10 - O bom samaritano', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::II. Descoberta espiritual::23', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 102, '23', '23', 'd', 'Lucas 15 - O filho pródigo', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::II. Descoberta espiritual::23', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 103, '23', '23', 'e', 'Lucas 19 - Zaqueu', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::II. Descoberta espiritual::23', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 104, '24', '24', NULL, 'Participar de um estudo sobre a inspiração da Bíblia, com a ajuda de um pastor, trabalhando os conceitos de inspiração, revelação e iluminação.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 105, '25', '25', NULL, 'Estudar, com sua Unidade, os eventos finais e a segunda vinda de Cristo.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 106, '26', '26', NULL, 'Estudar a estrutura e serviço do santuário do Antigo Testamento e relacionar com o ministério pessoal de Jesus e a cruz.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 107, '27', '27', NULL, 'Convidar três ou mais pessoas para assistirem a uma classe bíblica ou pequeno grupo.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 108, '28', '28', NULL, 'Através do estudo da Bíblia, descobrir o verdadeiro significado da observância do sábado.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'II. Descoberta espiritual', 2, 109, '29', '29', NULL, 'Ler e resumir três histórias de pioneiros adventistas. Contar essa história na reunião do Clube, no Culto JA ou na Escola Sabatina.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 110, '1', '1', NULL, 'Dedicar duas horas ajudando alguém em sua comunidade, através de uma das seguintes atividades:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 111, '1', '1', 'a', 'Visitar alguém que precisa de amizade e orar com essa pessoa', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::III. Servindo aos outros::1', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 112, '1', '1', 'b', 'Oferecer alimento para alguém carente', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::III. Servindo aos outros::1', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 113, '1', '1', 'c', 'Participar de um projeto ecológico ou educativo', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::III. Servindo aos outros::1', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 114, '2', '2', NULL, 'Planejar e dedicar pelo menos duas horas servindo sua comunidade e demonstrando companheirismo a alguém, de maneira prática.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, 11),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 115, '3', '3', NULL, 'Conhecer os projetos comunitários desenvolvidos em sua cidade e participar em pelo menos um deles com sua Unidade ou Clube.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 116, '4', '4', NULL, 'Participar de dois projetos missionários definidos por seu Clube.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 117, '5', '5', NULL, 'Convidar um amigo para participar de uma atividade social de sua igreja ou da Associação/Missão.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 118, '6', '6', NULL, 'Ajudar a organizar e participar de uma das seguintes atividades:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 119, '6', '6', 'a', 'Fazer uma visita de cortesia a uma pessoa doente', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::III. Servindo aos outros::6', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 120, '6', '6', 'b', 'Adotar uma pessoa ou família em necessidade e ajudá-los', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::III. Servindo aos outros::6', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 121, '6', '6', 'c', 'Um projeto de sua escolha aprovado por seu líder', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::III. Servindo aos outros::6', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 122, '7', '7', NULL, 'Escrever uma redação explicando como ser um bom cidadão no lar e na escola.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 123, '8', '8', NULL, 'Participar de um projeto que beneficiará sua comunidade ou igreja.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, 12),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 124, '9', '9', NULL, 'Participar em três atividades missionárias da igreja.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 125, '10', '10', NULL, 'Trabalhar em um projeto comunitário de sua igreja, escola ou comunidade.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 126, '11', '11', NULL, 'Participar de um projeto comunitário desde o planejamento, organização até a execução.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 127, '12', '12', NULL, 'Discutir com sua Unidade os métodos de evangelismo pessoal e colocar alguns princípios em prática.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 128, '13', '13', NULL, 'Discutir como os jovens adventistas devem se relacionar com as pessoas nas diferentes situações do dia a dia, tais como:', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 129, '13', '13', 'a', 'Vizinhos', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 130, '13', '13', 'b', 'Escola', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 131, '13', '13', 'c', 'Atividades sociais', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'III. Servindo aos outros', 3, 132, '13', '13', 'd', 'Atividades recreativas', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 133, '1', '1', NULL, 'Mencionar dez qualidades de um bom amigo e apresentar quatro situações diárias onde você praticou a Regra Áurea de Mateus 7:12.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 134, '2', '2', NULL, 'Conversar com seu Conselheiro ou Unidade sobre como respeitar pessoas de diferentes culturas, raça e sexo.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 135, '3', '3', NULL, 'Participar de um debate ou representação sobre a pressão de grupo e identificar a influência que isso exerce sobre as decisões.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 136, '4', '4', NULL, 'Participar de um debate e fazer uma avaliação pessoal sobre suas atitudes em dois dos seguintes temas:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 137, '4', '4', 'a', 'Auto-estima', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IV. Desenvolvendo amizade::4', 2, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 138, '4', '4', 'b', 'Amizade', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IV. Desenvolvendo amizade::4', 2, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 139, '4', '4', 'c', 'Relacionamentos', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IV. Desenvolvendo amizade::4', 2, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 140, '4', '4', 'd', 'Otimismo e pessimismo', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IV. Desenvolvendo amizade::4', 2, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 141, '5', '5', NULL, 'Através de uma conversa em grupo ou avaliação pessoal, examinar suas atitudes em dois dos seguintes temas:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 142, '5', '5', 'a', 'Auto-estima', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IV. Desenvolvendo amizade::5', 2, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 143, '5', '5', 'b', 'Relacionamento familiar', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IV. Desenvolvendo amizade::5', 2, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 144, '5', '5', 'c', 'Finanças pessoais', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IV. Desenvolvendo amizade::5', 2, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 145, '5', '5', 'd', 'Pressão de grupo', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IV. Desenvolvendo amizade::5', 2, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 146, '6', '6', NULL, 'Assistir uma palestra ou aula e examinar suas atitudes em relação a dois dos seguintes temas:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 147, '6', '6', 'a', 'A importância da escolha profissional', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IV. Desenvolvendo amizade::6', 2, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 148, '6', '6', 'b', 'Como se relacionar com os pais', 'Opção', NULL, NULL, false, false, 'texto', 3, NULL, NULL, 'Classes agrupadas::IV. Desenvolvendo amizade::6', 2, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 149, '6', '6', 'c', 'A escolha da pessoa certa para namorar', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IV. Desenvolvendo amizade::6', 2, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 150, '6', '6', 'd', 'O plano de Deus para o sexo', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IV. Desenvolvendo amizade::6', 2, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 151, '7', '7', NULL, 'Saber cantar o Hino Nacional de seu país e conhecer sua história. Saber o nome do autor da letra e da música do hino.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 152, '8', '8', NULL, 'Visitar um órgão público de sua cidade ou bairro e descobrir de que maneiras o Clube pode ser útil à sua comunidade.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'IV. Desenvolvendo amizade', 4, 153, '9', '9', NULL, 'Preparar uma lista contendo cinco sugestões de atividades recreativas para ajudar pessoas com necessidades específicas e colaborar na organização de uma destas atividades para essas pessoas.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 154, '1', '1', NULL, 'Completar uma das seguintes especialidades:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 155, '1', '1', 'Natação principiante I', 'Completar a especialidade de Natação principiante I.', 'Especialidade', NULL, 'Natação principiante I', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 156, '1', '1', 'Cultura física', 'Completar a especialidade de Cultura física.', 'Especialidade', NULL, 'Cultura física', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 157, '1', '1', 'Nós e amarras', 'Completar a especialidade de Nós e amarras.', 'Especialidade', NULL, 'Nós e amarras', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 158, '2', '2', NULL, 'Memorizar e explicar I Coríntios 9:24-27.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 159, '3', '3', NULL, 'Escolher uma das atividades abaixo e escrever um texto pessoal para um estilo de vida livre do álcool:', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 160, '3', '3', 'a', 'Participar de uma discussão em classe sobre os efeitos do álcool no organismo', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::V. Saúde e aptidão física::3', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 161, '3', '3', 'b', 'Assistir um vídeo sobre o efeito do álcool ou outras drogas no corpo humano e conversar sobre o assunto', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::V. Saúde e aptidão física::3', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 162, '4', '4', NULL, 'Preparar um programa especial de exercícios físicos diários e conversar com seu líder ou Conselheiro sobre os princípios de aptidão física. Fazer e assinar um compromisso pessoal de realizar exercícios físicos regularmente.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 163, '5', '5', NULL, 'Completar a especialidade de Temperança.', 'Requisito', NULL, 'Temperança', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 164, '6', '6', NULL, 'Fazer uma apresentação, para alunos do Ensino Fundamental, sobre os oito remédios naturais dados por Deus.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 165, '7', '7', NULL, 'Utilizando a experiência de Daniel:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 166, '7', '7', 'a', 'Explicar os princípios de temperança que ele defendeu ou participar de uma apresentação ou encenação sobre Daniel 1.', 'Atividade', NULL, NULL, false, false, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 167, '7', '7', 'b', 'Memorizar e explicar Daniel 1:8.', 'Atividade', NULL, NULL, false, false, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 168, '7', '7', 'c', 'Escrever seu compromisso pessoal de seguir um estilo de vida saudável.', 'Atividade', NULL, NULL, false, false, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 169, '8', '8', NULL, 'Conversar com seu líder sobre a aptidão física e os exercícios físicos regulares que se relacionam com uma vida saudável.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, 12),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 170, '9', '9', NULL, 'Discutir as vantagens do estilo de vida Adventista de acordo com o que a Bíblia ensina.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 171, '10', '10', NULL, 'Completar uma das seguintes atividades:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 172, '10', '10', 'a', 'Escrever uma poesia ou artigo sobre saúde para ser divulgado em uma revista, boletim ou jornal da igreja.', 'Opção', NULL, NULL, false, false, 'texto', 3, NULL, NULL, 'Classes agrupadas::V. Saúde e aptidão física::10', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 173, '10', '10', 'b', 'Individualmente ou em grupo, organizar e participar de uma corrida ou atividade similar e apresentar com antecedência um programa de treinamento físico para esse evento.', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::V. Saúde e aptidão física::10', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 174, '10', '10', 'c', 'Ler as páginas 102-125 do livro Temperança, de Ellen G. White, e apresentar em uma página ou mais, 10 textos selecionados da leitura.', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::V. Saúde e aptidão física::10', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 175, '10', '10', 'd', 'Completar a especialidade de Nutrição ou liderar um grupo para a especialidade de Cultura Física.', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::V. Saúde e aptidão física::10', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 176, '11', '11', NULL, 'Aprender os princípios de uma dieta saudável e ajudar a preparar um quadro com os grupos básicos de alimentos.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 177, '12', '12', NULL, 'Aprender sobre os prejuízos que o cigarro causa à saúde e escrever seu compromisso de não fazer uso do fumo.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 178, '13', '13', NULL, 'Completar uma das seguintes especialidades:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 179, '13', '13', 'Natação principiante II', 'Completar a especialidade de Natação principiante II.', 'Especialidade', NULL, 'Natação principiante II', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'V. Saúde e aptidão física', 5, 180, '13', '13', 'Acampamento II', 'Completar a especialidade de Acampamento II.', 'Especialidade', NULL, 'Acampamento II', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 181, '1', '1', NULL, 'Através da observação, acompanhar todo o processo de planejamento até a execução de uma caminhada de 5 quilômetros.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, 13),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 182, '2', '2', NULL, 'Dirigir ou colaborar em uma meditação criativa para sua Unidade ou Clube.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 183, '3', '3', NULL, 'Dirigir uma cerimônia de abertura da reunião semanal em seu Clube ou um programa de Escola Sabatina.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 184, '4', '4', NULL, 'Assistir a um seminário ou treinamento, oferecido pela sua igreja ou distrito nos departamentos abaixo:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 185, '4', '4', 'a', 'Ministério Pessoal', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 186, '4', '4', 'b', 'Evangelismo', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 187, '5', '5', NULL, 'Preparar um organograma da igreja local e relacionar as funções dos departamentos.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 188, '6', '6', NULL, 'Preparar um organograma da estrutura administrativa da Igreja Adventista em sua Divisão.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 189, '7', '7', NULL, 'Ajudar no planejamento de uma excursão ou acampamento com sua Unidade ou Clube, envolvendo pelo menos um pernoite.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 190, '8', '8', NULL, 'Ajudar a organizar a classe bíblica do seu Clube.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 191, '9', '9', NULL, 'Participar de uma atividade social de sua igreja.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 192, '10', '10', NULL, 'Participar de dois programas envolvendo diferentes departamentos da igreja local.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 193, '11', '11', NULL, 'Participar em um dos itens abaixo:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 194, '11', '11', 'a', 'Curso de Conselheiros', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VI. Organização e liderança::11', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 195, '11', '11', 'b', 'Convenção de liderança da Associação/Missão', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VI. Organização e liderança::11', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 196, '11', '11', 'c', 'Duas reuniões de diretoria do seu Clube', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VI. Organização e liderança::11', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 197, '12', '12', NULL, 'Completar a especialidade de Aventuras com Cristo.', 'Requisito', NULL, 'Aventuras com Cristo', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'VI. Organização e liderança', 6, 198, '13', '13', NULL, 'Planejar e ensinar, no mínimo, dois requisitos de uma especialidade para um grupo ou Unidade de desbravadores.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 199, '1', '1', NULL, 'Completar uma das seguintes especialidades:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 200, '1', '1', 'Felinos', 'Completar a especialidade de Felinos.', 'Especialidade', NULL, 'Felinos', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 201, '1', '1', 'Cães', 'Completar a especialidade de Cães.', 'Especialidade', NULL, 'Cães', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 202, '1', '1', 'Mamíferos', 'Completar a especialidade de Mamíferos.', 'Especialidade', NULL, 'Mamíferos', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 203, '1', '1', 'Sementes', 'Completar a especialidade de Sementes.', 'Especialidade', NULL, 'Sementes', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 204, '1', '1', 'Aves de estimação', 'Completar a especialidade de Aves de estimação.', 'Especialidade', NULL, 'Aves de estimação', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 205, '2', '2', NULL, 'Participar de jogos na natureza ou caminhada ecológica, pelo período de uma hora.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 206, '3', '3', NULL, 'Identificar a estrela Alfa da constelação do Centauro e a constelação de Órion. Conhecer o significado espiritual de Órion, como descrito no livro Primeiros Escritos, de Ellen White, pág. 41.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 207, '4', '4', NULL, 'Estudar a história do dilúvio e o processo de fossilização.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 208, '5', '5', NULL, 'Recapitular a história de Nicodemos e relacioná-la com o ciclo da vida da lagarta ou da borboleta, acrescentando um significado espiritual.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 209, '6', '6', NULL, 'Ler o capítulo 7 do livro O Desejado de Todas as Nações, sobre a infância de Jesus. Apresentar para um grupo, Clube ou Unidade as lições encontradas, demonstrando a importância que o estudo da natureza exerceu na educação e ministério de Jesus.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 210, '7', '7', NULL, 'Aprender e demonstrar uma maneira para purificar a água e escrever um parágrafo destacando o significado de Jesus como a água da vida.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 211, '8', '8', NULL, 'Completar duas das seguintes especialidades:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 212, '8', '8', 'a', 'Anfíbios', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VII. Estudo da natureza::8', 2, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 213, '8', '8', 'b', 'Aves', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VII. Estudo da natureza::8', 2, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 214, '8', '8', 'c', 'Aves domésticas', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VII. Estudo da natureza::8', 2, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 215, '8', '8', 'd', 'Pecuária', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VII. Estudo da natureza::8', 2, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 216, '8', '8', 'e', 'Répteis', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VII. Estudo da natureza::8', 2, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 217, '8', '8', 'f', 'Moluscos', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VII. Estudo da natureza::8', 2, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 218, '8', '8', 'g', 'Árvores', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VII. Estudo da natureza::8', 2, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 219, '8', '8', 'h', 'Arbustos', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VII. Estudo da natureza::8', 2, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 220, '9', '9', NULL, 'Completar uma das especialidades abaixo:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 221, '9', '9', 'Astronomia', 'Completar a especialidade de Astronomia.', 'Especialidade', NULL, 'Astronomia', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 222, '9', '9', 'Cactos', 'Completar a especialidade de Cactos.', 'Especialidade', NULL, 'Cactos', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 223, '9', '9', 'Climatologia', 'Completar a especialidade de Climatologia.', 'Especialidade', NULL, 'Climatologia', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 224, '9', '9', 'Flores', 'Completar a especialidade de Flores.', 'Especialidade', NULL, 'Flores', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 225, '9', '9', 'Rastreio de animais', 'Completar a especialidade de Rastreio de animais.', 'Especialidade', NULL, 'Rastreio de animais', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 226, '10', '10', NULL, 'Completar uma especialidade, não realizada anteriormente, em Estudos da natureza.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, 13),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 227, '11', '11', NULL, 'Completar duas especialidades em Estudos da Natureza, não realizadas anteriormente.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 228, '12', '12', NULL, 'Completar uma das seguintes especialidades:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 229, '12', '12', 'Ecologia', 'Completar a especialidade de Ecologia.', 'Especialidade', NULL, 'Ecologia', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 230, '12', '12', 'Conservação ambiental', 'Completar a especialidade de Conservação ambiental.', 'Especialidade', NULL, 'Conservação ambiental', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 231, '13', '13', NULL, 'Aprender e montar três tipos de barraca em locais apropriados.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VII. Estudo da natureza', 7, 232, '14', '14', NULL, 'Recapitular o estudo da criação e fazer um diário por sete dias registrando suas observações do que foi criado em cada dia correspondente.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 233, '1', '1', NULL, 'Demonstrar como cuidar corretamente de uma corda. Fazer e explicar o uso prático dos seguintes nós:', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 234, '1', '1', 'a', 'Simples', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 235, '1', '1', 'b', 'Cego', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 236, '1', '1', 'c', 'Direito', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 237, '1', '1', 'd', 'Cirurgião', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 238, '1', '1', 'e', 'Lais de guia', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 239, '1', '1', 'f', 'Lais de guia duplo', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 240, '1', '1', 'g', 'Escota', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 241, '1', '1', 'h', 'Catau', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 242, '1', '1', 'i', 'Pescador', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 243, '1', '1', 'j', 'Fateixa', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 244, '1', '1', 'k', 'Volta do fiel', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 245, '1', '1', 'l', 'Nó de gancho', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 246, '1', '1', 'm', 'Volta da ribeira', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 247, '1', '1', 'n', 'Ordinário', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 248, '2', '2', NULL, 'Descobrir os pontos cardeais sem a ajuda de uma bússola e desenhar a Rosa dos Ventos.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 249, '3', '3', NULL, 'Apresentar seis segredos para um bom acampamento. Participar de um acampamento de final de semana, planejando e cozinhando duas refeições.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 250, '4', '4', NULL, 'Fazer um fogo refletor e mostrar seu uso.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 251, '5', '5', NULL, 'Com um grupo de, no mínimo, quatro pessoas e com a presença de um Conselheiro adulto experiente, andar pelo menos 20 quilômetros numa área rural ou deserta, incluindo uma noite ao ar livre ou em barraca. Planejar a expedição em detalhes antes da saída. Durante a caminhada, efetuar anotações sobre o terreno, flora e fauna observados. Depois, usando as anotações, participar de uma discussão de grupo, dirigida por seu Conselheiro.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 252, '6', '6', NULL, 'Participar com sua Unidade de um acampamento com estrutura de pioneiria, planejando o que vai acontecer neste acampamento.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 253, '7', '7', NULL, 'Completar a especialidade de Acampamento I.', 'Requisito', NULL, 'Acampamento I', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 254, '8', '8', NULL, 'Participar de um acampamento de final de semana e fazer um relatório destacando o que mais lhe impressionou positivamente.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 255, '9', '9', NULL, 'Completar as seguintes especialidades:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 256, '9', '9', 'a', 'Acampamento III', 'Especialidade', NULL, 'Acampamento III', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 257, '9', '9', 'b', 'Primeiros socorros - Básico', 'Especialidade', NULL, 'Primeiros socorros - Básico', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 258, '10', '10', NULL, 'Participar de um acampamento de final de semana, arrumando de forma apropriada sua bolsa ou mochila com o equipamento pessoal necessário.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 259, '11', '11', NULL, 'Completar a especialidade de Pioneirias.', 'Requisito', NULL, 'Pioneirias', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 260, '12', '12', NULL, 'Planejar, preparar e cozinhar três refeições ao ar livre.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 261, '13', '13', NULL, 'Apresentar 10 regras para uma caminhada e explicar o que fazer quando estiver perdido.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 262, '14', '14', NULL, 'Aprender os seguintes nós:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 263, '14', '14', 'a', 'Oito', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 264, '14', '14', 'b', 'Volta do salteador', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 265, '14', '14', 'c', 'Duplo', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 266, '14', '14', 'd', 'Caminhoneiro', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 267, '14', '14', 'e', 'Direito', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 268, '14', '14', 'f', 'Volta do Fiel', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 269, '14', '14', 'g', 'Escota', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 270, '14', '14', 'h', 'Laís de Guia', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 271, '14', '14', 'i', 'Simples', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 272, '15', '15', NULL, 'Aprender a usar uma bússola ou um GPS (urbano ou campo), e demonstrar sua habilidade encontrando endereços na zona urbana.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 273, '16', '16', NULL, 'Completar a especialidade de Resgate Básico.', 'Requisito', NULL, 'Resgate Básico', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 274, '17', '17', NULL, 'Construir e utilizar um móvel de acampamento em tamanho real, com nós e amarras.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 275, '18', '18', NULL, 'Aprender os sinais para seguir uma pista. Preparar e seguir uma pista de no mínimo 10 sinais, que possa ser seguida por outros.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 276, '19', '19', NULL, 'Completar uma especialidade, não realizada anteriormente, que possa ser contada para um dos mestrados abaixo:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 277, '19', '19', 'a', 'Aquática', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VIII. Arte de acampar::19', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 278, '19', '19', 'b', 'Esportes', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VIII. Arte de acampar::19', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 279, '19', '19', 'c', 'Atividades recreativas', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VIII. Arte de acampar::19', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'VIII. Arte de acampar', 8, 280, '19', '19', 'd', 'Vida campestre', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::VIII. Arte de acampar::19', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 281, '1', '1', NULL, 'Completar duas especialidades não realizadas anteriormente na área de Artes e Habilidades Manuais.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 282, '2', '2', NULL, 'Completar uma especialidade não realizada anteriormente na seção de Artes e Habilidades Manuais.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 283, '3', '3', NULL, 'Completar uma especialidade não realizada anteriormente em uma das seguintes áreas:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 284, '3', '3', 'a', 'Atividades Missionárias', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IX. Estilo de vida::3', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 285, '3', '3', 'b', 'Atividades Profissionais', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IX. Estilo de vida::3', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 286, '3', '3', 'c', 'Atividades Agrícolas', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IX. Estilo de vida::3', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 287, '4', '4', NULL, 'Completar uma especialidade não realizada anteriormente em uma das seguintes áreas:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 288, '4', '4', 'a', 'Atividades Missionárias', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IX. Estilo de vida::4', 1, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 289, '4', '4', 'b', 'Atividades Agrícolas', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IX. Estilo de vida::4', 1, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 290, '4', '4', 'c', 'Ciência e Saúde', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IX. Estilo de vida::4', 1, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 291, '4', '4', 'd', 'Habilidades Domésticas', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IX. Estilo de vida::4', 1, NULL, NULL, 14, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 292, '5', '5', NULL, 'Completar uma especialidade não realizada anteriormente em uma das seguintes áreas:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 293, '5', '5', 'a', 'Atividades Recreativas', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IX. Estilo de vida::5', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 294, '5', '5', 'b', 'Ciência e Saúde', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IX. Estilo de vida::5', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 295, '5', '5', 'c', 'Habilidades Domésticas', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IX. Estilo de vida::5', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas', 'IX. Estilo de vida', 9, 296, '5', '5', 'd', 'Atividades Profissionais', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas::IX. Estilo de vida::5', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 297, '1', '1', NULL, 'Memorizar, cantar ou tocar o Hino dos Desbravadores e conhecer a história do hino.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 298, '2', '2', NULL, 'Em consulta com seu líder, escolher um dos seguintes personagens do Antigo Testamento e conversar com seu grupo sobre o amor e cuidado de Deus e o livramento demonstrado na vida do personagem escolhido:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 299, '2', '2', 'a', 'José', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Amigo da Natureza::I. Amigo da Natureza::2', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 300, '2', '2', 'b', 'Jonas', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Amigo da Natureza::I. Amigo da Natureza::2', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 301, '2', '2', 'c', 'Ester', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Amigo da Natureza::I. Amigo da Natureza::2', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 302, '2', '2', 'd', 'Rute', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Amigo da Natureza::I. Amigo da Natureza::2', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 303, '3', '3', NULL, 'Levar pelo menos dois amigos não adventistas à Escola Sabatina ou ao Clube de Desbravadores.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 304, '4', '4', NULL, 'Conhecer os princípios de higiene, de boas maneiras à mesa e como se comportar diante de pessoas que tenham diferentes idades. Demonstrar e explicar como estas boas maneiras podem ser úteis nas reuniões e acampamentos do Clube.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 305, '5', '5', NULL, 'Completar a Especialidade de Arte de acampar.', 'Requisito', NULL, 'Arte de acampar', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 306, '6', '6', NULL, 'Conhecer e identificar 10 flores silvestres e 10 insetos de sua região.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 307, '7', '7', NULL, 'Começar uma fogueira com apenas um fósforo, usando materiais naturais, e mantê-la acesa.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 308, '8', '8', NULL, 'Usar corretamente uma faca, facão ou uma machadinha e conhecer dez regras para usá-los com segurança.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 309, '9', '9', NULL, 'Escolher e completar uma especialidade em uma das áreas abaixo:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 310, '9', '9', 'a', 'Atividades Missionárias e Comunitárias', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Amigo da Natureza::I. Amigo da Natureza::9', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Amigo da Natureza', 'I. Amigo da Natureza', 1, 311, '9', '9', 'b', 'Atividades Agrícolas e Afins', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Amigo da Natureza::I. Amigo da Natureza::9', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 312, '1', '1', NULL, 'Aprender e demonstrar a composição, significado e uso correto da Bandeira Nacional.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 313, '2', '2', NULL, 'Ler a primeira visão de Ellen White e discutir como Deus usa os profetas para apresentar Sua mensagem à igreja (ver Primeiros Escritos, págs. 13 a 20).', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 314, '3', '3', NULL, 'Participar de uma atividade missionária ou comunitária, envolvendo também um amigo.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 315, '4', '4', NULL, 'Conversar com seu Conselheiro ou Unidade sobre como demonstrar respeito pelos seus pais ou responsáveis e fazer uma lista mostrando como cuidam de você.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 316, '5', '5', NULL, 'Participar de uma caminhada de 6 quilômetros, preparando, ao final, um relatório de uma página.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 317, '6', '6', NULL, 'Escolher um dos seguintes itens:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 318, '6', '6', 'a', 'Assistir a um curso "Como deixar de fumar"', 'Opção', NULL, NULL, false, false, 'texto', 3, NULL, NULL, 'Classes agrupadas — Companheiro de Excursionismo::II. Companheiro de Excursionismo::6', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 319, '6', '6', 'b', 'Assistir a dois filmes sobre saúde', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Companheiro de Excursionismo::II. Companheiro de Excursionismo::6', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 320, '6', '6', 'c', 'Ajudar a preparar material para uma exposição ou passeata sobre saúde', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Companheiro de Excursionismo::II. Companheiro de Excursionismo::6', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 321, '6', '6', 'd', 'Pesquisar na internet informações sobre saúde e escrever uma página sobre os resultados encontrados', 'Opção', NULL, NULL, false, false, 'texto', 3, NULL, NULL, 'Classes agrupadas — Companheiro de Excursionismo::II. Companheiro de Excursionismo::6', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 322, '7', '7', NULL, 'Identificar e descrever 12 pássaros e 12 árvores nativas.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 323, '8', '8', NULL, 'Planejar e organizar uma das seguintes:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 324, '8', '8', 'a', 'Investidura', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Companheiro de Excursionismo::II. Companheiro de Excursionismo::8', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 325, '8', '8', 'b', 'Admissão em lenço', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Companheiro de Excursionismo::II. Companheiro de Excursionismo::8', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 326, '8', '8', 'c', 'Dia Mundial do Desbravador', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Companheiro de Excursionismo::II. Companheiro de Excursionismo::8', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 327, '9', '9', NULL, 'Preparar uma refeição em uma fogueira durante um acampamento do Clube ou unidade.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 328, '10', '10', NULL, 'Preparar um quadro com quinze nós diferentes.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 329, '11', '11', NULL, 'Completar a especialidade de Excursionismo Pedestre com mochila.', 'Requisito', NULL, 'Excursionismo Pedestre com mochila', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 330, '12', '12', NULL, 'Completar uma especialidade, não realizada anteriormente, em uma das seguintes áreas:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 331, '12', '12', 'a', 'Habilidades Domésticas', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Companheiro de Excursionismo::II. Companheiro de Excursionismo::12', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 332, '12', '12', 'b', 'Ciência e Saúde', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Companheiro de Excursionismo::II. Companheiro de Excursionismo::12', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 333, '12', '12', 'c', 'Atividades Missionárias e Comunitárias', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Companheiro de Excursionismo::II. Companheiro de Excursionismo::12', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Companheiro de Excursionismo', 'II. Companheiro de Excursionismo', 2, 334, '12', '12', 'd', 'Atividades Agrícolas e Afins', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Companheiro de Excursionismo::II. Companheiro de Excursionismo::12', 1, NULL, NULL, 11, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 335, '1', '1', NULL, 'Conhecer e saber usar de forma adequada a Bandeira dos Desbravadores e o Bandeirim de Unidade.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 336, '2', '2', NULL, 'Ler a história de J. N. Andrews ou um pioneiro de seu país. Discutir a importância do trabalho de missionários em outros países e por que Cristo ordenou a Grande Comissão (Mateus 28:18-20).', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 337, '3', '3', NULL, 'Convidar uma pessoa para assistir um dos seguintes programas:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 338, '3', '3', 'a', 'Clube de Desbravadores', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::3', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 339, '3', '3', 'b', 'Classe Bíblica', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::3', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 340, '3', '3', 'c', 'Pequenos Grupos', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::3', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 341, '4', '4', NULL, 'Fazer uma das seguintes especialidades:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 342, '4', '4', 'Asseio e cortesia cristã', 'Completar a especialidade de Asseio e cortesia cristã.', 'Especialidade', NULL, 'Asseio e cortesia cristã', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 343, '4', '4', 'Vida familiar', 'Completar a especialidade de Vida familiar.', 'Especialidade', NULL, 'Vida familiar', false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 344, '5', '5', NULL, 'Participar de uma caminhada de 10 km e fazer uma lista dos equipamentos necessários, incluindo a roupa e o calçado que devem ser usados.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 345, '6', '6', NULL, 'Participar na organização de um dos eventos especiais do Clube:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 346, '6', '6', 'a', 'Investidura', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::6', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 347, '6', '6', 'b', 'Admissão em lenço', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::6', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 348, '6', '6', 'c', 'Dia Mundial do Desbravador', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::6', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 349, '7', '7', NULL, 'Identificar seis pegadas de animais ou aves. Fazer um modelo em gesso, massa de modelar ou biscuit de três dessas pegadas.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 350, '8', '8', NULL, 'Aprender a fazer as quatro amarras básicas e construir um móvel de acampamento.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 351, '9', '9', NULL, 'Planejar um cardápio vegetariano para sua Unidade, para um acampamento de três dias e apresentar ao seu instrutor.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 352, '10', '10', NULL, 'Enviar e receber uma mensagem através de uma das formas de comunicação abaixo:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 353, '10', '10', 'a', 'Alfabeto com semáforos', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::10', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 354, '10', '10', 'b', 'Código Morse, com lanterna', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::10', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 355, '10', '10', 'c', 'Alfabeto LIBRAS (língua de sinais)', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::10', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 356, '10', '10', 'd', 'Alfabeto Braile', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::10', 1, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 357, '11', '11', NULL, 'Completar uma especialidade, não realizada anteriormente, em duas das seguintes áreas:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 358, '11', '11', 'a', 'Habilidades Domésticas', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::11', 2, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 359, '11', '11', 'b', 'Ciência e Saúde', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::11', 2, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 360, '11', '11', 'c', 'Atividades Missionárias e Comunitárias', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::11', 2, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pesquisador de Campo e Bosque', 'III. Pesquisador de Campo e Bosque', 3, 361, '11', '11', 'd', 'Atividades Agrícolas e Afins', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pesquisador de Campo e Bosque::III. Pesquisador de Campo e Bosque::11', 2, NULL, NULL, 12, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 362, '1', '1', NULL, 'Completar a especialidade de Cidadania cristã, caso não tenha sido feita anteriormente.', 'Requisito', NULL, 'Cidadania cristã', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 363, '2', '2', NULL, 'Encenar a história do bom samaritano, demonstrando como ajudar as pessoas. Auxiliar de forma prática pelo menos a três pessoas.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 364, '3', '3', NULL, 'Participar de uma das seguintes atividades, apresentando ao final um relatório escrito contendo no mínimo duas páginas:', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 365, '3', '3', 'a', 'Caminhar 10 km', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::3', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 366, '3', '3', 'b', 'Cavalgar 2 km', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::3', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 367, '3', '3', 'c', 'Viajar de canoa durante 2h', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::3', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 368, '3', '3', 'd', 'Praticar 15 km de ciclismo', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::3', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 369, '3', '3', 'e', 'Nadar 200 metros', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::3', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 370, '3', '3', 'f', 'Correr 1500 metros', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::3', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 371, '3', '3', 'g', 'Rodar 2 km de patins ou roller', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::3', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 372, '4', '4', NULL, 'Completar a especialidade de Mapa e bússola.', 'Requisito', NULL, 'Mapa e bússola', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 373, '5', '5', NULL, 'Demonstrar habilidade no uso correto de uma machadinha.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 374, '6', '6', NULL, 'Ser capaz de acender uma fogueira em dia de chuva, saber como conseguir lenha seca e manter o fogo aceso.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 375, '7', '7', NULL, 'Completar um dos seguintes itens:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 376, '7', '7', 'a', 'Pesquisar e identificar 10 variedades de plantas silvestres comestíveis.', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::7', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 377, '7', '7', 'b', 'Ser capaz de enviar e receber 35 letras por minuto pelo código semafórico', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::7', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 378, '7', '7', 'c', 'Ser capaz de enviar e receber 35 letras por minuto através do código náutico, usando o código internacional', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::7', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 379, '7', '7', 'd', 'Ser capaz de apresentar e entender Mateus 24 em LIBRAS (língua de sinais)', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::7', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 380, '7', '7', 'e', 'Preparar o salmo 23 em braile', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::7', 1, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 381, '8', '8', NULL, 'Completar uma especialidade, não realizada anteriormente, em Atividades Recreativas.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 382, '9', '9', NULL, 'Pesquisar e identificar, através de fotografia, exposição ou ao vivo, dois dos seguintes itens:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 383, '9', '9', 'a', '25 folhas de árvores', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::9', 2, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 384, '9', '9', 'b', '25 rochas e minerais', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::9', 2, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 385, '9', '9', 'c', '25 flores silvestres', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::9', 2, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 386, '9', '9', 'd', '25 borboletas e mariposas', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::9', 2, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 387, '9', '9', 'e', '25 conchas', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Pioneiro de Novas Fronteiras::IV. Pioneiro de Novas Fronteiras::9', 2, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Pioneiro de Novas Fronteiras', 'IV. Pioneiro de Novas Fronteiras', 4, 388, '10', '10', NULL, 'Completar a especialidade de Fogueiras e cozinha ao ar livre.', 'Requisito', NULL, 'Fogueiras e cozinha ao ar livre', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 13, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 389, '1', '1', NULL, 'Fazer uma apresentação escrita ou falada sobre o respeito que devemos ter com a Lei de Deus e as autoridades civis, enumerando dez princípios de comportamento moral.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 390, '2', '2', NULL, 'Acompanhar seu pastor ou ancião numa visita missionária ou estudo bíblico.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 391, '3', '3', NULL, 'Completar a especialidade de Testemunho juvenil.', 'Requisito', NULL, 'Testemunho juvenil', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 392, '4', '4', NULL, 'Apresentar cinco atividades junto à natureza, que podem ser desenvolvidas nas tardes de Sábado.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 393, '5', '5', NULL, 'Com sua Unidade, construir um móvel de acampamento e um portal para o Clube.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 394, '6', '6', NULL, 'Através da supervisão de seu líder ou Conselheiro, conversar em sua Unidade ou Clube sobre um dos seguintes temas:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 395, '6', '6', 'a', 'Modéstia Cristã', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Excursionista na Mata::V. Excursionista na Mata::6', 1, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 396, '6', '6', 'b', 'Recreação', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Excursionista na Mata::V. Excursionista na Mata::6', 1, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 397, '6', '6', 'c', 'Saúde', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Excursionista na Mata::V. Excursionista na Mata::6', 1, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 398, '6', '6', 'd', 'Observância do Sábado', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Excursionista na Mata::V. Excursionista na Mata::6', 1, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 399, '7', '7', NULL, 'Demonstrar conhecimento para encontrar alimentos, através de plantas silvestres de sua região e saber diferenciá-las de plantas tóxicas/venenosas.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 400, '8', '8', NULL, 'Demonstrar conhecimento quanto aos procedimentos necessários em caso de ferimentos por diferentes animais peçonhentos e não peçonhentos.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 401, '9', '9', NULL, 'Demonstrar técnicas para percorrer trilhas em diferentes tipos de terrenos, como: desertos, florestas, pântanos e rios.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 402, '10', '10', NULL, 'Completar a Especialidade de Ordem unida.', 'Requisito', NULL, 'Ordem unida', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Excursionista na Mata', 'V. Excursionista na Mata', 5, 403, '11', '11', NULL, 'Completar a Especialidade de Vida silvestre.', 'Requisito', NULL, 'Vida silvestre', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 14, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 404, '1', '1', NULL, 'Completar a especialidade de Mordomia.', 'Requisito', NULL, 'Mordomia', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 405, '2', '2', NULL, 'Ler o livro O Maior Discurso de Cristo e escrever uma página sobre o efeito da leitura em sua vida.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 406, '3', '3', NULL, 'Cumprir um dos seguintes itens:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 407, '3', '3', 'a', 'Trazer dois amigos para assistir a duas diferentes reuniões da igreja.', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Guia de Exploração::VI. Guia de Exploração::3', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 408, '3', '3', 'b', 'Ajudar a planejar e participar de, no mínimo, quatro domingos em uma série de evangelismo jovem.', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Guia de Exploração::VI. Guia de Exploração::3', 1, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 409, '4', '4', NULL, 'Escrever uma página ou apresentar uma palestra sobre como influenciar amigos para Cristo.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 410, '5', '5', NULL, 'Observar durante o período de dois meses o trabalho dos diáconos, apresentando um relatório detalhado de suas atividades, contendo:', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 411, '5', '5', 'a', 'Cuidado da propriedade da igreja', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 412, '5', '5', 'b', 'Cerimônia de lava-pés', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 413, '5', '5', 'c', 'Cerimônia de batismo', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 414, '5', '5', 'd', 'Recolhimento dos dízimos e ofertas', 'Atividade', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 415, '6', '6', NULL, 'Completar uma Especialidade, não realizada anteriormente, para o mestrado em Vida campestre.', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 416, '7', '7', NULL, 'Projetar três tipos diferentes de abrigo, explicar seu uso e utilizar um deles em um acampamento.', 'Requisito', NULL, NULL, false, true, 'texto', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 417, '8', '8', NULL, 'Assistir a um seminário ou apresentar uma palestra sobre dois dos seguintes temas:', 'Requisito', NULL, NULL, false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 418, '8', '8', 'a', 'Aborto', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Guia de Exploração::VI. Guia de Exploração::8', 2, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 419, '8', '8', 'b', 'Bullying', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Guia de Exploração::VI. Guia de Exploração::8', 2, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 420, '8', '8', 'c', 'Violência', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Guia de Exploração::VI. Guia de Exploração::8', 2, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 421, '8', '8', 'd', 'Drogas', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Guia de Exploração::VI. Guia de Exploração::8', 2, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 422, '8', '8', 'e', 'Doenças Sexualmente Transmissíveis', 'Opção', NULL, NULL, false, false, 'nenhum', 3, NULL, NULL, 'Classes agrupadas — Guia de Exploração::VI. Guia de Exploração::8', 2, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 423, '9', '9', NULL, 'Completar a Especialidade de Liderança campestre.', 'Requisito', NULL, 'Liderança campestre', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL),
  ('Classes agrupadas — Guia de Exploração', 'VI. Guia de Exploração', 6, 424, '10', '10', NULL, 'Completar a Especialidade em Orçamento familiar.', 'Requisito', NULL, 'Orçamento familiar', false, true, 'nenhum', 3, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL)
ON CONFLICT (classe_nome, secao, codigo, COALESCE(subitem, '')) DO UPDATE SET
  secao_ordem = EXCLUDED.secao_ordem,
  ordem = EXCLUDED.ordem,
  codigo_raiz = EXCLUDED.codigo_raiz,
  texto = EXCLUDED.texto,
  tipo = EXCLUDED.tipo,
  especialidade_nome = EXCLUDED.especialidade_nome,
  avancada = EXCLUDED.avancada,
  pontua = EXCLUDED.pontua,
  formato_resposta = EXCLUDED.formato_resposta,
  grupo_escolha = EXCLUDED.grupo_escolha,
  escolhas_necessarias = EXCLUDED.escolhas_necessarias,
  idade_agrupada_min = EXCLUDED.idade_agrupada_min,
  idade_agrupada_max = EXCLUDED.idade_agrupada_max,
  ativo = TRUE,
  updated_at = now();

-- "Classes agrupadas" nunca gera entrada automatica em Receber (nao substitui
-- os cartoes oficiais). Ajusta o nucleo para ignorar essa classe.
CREATE OR REPLACE FUNCTION public.recalcular_classe_receber(
  p_clube_id INTEGER, p_dbv_id INTEGER, p_classe_nome TEXT, p_avancada BOOLEAN, p_item_nome TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_feitos INTEGER;
  v_atividade_id BIGINT;
  v_dbv_nome TEXT;
  v_ja_entregue BOOLEAN;
BEGIN
  IF p_classe_nome IS NULL OR p_classe_nome LIKE 'Classes agrupadas%' THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_total
  FROM public.classes_requisitos_catalogo c
  WHERE c.ativo = TRUE AND c.pontua = TRUE AND c.classe_nome = p_classe_nome AND c.avancada = p_avancada;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_feitos
  FROM public.classes_requisitos_progresso pr
  JOIN public.classes_requisitos_catalogo c ON c.id = pr.requisito_id
  WHERE pr.dbv_id = p_dbv_id
    AND pr.concluido = TRUE
    AND c.ativo = TRUE AND c.pontua = TRUE AND c.classe_nome = p_classe_nome AND c.avancada = p_avancada;

  SELECT entregue INTO v_ja_entregue
  FROM public.investidura_itens
  WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND tipo = 'classe' AND item_nome = p_item_nome;
  IF v_ja_entregue THEN
    RETURN;
  END IF;

  SELECT nome INTO v_dbv_nome FROM public.desbravadores WHERE id = p_dbv_id;

  IF v_feitos >= v_total THEN
    SELECT id INTO v_atividade_id FROM public.atividades
     WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_formativo_tipo = 'classe'
       AND item_formativo_nome = p_item_nome AND criado_por = '__sistema_classes__';

    IF v_atividade_id IS NULL THEN
      INSERT INTO public.atividades
        (clube_id, titulo, descricao, destino, dbv_id, dbv_nome, criado_por,
         item_formativo_tipo, item_formativo_nome, gera_investidura)
      VALUES (
        p_clube_id, 'Classe ' || p_item_nome || ' completa',
        'Todos os requisitos da classe foram concluidos.', 'desbravador',
        p_dbv_id, v_dbv_nome, '__sistema_classes__', 'classe', p_item_nome, TRUE
      )
      RETURNING id INTO v_atividade_id;

      INSERT INTO public.atividades_alvos (clube_id, atividade_id, tipo, membro_id)
      VALUES (p_clube_id, v_atividade_id, 'membro', p_dbv_id);
    END IF;

    INSERT INTO public.atividades_respostas
      (clube_id, atividade_id, dbv_id, dbv_nome, status, entregue_em, updated_at)
    VALUES (p_clube_id, v_atividade_id, p_dbv_id, v_dbv_nome, 'aprovada', now(), now())
    ON CONFLICT (atividade_id, dbv_id) DO UPDATE
      SET status = 'aprovada', updated_at = now();
  ELSE
    DELETE FROM public.atividades
     WHERE clube_id = p_clube_id AND dbv_id = p_dbv_id AND item_formativo_tipo = 'classe'
       AND item_formativo_nome = p_item_nome AND criado_por = '__sistema_classes__';
  END IF;
END;
$$;

-- Marcar/desmarcar em massa tambem respeita a faixa de idade do membro quando
-- a classe for "Classes agrupadas" (para as demais classes, min/max sao NULL
-- e a condicao AND fica sempre verdadeira).
CREATE OR REPLACE FUNCTION public.marcar_classe_completa(
  p_clube_id INTEGER, p_dbv_id INTEGER, p_classe_nome TEXT, p_avancada BOOLEAN, p_concluir BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item_nome TEXT;
  v_idade INTEGER;
BEGIN
  IF NOT (
    public.current_user_is_admin_ti()
    OR EXISTS (
      SELECT 1 FROM public.usuario_clubes uc
      WHERE uc.usuario_id = auth.uid()
        AND uc.clube_id = p_clube_id
        AND uc.ativo = TRUE
        AND uc.perfil IN ('admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria')
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissao para marcar ou desmarcar esta classe.' USING ERRCODE = '42501';
  END IF;

  v_idade := public.idade_membro(p_dbv_id);

  IF p_concluir THEN
    INSERT INTO public.classes_requisitos_progresso
      (clube_id, dbv_id, requisito_id, classe_nome, concluido, origem, concluido_por, concluido_em, updated_at)
    SELECT p_clube_id, p_dbv_id, c.id, c.classe_nome, TRUE, 'manual', auth.uid(), now(), now()
    FROM public.classes_requisitos_catalogo c
    WHERE c.ativo = TRUE AND c.classe_nome = p_classe_nome AND c.avancada = p_avancada
      AND (c.idade_agrupada_min IS NULL OR (
        v_idade IS NOT NULL AND v_idade >= c.idade_agrupada_min
        AND (c.idade_agrupada_max IS NULL OR v_idade <= c.idade_agrupada_max)
      ))
    ON CONFLICT (clube_id, dbv_id, requisito_id) DO UPDATE
      SET concluido = TRUE, updated_at = now();
  ELSE
    DELETE FROM public.classes_requisitos_progresso pr
    USING public.classes_requisitos_catalogo c
    WHERE pr.requisito_id = c.id
      AND pr.clube_id = p_clube_id
      AND pr.dbv_id = p_dbv_id
      AND c.classe_nome = p_classe_nome
      AND c.avancada = p_avancada;
  END IF;

  IF p_avancada THEN
    SELECT nome_avancada INTO v_item_nome FROM public.classes_nomes_avancadas WHERE classe_nome = p_classe_nome;
  END IF;
  v_item_nome := COALESCE(v_item_nome, p_classe_nome);

  PERFORM public.recalcular_classe_receber(p_clube_id, p_dbv_id, p_classe_nome, p_avancada, v_item_nome);
END;
$$;
