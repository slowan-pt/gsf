-- Políticas do bucket "logos_clube" (crie o bucket manualmente no painel do
-- Supabase antes de rodar isto: Storage -> New bucket -> nome "logos_clube",
-- marcado como Public). Caminho esperado dos arquivos: {clube_id}/logo_*.ext

DROP POLICY IF EXISTS "logo_clube_leitura_publica" ON storage.objects;
CREATE POLICY "logo_clube_leitura_publica"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos_clube');

DROP POLICY IF EXISTS "logo_clube_admin_upload" ON storage.objects;
CREATE POLICY "logo_clube_admin_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos_clube'
    AND public.current_user_can_admin_clube(NULLIF((storage.foldername(name))[1], '')::integer)
  );

DROP POLICY IF EXISTS "logo_clube_admin_update" ON storage.objects;
CREATE POLICY "logo_clube_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos_clube'
    AND public.current_user_can_admin_clube(NULLIF((storage.foldername(name))[1], '')::integer)
  );

DROP POLICY IF EXISTS "logo_clube_admin_delete" ON storage.objects;
CREATE POLICY "logo_clube_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos_clube'
    AND public.current_user_can_admin_clube(NULLIF((storage.foldername(name))[1], '')::integer)
  );
