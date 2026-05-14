-- Políticas RLS para storage.objects

-- ── fotos_membros (público) ──────────────────────────────────────
DROP POLICY IF EXISTS "leitura_publica_foto"          ON storage.objects;
DROP POLICY IF EXISTS "membro_envia_propria_foto"     ON storage.objects;
DROP POLICY IF EXISTS "membro_atualiza_propria_foto"  ON storage.objects;

CREATE POLICY "leitura_publica_foto"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fotos_membros');

CREATE POLICY "membro_envia_propria_foto"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fotos_membros' AND (
      EXISTS (
        SELECT 1 FROM public.usuarios
        WHERE id = auth.uid()
          AND perfil IN ('admin_geral','admin_diretoria')
      )
      OR
      (storage.foldername(name))[1] = (
        SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "membro_atualiza_propria_foto"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'fotos_membros' AND (
      EXISTS (
        SELECT 1 FROM public.usuarios
        WHERE id = auth.uid()
          AND perfil IN ('admin_geral','admin_diretoria')
      )
      OR
      (storage.foldername(name))[1] = (
        SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid()
      )
    )
  );

-- ── documentos_fotos (privado) ───────────────────────────────────
DROP POLICY IF EXISTS "doc_leitura_admin_ou_dono"  ON storage.objects;
DROP POLICY IF EXISTS "doc_upload_admin_ou_dono"   ON storage.objects;
DROP POLICY IF EXISTS "doc_update_admin_ou_dono"   ON storage.objects;
DROP POLICY IF EXISTS "doc_delete_somente_admin"   ON storage.objects;

CREATE POLICY "doc_leitura_admin_ou_dono"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documentos_fotos' AND (
      EXISTS (
        SELECT 1 FROM public.usuarios
        WHERE id = auth.uid()
          AND perfil IN ('admin_geral','admin_diretoria')
      )
      OR
      (storage.foldername(name))[1] = (
        SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "doc_upload_admin_ou_dono"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documentos_fotos' AND (
      EXISTS (
        SELECT 1 FROM public.usuarios
        WHERE id = auth.uid()
          AND perfil IN ('admin_geral','admin_diretoria')
      )
      OR
      (storage.foldername(name))[1] = (
        SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "doc_update_admin_ou_dono"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documentos_fotos' AND (
      EXISTS (
        SELECT 1 FROM public.usuarios
        WHERE id = auth.uid()
          AND perfil IN ('admin_geral','admin_diretoria')
      )
      OR
      (storage.foldername(name))[1] = (
        SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "doc_delete_somente_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documentos_fotos' AND
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
        AND perfil IN ('admin_geral','admin_diretoria')
    )
  );
