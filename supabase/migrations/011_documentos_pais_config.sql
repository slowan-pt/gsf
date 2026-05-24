-- Janela de edicao de documentos pelos responsaveis
-- Permite que o clube abra periodos em que pais/responsaveis podem anexar
-- ou remover documentos dos filhos vinculados.

CREATE TABLE IF NOT EXISTS public.documentos_pais_config (
  clube_id INTEGER PRIMARY KEY REFERENCES public.clubes(id) ON DELETE CASCADE,
  pais_podem_editar BOOLEAN NOT NULL DEFAULT FALSE,
  editar_de DATE,
  editar_ate DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documentos_pais_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documentos_pais_config_select_contexto" ON public.documentos_pais_config;
DROP POLICY IF EXISTS "documentos_pais_config_admin_all" ON public.documentos_pais_config;

CREATE POLICY "documentos_pais_config_select_contexto"
ON public.documentos_pais_config
FOR SELECT
TO authenticated
USING (
  public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = documentos_pais_config.clube_id
      AND uc.ativo = TRUE
  )
  OR EXISTS (
    SELECT 1
    FROM public.responsavel_membros rm
    WHERE rm.usuario_id = auth.uid()
      AND rm.clube_id = documentos_pais_config.clube_id
      AND rm.ativo = TRUE
  )
);

CREATE POLICY "documentos_pais_config_admin_all"
ON public.documentos_pais_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = documentos_pais_config.clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_ti', 'admin_clube', 'usuario_secretaria')
  )
)
WITH CHECK (
  public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = documentos_pais_config.clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('admin_ti', 'admin_clube', 'usuario_secretaria')
  )
);

INSERT INTO public.documentos_pais_config (clube_id, pais_podem_editar)
SELECT id, FALSE
FROM public.clubes
ON CONFLICT (clube_id) DO NOTHING;

-- Helpers especificos para documentos. Mantem conselheiros fora dos anexos:
-- eles podem acompanhar pendencias pela interface, mas nao abrem arquivos.
CREATE OR REPLACE FUNCTION public.current_user_can_manage_docs_clube(target_clube_id INTEGER)
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
      AND uc.perfil IN ('admin_ti', 'admin_clube', 'usuario_secretaria', 'usuario_diretoria')
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_parent_edit_docs(
  target_clube_id INTEGER,
  target_membro_id INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.responsavel_membros rm
    JOIN public.documentos_pais_config cfg ON cfg.clube_id = rm.clube_id
    WHERE rm.usuario_id = auth.uid()
      AND rm.clube_id = target_clube_id
      AND rm.membro_id = target_membro_id
      AND rm.ativo = TRUE
      AND rm.pode_enviar_documentos = TRUE
      AND cfg.pais_podem_editar = TRUE
      AND (cfg.editar_de IS NULL OR CURRENT_DATE >= cfg.editar_de)
      AND (cfg.editar_ate IS NULL OR CURRENT_DATE <= cfg.editar_ate)
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_view_doc_files(
  target_clube_id INTEGER,
  target_membro_id INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_can_manage_docs_clube(target_clube_id)
  OR target_membro_id = public.current_user_dbv_id()
  OR EXISTS (
    SELECT 1
    FROM public.responsavel_membros rm
    WHERE rm.usuario_id = auth.uid()
      AND rm.clube_id = target_clube_id
      AND rm.membro_id = target_membro_id
      AND rm.ativo = TRUE
      AND rm.pode_visualizar = TRUE
  )
$$;

-- Regras nos registros de documentos/anexos.
DROP POLICY IF EXISTS "admin_or_owner_select_documento_imagens" ON public.documento_imagens;
DROP POLICY IF EXISTS "admin_or_owner_all_documento_imagens" ON public.documento_imagens;
DROP POLICY IF EXISTS "documento_imagens_select_docs_permissions" ON public.documento_imagens;
DROP POLICY IF EXISTS "documento_imagens_write_docs_permissions" ON public.documento_imagens;

CREATE POLICY "documento_imagens_select_docs_permissions"
ON public.documento_imagens
FOR SELECT
TO authenticated
USING (public.current_user_can_view_doc_files(clube_id, dbv_id));

CREATE POLICY "documento_imagens_write_docs_permissions"
ON public.documento_imagens
FOR ALL
TO authenticated
USING (
  public.current_user_can_manage_docs_clube(clube_id)
  OR (
    campo <> 'foto'
    AND public.current_user_can_parent_edit_docs(clube_id, dbv_id)
  )
)
WITH CHECK (
  public.current_user_can_manage_docs_clube(clube_id)
  OR (
    campo <> 'foto'
    AND public.current_user_can_parent_edit_docs(clube_id, dbv_id)
  )
);

DROP POLICY IF EXISTS "admin_or_owner_select_documento_status" ON public.documento_status;
DROP POLICY IF EXISTS "admin_or_owner_all_documento_status" ON public.documento_status;
DROP POLICY IF EXISTS "documento_status_select_clube" ON public.documento_status;
DROP POLICY IF EXISTS "documento_status_write_docs_permissions" ON public.documento_status;

CREATE POLICY "documento_status_select_clube"
ON public.documento_status
FOR SELECT
TO authenticated
USING (public.current_user_has_clube(clube_id) OR public.current_user_is_responsavel_membro(dbv_id));

CREATE POLICY "documento_status_write_docs_permissions"
ON public.documento_status
FOR ALL
TO authenticated
USING (
  public.current_user_can_manage_docs_clube(clube_id)
  OR public.current_user_can_parent_edit_docs(clube_id, dbv_id)
)
WITH CHECK (
  public.current_user_can_manage_docs_clube(clube_id)
  OR public.current_user_can_parent_edit_docs(clube_id, dbv_id)
);

DROP POLICY IF EXISTS "admin_or_owner_update_documentos" ON public.documentos;
DROP POLICY IF EXISTS "admin_or_owner_write_documentos" ON public.documentos;

CREATE POLICY "admin_or_owner_write_documentos"
ON public.documentos
FOR UPDATE
TO authenticated
USING (
  public.current_user_can_manage_docs_clube(clube_id)
  OR public.current_user_can_parent_edit_docs(clube_id, dbv_id)
)
WITH CHECK (
  public.current_user_can_manage_docs_clube(clube_id)
  OR public.current_user_can_parent_edit_docs(clube_id, dbv_id)
);

-- Regras no bucket privado documentos_fotos.
DROP POLICY IF EXISTS "doc_leitura_admin_ou_dono" ON storage.objects;
DROP POLICY IF EXISTS "doc_upload_admin_ou_dono" ON storage.objects;
DROP POLICY IF EXISTS "doc_update_admin_ou_dono" ON storage.objects;
DROP POLICY IF EXISTS "doc_delete_somente_admin" ON storage.objects;
DROP POLICY IF EXISTS "doc_leitura_permissoes_clube" ON storage.objects;
DROP POLICY IF EXISTS "doc_upload_permissoes_clube" ON storage.objects;
DROP POLICY IF EXISTS "doc_update_permissoes_clube" ON storage.objects;
DROP POLICY IF EXISTS "doc_delete_permissoes_clube" ON storage.objects;

CREATE POLICY "doc_leitura_permissoes_clube"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos_fotos'
  AND public.current_user_can_view_doc_files(
    COALESCE((SELECT d.clube_id FROM public.desbravadores d WHERE d.id::text = (storage.foldername(name))[1]), 1),
    ((storage.foldername(name))[1])::integer
  )
);

CREATE POLICY "doc_upload_permissoes_clube"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos_fotos'
  AND (
    public.current_user_can_manage_docs_clube(
      COALESCE((SELECT d.clube_id FROM public.desbravadores d WHERE d.id::text = (storage.foldername(name))[1]), 1)
    )
    OR public.current_user_can_parent_edit_docs(
      COALESCE((SELECT d.clube_id FROM public.desbravadores d WHERE d.id::text = (storage.foldername(name))[1]), 1),
      ((storage.foldername(name))[1])::integer
    )
  )
);

CREATE POLICY "doc_update_permissoes_clube"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos_fotos'
  AND public.current_user_can_manage_docs_clube(
    COALESCE((SELECT d.clube_id FROM public.desbravadores d WHERE d.id::text = (storage.foldername(name))[1]), 1)
  )
);

CREATE POLICY "doc_delete_permissoes_clube"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos_fotos'
  AND public.current_user_can_manage_docs_clube(
    COALESCE((SELECT d.clube_id FROM public.desbravadores d WHERE d.id::text = (storage.foldername(name))[1]), 1)
  )
);
