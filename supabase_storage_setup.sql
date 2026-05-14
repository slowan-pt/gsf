-- ============================================================
-- EXECUTE ESTE SCRIPT NO SUPABASE SQL EDITOR
-- Dashboard → SQL Editor → New Query → Cole e Execute
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. BUCKET: fotos_membros (público para leitura)
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos_membros',
  'fotos_membros',
  true,   -- público: qualquer um pode VER as fotos de perfil
  5242880, -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Qualquer autenticado pode fazer upload da própria foto
-- Caminho esperado: {dbv_id}/perfil_timestamp.jpg
CREATE POLICY "membro_envia_propria_foto"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fotos_membros' AND
  (
    -- Admin pode enviar foto de qualquer membro
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil IN ('admin_geral', 'admin_diretoria'))
    OR
    -- Membro envia sua própria (caminho começa com seu dbv_id)
    (storage.foldername(name))[1] = (
      SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  )
);

-- Qualquer autenticado pode substituir (upsert) foto
CREATE POLICY "membro_atualiza_propria_foto"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fotos_membros' AND
  (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil IN ('admin_geral', 'admin_diretoria'))
    OR
    (storage.foldername(name))[1] = (
      SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  )
);

-- Leitura pública (bucket já é public, mas explicitando)
CREATE POLICY "leitura_publica_foto"
ON storage.objects FOR SELECT
USING (bucket_id = 'fotos_membros');


-- ────────────────────────────────────────────────────────────
-- 2. BUCKET: documentos_fotos (PRIVADO – somente dono e admins)
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos_fotos',
  'documentos_fotos',
  false,   -- PRIVADO: nunca acessível publicamente
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Upload: só admin ou o próprio membro
-- Caminho esperado: {dbv_id}/{campo}_timestamp.jpg
CREATE POLICY "doc_upload_admin_ou_dono"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos_fotos' AND
  (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil IN ('admin_geral', 'admin_diretoria'))
    OR
    (storage.foldername(name))[1] = (
      SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  )
);

-- Leitura: só admin ou o próprio membro
CREATE POLICY "doc_leitura_admin_ou_dono"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos_fotos' AND
  (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil IN ('admin_geral', 'admin_diretoria'))
    OR
    (storage.foldername(name))[1] = (
      SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  )
);

-- Atualização: só admin ou o próprio membro
CREATE POLICY "doc_update_admin_ou_dono"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos_fotos' AND
  (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil IN ('admin_geral', 'admin_diretoria'))
    OR
    (storage.foldername(name))[1] = (
      SELECT dbv_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  )
);

-- Exclusão: só admin
CREATE POLICY "doc_delete_somente_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos_fotos' AND
  EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND perfil IN ('admin_geral', 'admin_diretoria'))
);

-- ────────────────────────────────────────────────────────────
-- 3. Coluna dbv_id na tabela usuarios (se não existir)
--    Necessária para vincular o usuário ao desbravador
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS dbv_id INTEGER REFERENCES desbravadores(id);

-- Preencha manualmente ou via script:
-- UPDATE public.usuarios SET dbv_id = <ID_DO_DBV> WHERE email = 'fulano@email.com';
