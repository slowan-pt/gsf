-- Backfill: os gatilhos de 059_classes_requisitos.sql (sync_requisitos_por_especialidade
-- e sync_especialidade_por_requisito) só disparam em INSERT/UPDATE novos —
-- membros que já tinham a especialidade ou o requisito marcados ANTES desses
-- gatilhos existirem (ou quando o gatilho não disparou por algum motivo)
-- ficaram com ficha/classe fora de sincronia. Ex.: Ágatha já tinha
-- "Acampamento 1" em especialidades, mas o requisito correspondente em
-- Amigo continuava desmarcado.
--
-- Este arquivo roda a MESMA lógica dos gatilhos, uma vez, sobre os dados que
-- já existem — sem mexer na estrutura, só preenchendo o que ficou pra trás.

-- 1) especialidade concluída -> marca o requisito (e o requisito-raiz) correspondente.
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
WHERE e.status = 'OK'
  AND e.clube_id IS NOT NULL
ON CONFLICT (clube_id, dbv_id, requisito_id) DO UPDATE
  SET concluido = TRUE,
      origem = CASE WHEN classes_requisitos_progresso.origem = 'manual'
                    THEN classes_requisitos_progresso.origem
                    ELSE 'especialidade' END,
      updated_at = now();

-- 2) requisito de especialidade já marcado -> garante a especialidade na ficha.
INSERT INTO public.especialidades (clube_id, dbv_id, nome, status, updated_at)
SELECT DISTINCT p.clube_id, p.dbv_id, c.especialidade_nome, 'OK', now()
FROM public.classes_requisitos_progresso p
JOIN public.classes_requisitos_catalogo c ON c.id = p.requisito_id
WHERE p.concluido = TRUE
  AND c.especialidade_nome IS NOT NULL
  AND btrim(c.especialidade_nome) <> ''
ON CONFLICT (dbv_id, nome) DO UPDATE
  SET status = 'OK', updated_at = now();
