-- Ajustes de requisitos conforme a decisao sobre as divergencias Banco x Word.
-- AA-001 Avicultura: inativada. AA-006 Pescaria: Word, sem o subitem "Pesca comercial". AA-007 Criacao de gado leiteiro: redacao do banco onde divergia, sem os itens que so existiam no banco.
-- AA-011 Cavalos, AA-015 Cabras, AR-060 Skate e AR-119 Slackline: mantidos como estao no banco (o Word nao traz o texto: paginas ausentes do PDF); em Skate acrescenta-se so a nota do instrutor.
-- Tudo ou nada: se alguma especialidade nao for encontrada pelo codigo, nada e alterado.
CREATE OR REPLACE FUNCTION pg_temp.set_req(p_codigo text, p_nivel text, p_linhas text[]) RETURNS void
LANGUAGE plpgsql AS $f$
DECLARE
  v_prog integer := (SELECT id FROM public.programas WHERE nome ILIKE '%desbravador%' ORDER BY id LIMIT 1);
  em public.especialidades_modelo%ROWTYPE;
BEGIN
  SELECT * INTO em FROM public.especialidades_modelo WHERE programa_id = v_prog AND codigo = p_codigo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Especialidade % nao encontrada.', p_codigo; END IF;

  DELETE FROM public.mda_requisitos_modelo
   WHERE programa_id = v_prog AND item_tipo = 'Especialidade'
     AND (especialidade_id = em.id OR (especialidade_id IS NULL AND item_url IS NOT NULL AND item_url = em.item_url));

  INSERT INTO public.mda_requisitos_modelo (programa_id, item_tipo, item_nome, item_codigo, item_url, especialidade_id, secao, ordem, texto)
  SELECT v_prog, 'Especialidade', em.nome, em.codigo, COALESCE(em.item_url, 'manual-2025/' || em.codigo), em.id, NULL, t.ord::integer, t.txt
    FROM unnest(p_linhas) WITH ORDINALITY AS t(txt, ord);

  UPDATE public.especialidades_modelo
     SET quantidade_requisitos = array_length(p_linhas, 1),
         nivel = COALESCE(p_nivel, nivel),
         updated_at = now()
   WHERE id = em.id;
END
$f$;

DO $$
DECLARE
  v_prog integer := (SELECT id FROM public.programas WHERE nome ILIKE '%desbravador%' ORDER BY id LIMIT 1);
  em public.especialidades_modelo%ROWTYPE;
  v_ord integer;
BEGIN
  -- AA-001 Avicultura: inativar
  UPDATE public.especialidades_modelo SET ativo = false, updated_at = now() WHERE programa_id = v_prog AND codigo = 'AA-001';
  IF NOT FOUND THEN RAISE EXCEPTION 'AA-001 nao encontrada.'; END IF;

  PERFORM pg_temp.set_req('AA-006', '2', ARRAY[
    '1. Qual a diferença entre pesca e pescaria?',
    '2. Explicar as seguintes modalidades:',
    'a) Pesca de subsistência;',
    'b) Pesca esportiva;',
    '3. Listar cinco diferentes métodos de pesca e demonstrar, ao menos, dois a seu instrutor.',
    '4. Qual a melhor maré para a pesca? Qual a relação entre a lua e os diferentes tipos de maré?',
    '5. Fazer um quadro usando figuras, fotos ou desenhos das iscas e anzóis mais comuns em sua região, explicando as variações e indicações de cada um.',
    '6. Participar de uma viagem ou passeio de pesca e pescar, ao menos, dois peixes, cada um utilizando um método diferente, dentre os listados no requisito 3.',
    '7. Fazer o seguinte:',
    'a) Uma coleção de fotos de 30 peixes comuns em sua região, identificando seus nomes, local de habitação, dieta, etc.',
    'b) Uma coleção de fotos de 10 peixes venenosos, tendo, no mínimo, cinco nativos de sua região ou país.',
    '8. Ler Deuteronômio 14:9-10. Após a leitura, separar os peixes do requisito 7 entre puros e impuros, explicando a importância de saber separá-los.',
    '9. Ler Lucas 5:1-10. Em seguida, fazer uma lista apresentando, ao menos, 10 diferentes formas de demonstrar em sua vida como ser um “pescador de homens”.'
  ]);

  PERFORM pg_temp.set_req('AA-007', '2', ARRAY[
    '1. Quais pontos devem ser levados em consideração ao escolher uma vaca para a produção de leite?',
    '2. Mencionar, pelo menos, 25 partes de uma vaca leiteira.',
    '3. Identificar, ao vivo ou por meio de imagens, 3 raças de bovinos de corte e 3 raças de gado leiteiro.',
    '4. Quais são as instalações necessárias para a criação de gado leiteiro?',
    '5. Como uma novilha pode ser treinada de maneira que se torne uma vaca mansa?',
    '6. Conhecer os cuidados, tratamento e alimentação para o gado leiteiro em cada um dos seguintes estágios:',
    'a) Bezerro;',
    'b) Do desmame até os 6 meses de vida;',
    'c) Dos 6 meses até os 15 meses de vida;',
    'd) Dos 15 meses até a gestação;',
    'e) Lactação;',
    'f) Período seco.',
    '7. Saber como o leite é produzido na vaca.',
    '8. Conhecer os passos necessários para ordenhar uma vaca, tanto de maneira manual como mecânica.',
    '9. Conhecer as principais partes de uma ordenhadeira mecânica.',
    '10. O que é mastite? Quais medidas podem ser tomadas para prevenir a mastite?',
    '11. Apresentar um relatório destacando os principais problemas de saúde que atingem o gado leiteiro, apontando os sintomas e sinais, bem como prevenir e/ou tratá-los.',
    '12. Conhecer o significado dos seguintes termos:',
    'a) Concentrados;',
    'b) Proteína bruta;',
    'c) Seleção;',
    'd) Período seco.',
    '13. Explicar a pasteurização do leite e os cuidados necessários com os utensílios e equipamentos usados nos laticínios.',
    '14. Apresentar um relatório escrito de, no mínimo, 300 palavras ou oral de 5 minutos sobre a importância da pecuária leiteira e referir suas principais características.',
    '15. Auxiliar no cuidado e ordenha de um rebanho de vacas leiteiras por um período de, pelo menos, 3 meses.',
    '16. Visitar uma propriedade rural onde se pratica a criação de gado leiteiro e elaborar um relatório de, pelo menos, 300 palavras destacando as principais atividades ali desenvolvidas, bem como sobre a sua experiência vivida para o cumprimento dos requisitos desta especialidade.'
  ]);

  -- AR-060 Skate: acrescenta a nota do instrutor antes do requisito 1
  SELECT * INTO em FROM public.especialidades_modelo WHERE programa_id = v_prog AND codigo = 'AR-060';
  IF NOT FOUND THEN RAISE EXCEPTION 'AR-060 nao encontrada.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mda_requisitos_modelo WHERE programa_id = v_prog AND item_tipo = 'Especialidade' AND especialidade_id = em.id AND texto LIKE 'Nota: Necess%') THEN
    SELECT COALESCE(MIN(ordem), 1) - 1 INTO v_ord FROM public.mda_requisitos_modelo
     WHERE programa_id = v_prog AND item_tipo = 'Especialidade' AND especialidade_id = em.id;
    INSERT INTO public.mda_requisitos_modelo (programa_id, item_tipo, item_nome, item_codigo, item_url, especialidade_id, secao, ordem, texto)
    VALUES (v_prog, 'Especialidade', em.nome, em.codigo, COALESCE(em.item_url, 'manual-2025/' || em.codigo), em.id, NULL, v_ord, 'Nota: Necessário o acompanhamento de um instrutor qualificado.');
    UPDATE public.especialidades_modelo SET quantidade_requisitos = COALESCE(quantidade_requisitos, 0) + 1, updated_at = now() WHERE id = em.id;
  END IF;
END
$$;
