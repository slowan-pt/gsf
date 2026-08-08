-- Aplica as regras de cruzamento ao que ja existia no banco.
-- Deve rodar DEPOIS do seed 062 (que preenche especialidade_nome, idade_minima e documento_campo).

-- ---------------------------------------------------------------------------
-- Backfill: aplica as regras ao que ja existe no banco
-- ---------------------------------------------------------------------------

-- Especialidades ja concluidas marcam os requisitos correspondentes.
INSERT INTO public.classes_requisitos_progresso
  (clube_id, dbv_id, requisito_id, classe_nome, concluido, origem, concluido_em, updated_at)
SELECT DISTINCT e.clube_id, e.dbv_id, alvo.id, alvo.classe_nome, TRUE, 'especialidade', now(), now()
FROM public.especialidades e
JOIN public.classes_requisitos_catalogo c
  ON c.ativo = TRUE
 AND c.especialidade_nome IS NOT NULL
 AND lower(public.unaccent_simples(c.especialidade_nome)) = lower(public.unaccent_simples(e.nome))
JOIN public.classes_requisitos_catalogo alvo
  ON alvo.ativo = TRUE
 AND (
   alvo.id = c.id
   OR (alvo.classe_nome = c.classe_nome
       AND alvo.secao = c.secao
       AND alvo.codigo = c.codigo_raiz
       AND alvo.subitem IS NULL)
 )
WHERE e.status = 'OK' AND e.clube_id IS NOT NULL
ON CONFLICT (clube_id, dbv_id, requisito_id) DO NOTHING;

-- RG ja entregue na ficha marca o requisito de identidade e copia o arquivo.
INSERT INTO public.classes_requisitos_arquivos
  (clube_id, dbv_id, requisito_id, nome, url, tipo, origem)
SELECT DISTINCT di.clube_id, di.dbv_id, c.id, di.nome, di.url, COALESCE(di.tipo, 'outro'), 'documento'
FROM public.documento_imagens di
JOIN public.classes_requisitos_catalogo c
  ON c.ativo = TRUE
 AND c.documento_campo = 'rg'
 AND (c.idade_minima IS NULL OR public.idade_membro(di.dbv_id) >= c.idade_minima)
WHERE di.campo = 'rg'
  AND di.clube_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.classes_requisitos_arquivos a
    WHERE a.clube_id = di.clube_id AND a.dbv_id = di.dbv_id
      AND a.requisito_id = c.id AND a.url = di.url
  );

INSERT INTO public.classes_requisitos_progresso
  (clube_id, dbv_id, requisito_id, classe_nome, concluido, origem, concluido_em, updated_at)
SELECT DISTINCT di.clube_id, di.dbv_id, c.id, c.classe_nome, TRUE, 'manual', now(), now()
FROM public.documento_imagens di
JOIN public.classes_requisitos_catalogo c
  ON c.ativo = TRUE
 AND c.documento_campo = 'rg'
 AND (c.idade_minima IS NULL OR public.idade_membro(di.dbv_id) >= c.idade_minima)
WHERE di.campo = 'rg' AND di.clube_id IS NOT NULL
ON CONFLICT (clube_id, dbv_id, requisito_id) DO NOTHING;
