-- Permite que o responsável (pai/mãe) tenha e edite a própria foto de perfil,
-- exibida na ficha do membro como indicação visual de que já existe
-- responsável vinculado.

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Reaproveita o bucket público "fotos_membros" (já usado pelas fotos dos
-- membros), guardando a foto do responsável em "responsaveis/{auth.uid()}/..."
-- em vez de "{dbv_id}/..." — por isso precisa de uma policy própria: as
-- policies de 079_fix_storage_sync_fotos_documentos.sql exigem que o primeiro
-- segmento da pasta seja um dbv_id numérico, o que não existe para um
-- responsável que só tem usuario_id (uuid).
DROP POLICY IF EXISTS "foto_responsavel_insert_propria" ON storage.objects;
DROP POLICY IF EXISTS "foto_responsavel_update_propria" ON storage.objects;
DROP POLICY IF EXISTS "foto_responsavel_delete_propria" ON storage.objects;

CREATE POLICY "foto_responsavel_insert_propria"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fotos_membros'
  AND (storage.foldername(name))[1] = 'responsaveis'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "foto_responsavel_update_propria"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fotos_membros'
  AND (storage.foldername(name))[1] = 'responsaveis'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'fotos_membros'
  AND (storage.foldername(name))[1] = 'responsaveis'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "foto_responsavel_delete_propria"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'fotos_membros'
  AND (storage.foldername(name))[1] = 'responsaveis'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
