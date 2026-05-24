-- Fluxo avançado de atividades:
-- - múltiplos alvos por atividade
-- - avaliador responsável
-- - resposta com status, nota e comentários de avaliação

ALTER TABLE IF EXISTS public.atividades
  ADD COLUMN IF NOT EXISTS avaliador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS avaliador_nome text;

CREATE TABLE IF NOT EXISTS public.atividades_alvos (
  id bigserial PRIMARY KEY,
  clube_id integer NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  atividade_id bigint NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('todos', 'unidade', 'membro')),
  unidade_id integer REFERENCES public.unidades(id) ON DELETE CASCADE,
  membro_id integer REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CHECK (
    (tipo = 'todos' AND unidade_id IS NULL AND membro_id IS NULL)
    OR (tipo = 'unidade' AND unidade_id IS NOT NULL AND membro_id IS NULL)
    OR (tipo = 'membro' AND unidade_id IS NULL AND membro_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_atividades_alvos_clube ON public.atividades_alvos(clube_id);
CREATE INDEX IF NOT EXISTS idx_atividades_alvos_atividade ON public.atividades_alvos(atividade_id);
CREATE INDEX IF NOT EXISTS idx_atividades_alvos_unidade ON public.atividades_alvos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_atividades_alvos_membro ON public.atividades_alvos(membro_id);

-- Migra atividades antigas para o novo modelo de alvos.
INSERT INTO public.atividades_alvos (clube_id, atividade_id, tipo, unidade_id, membro_id)
SELECT COALESCE(a.clube_id, 1), a.id, 'todos', NULL, NULL
FROM public.atividades a
WHERE a.destino = 'todos'
  AND NOT EXISTS (
    SELECT 1 FROM public.atividades_alvos x WHERE x.atividade_id = a.id
  );

INSERT INTO public.atividades_alvos (clube_id, atividade_id, tipo, unidade_id, membro_id)
SELECT COALESCE(a.clube_id, 1), a.id, 'unidade', a.unidade_id, NULL
FROM public.atividades a
WHERE a.destino = 'unidade'
  AND a.unidade_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.atividades_alvos x WHERE x.atividade_id = a.id
  );

INSERT INTO public.atividades_alvos (clube_id, atividade_id, tipo, unidade_id, membro_id)
SELECT COALESCE(a.clube_id, 1), a.id, 'membro', NULL, a.dbv_id
FROM public.atividades a
WHERE a.destino = 'desbravador'
  AND a.dbv_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.atividades_alvos x WHERE x.atividade_id = a.id
  );

ALTER TABLE IF EXISTS public.atividades_respostas
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'entregue',
  ADD COLUMN IF NOT EXISTS nota numeric,
  ADD COLUMN IF NOT EXISTS comentario_avaliador text,
  ADD COLUMN IF NOT EXISTS avaliado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS avaliado_em timestamptz,
  ADD COLUMN IF NOT EXISTS entregue_em timestamptz;

DO $$
BEGIN
  ALTER TABLE public.atividades_respostas
    ADD CONSTRAINT atividades_respostas_status_check
    CHECK (status IN ('pendente', 'entregue', 'em_correcao', 'aprovada', 'recusada'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.atividades_respostas
SET entregue_em = COALESCE(entregue_em, created_at),
    status = COALESCE(NULLIF(status, ''), 'entregue')
WHERE entregue_em IS NULL OR status IS NULL OR status = '';

CREATE UNIQUE INDEX IF NOT EXISTS atividades_respostas_atividade_dbv_idx
  ON public.atividades_respostas(atividade_id, dbv_id);

CREATE OR REPLACE FUNCTION public.current_user_can_manage_atividades(target_clube_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = target_clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN (
        'admin_clube',
        'usuario_diretoria',
        'usuario_secretaria',
        'usuario_conselheiro',
        'usuario_capelao',
        'usuario_pastor'
      )
  )
$$;

ALTER TABLE public.atividades_alvos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atividades_alvos_select_contexto" ON public.atividades_alvos;
CREATE POLICY "atividades_alvos_select_contexto"
ON public.atividades_alvos
FOR SELECT
TO authenticated
USING (
  public.current_user_can_manage_atividades(clube_id)
  OR tipo = 'todos'
  OR (tipo = 'unidade' AND unidade_id = public.current_user_unidade_id())
  OR (tipo = 'membro' AND (membro_id = public.current_user_dbv_id() OR public.current_user_is_responsavel_membro(membro_id)))
);

DROP POLICY IF EXISTS "atividades_alvos_manage_contexto" ON public.atividades_alvos;
CREATE POLICY "atividades_alvos_manage_contexto"
ON public.atividades_alvos
FOR ALL
TO authenticated
USING (public.current_user_can_manage_atividades(clube_id))
WITH CHECK (public.current_user_can_manage_atividades(clube_id));

DROP POLICY IF EXISTS "atividades_select_by_target" ON public.atividades;
CREATE POLICY "atividades_select_by_target"
ON public.atividades
FOR SELECT
TO authenticated
USING (
  public.current_user_can_manage_atividades(COALESCE(clube_id, 1))
  OR EXISTS (
    SELECT 1
    FROM public.atividades_alvos al
    WHERE al.atividade_id = atividades.id
      AND (
        al.tipo = 'todos'
        OR (al.tipo = 'unidade' AND al.unidade_id = public.current_user_unidade_id())
        OR (al.tipo = 'membro' AND (al.membro_id = public.current_user_dbv_id() OR public.current_user_is_responsavel_membro(al.membro_id)))
      )
  )
);

DROP POLICY IF EXISTS "admin_all_atividades" ON public.atividades;
CREATE POLICY "admin_all_atividades"
ON public.atividades
FOR ALL
TO authenticated
USING (public.current_user_can_manage_atividades(COALESCE(clube_id, 1)))
WITH CHECK (clube_id IS NULL OR public.current_user_can_manage_atividades(clube_id));

DROP POLICY IF EXISTS "admin_all_atividades_anexos" ON public.atividades_anexos;
CREATE POLICY "admin_all_atividades_anexos"
ON public.atividades_anexos
FOR ALL
TO authenticated
USING (public.current_user_can_manage_atividades(COALESCE(clube_id, 1)))
WITH CHECK (clube_id IS NULL OR public.current_user_can_manage_atividades(clube_id));

DROP POLICY IF EXISTS "atividades_anexos_select_by_activity" ON public.atividades_anexos;
CREATE POLICY "atividades_anexos_select_by_activity"
ON public.atividades_anexos
FOR SELECT
TO authenticated
USING (
  public.current_user_can_manage_atividades(COALESCE(clube_id, 1))
  OR EXISTS (
    SELECT 1
    FROM public.atividades a
    JOIN public.atividades_alvos al ON al.atividade_id = a.id
    WHERE a.id = atividades_anexos.atividade_id
      AND (
        al.tipo = 'todos'
        OR (al.tipo = 'unidade' AND al.unidade_id = public.current_user_unidade_id())
        OR (al.tipo = 'membro' AND (al.membro_id = public.current_user_dbv_id() OR public.current_user_is_responsavel_membro(al.membro_id)))
      )
  )
);

DROP POLICY IF EXISTS "atividades_respostas_select" ON public.atividades_respostas;
CREATE POLICY "atividades_respostas_select"
ON public.atividades_respostas
FOR SELECT
TO authenticated
USING (
  public.current_user_can_manage_atividades(COALESCE(clube_id, 1))
  OR dbv_id = public.current_user_dbv_id()
  OR public.current_user_is_responsavel_membro(dbv_id)
);

DROP POLICY IF EXISTS "atividades_respostas_insert_own" ON public.atividades_respostas;
CREATE POLICY "atividades_respostas_insert_own"
ON public.atividades_respostas
FOR INSERT
TO authenticated
WITH CHECK (
  dbv_id = public.current_user_dbv_id()
  OR public.current_user_is_responsavel_membro(dbv_id)
  OR public.current_user_can_manage_atividades(COALESCE(clube_id, 1))
);

DROP POLICY IF EXISTS "atividades_respostas_update_own" ON public.atividades_respostas;
CREATE POLICY "atividades_respostas_update_own"
ON public.atividades_respostas
FOR UPDATE
TO authenticated
USING (
  dbv_id = public.current_user_dbv_id()
  OR public.current_user_is_responsavel_membro(dbv_id)
  OR public.current_user_can_manage_atividades(COALESCE(clube_id, 1))
)
WITH CHECK (
  dbv_id = public.current_user_dbv_id()
  OR public.current_user_is_responsavel_membro(dbv_id)
  OR public.current_user_can_manage_atividades(COALESCE(clube_id, 1))
);

DROP POLICY IF EXISTS "atividades_respostas_delete_admin_or_own" ON public.atividades_respostas;
CREATE POLICY "atividades_respostas_delete_admin_or_own"
ON public.atividades_respostas
FOR DELETE
TO authenticated
USING (
  dbv_id = public.current_user_dbv_id()
  OR public.current_user_is_responsavel_membro(dbv_id)
  OR public.current_user_can_manage_atividades(COALESCE(clube_id, 1))
);
