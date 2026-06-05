-- Corrige permissões dos anexos privados de documentos.
-- Admin TI, admin clube, diretoria e secretaria podem abrir/gerenciar anexos.
-- Pais/responsáveis continuam restritos aos filhos vinculados.
-- Conselheiros seguem vendo pendências/status, mas não os arquivos.

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
      AND uc.perfil IN (
        'admin_ti',
        'admin_clube',
        'admin_total',
        'admin_geral',
        'usuario_secretaria'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.perfil IN (
        'admin_ti',
        'admin_clube',
        'admin_total',
        'admin_geral',
        'usuario_secretaria'
      )
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
  AND COALESCE((storage.foldername(name))[1], '') ~ '^[0-9]+$'
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
  AND COALESCE((storage.foldername(name))[1], '') ~ '^[0-9]+$'
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
  AND COALESCE((storage.foldername(name))[1], '') ~ '^[0-9]+$'
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
  AND COALESCE((storage.foldername(name))[1], '') ~ '^[0-9]+$'
  AND public.current_user_can_manage_docs_clube(
    COALESCE((SELECT d.clube_id FROM public.desbravadores d WHERE d.id::text = (storage.foldername(name))[1]), 1)
  )
);
