-- Alinha as políticas de Storage com os perfis atuais do sistema.
-- Sem isto, o app pode gravar a linha no banco, mas falhar no upload/remocao
-- do arquivo no bucket, deixando anexos indisponiveis entre app e web.

CREATE OR REPLACE FUNCTION public.current_user_can_manage_member_photo(target_clube_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_can_manage_docs_clube(target_clube_id)
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = target_clube_id
      AND uc.ativo = TRUE
      AND uc.perfil IN ('usuario_diretoria', 'admin_diretoria')
  )
  OR EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.perfil IN ('usuario_diretoria', 'admin_diretoria')
  )
$$;

DROP POLICY IF EXISTS "leitura_publica_foto" ON storage.objects;
DROP POLICY IF EXISTS "membro_envia_propria_foto" ON storage.objects;
DROP POLICY IF EXISTS "membro_atualiza_propria_foto" ON storage.objects;
DROP POLICY IF EXISTS "foto_membros_select_public" ON storage.objects;
DROP POLICY IF EXISTS "foto_membros_insert_permissoes_clube" ON storage.objects;
DROP POLICY IF EXISTS "foto_membros_update_permissoes_clube" ON storage.objects;
DROP POLICY IF EXISTS "foto_membros_delete_permissoes_clube" ON storage.objects;

CREATE POLICY "foto_membros_select_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'fotos_membros');

CREATE POLICY "foto_membros_insert_permissoes_clube"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fotos_membros'
  AND COALESCE((storage.foldername(name))[1], '') ~ '^[0-9]+$'
  AND public.current_user_can_manage_member_photo(
    COALESCE((SELECT d.clube_id FROM public.desbravadores d WHERE d.id::text = (storage.foldername(name))[1]), 1)
  )
);

CREATE POLICY "foto_membros_update_permissoes_clube"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fotos_membros'
  AND COALESCE((storage.foldername(name))[1], '') ~ '^[0-9]+$'
  AND public.current_user_can_manage_member_photo(
    COALESCE((SELECT d.clube_id FROM public.desbravadores d WHERE d.id::text = (storage.foldername(name))[1]), 1)
  )
)
WITH CHECK (
  bucket_id = 'fotos_membros'
  AND COALESCE((storage.foldername(name))[1], '') ~ '^[0-9]+$'
  AND public.current_user_can_manage_member_photo(
    COALESCE((SELECT d.clube_id FROM public.desbravadores d WHERE d.id::text = (storage.foldername(name))[1]), 1)
  )
);

CREATE POLICY "foto_membros_delete_permissoes_clube"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'fotos_membros'
  AND COALESCE((storage.foldername(name))[1], '') ~ '^[0-9]+$'
  AND public.current_user_can_manage_member_photo(
    COALESCE((SELECT d.clube_id FROM public.desbravadores d WHERE d.id::text = (storage.foldername(name))[1]), 1)
  )
);

DROP POLICY IF EXISTS "doc_delete_permissoes_clube" ON storage.objects;

CREATE POLICY "doc_delete_permissoes_clube"
ON storage.objects
FOR DELETE
TO authenticated
USING (
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
