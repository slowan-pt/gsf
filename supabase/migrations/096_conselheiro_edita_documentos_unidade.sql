-- Conselheiro passa a poder editar/enviar os anexos de documentos (RG, CPF,
-- cartao SUS etc.) dos proprios dados e dos desbravadores da SUA unidade —
-- antes so admin_ti/admin_clube/secretaria e o responsavel podiam.
--
-- A migracao 080 ja tinha ampliado document_imagens/documento_status pra
-- isso via current_user_pode_editar_ficha_basica(), mas faltou estender a
-- tabela `documentos` (campos rg/cpf/etc em texto) e o bucket de storage
-- `documentos_fotos` (os arquivos de verdade) — sem isso o botao ate
-- apareceria no app, mas o RLS bloqueava o salvamento.
--
-- Estrategia igual a 080: SOMA uma politica nova, nunca substitui as
-- existentes (RLS permissiva soma com OR), entao isto amplia acesso sem
-- arriscar quebrar o fluxo de admin/secretaria/responsavel ja em producao.

DROP POLICY IF EXISTS "documentos_ficha_basica" ON public.documentos;
CREATE POLICY "documentos_ficha_basica"
ON public.documentos FOR ALL
TO authenticated
USING (public.current_user_pode_editar_ficha_basica(dbv_id))
WITH CHECK (public.current_user_pode_editar_ficha_basica(dbv_id));

-- Storage do bucket documentos_fotos: mesma regra, lendo o dbv_id do nome da
-- pasta (upload sempre grava em "<dbv_id>/arquivo.ext"), igual ao que a 080
-- ja fez pro bucket fotos_membros. Delete continua exclusivo do admin —
-- ninguem pediu ampliar isso, e e mais seguro manter restrito.
DROP POLICY IF EXISTS "doc_leitura_ficha_basica" ON storage.objects;
CREATE POLICY "doc_leitura_ficha_basica"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos_fotos'
  AND COALESCE((storage.foldername(name))[1], '') ~ '^[0-9]+$'
  AND public.current_user_pode_editar_ficha_basica(((storage.foldername(name))[1])::integer)
);

DROP POLICY IF EXISTS "doc_upload_ficha_basica" ON storage.objects;
CREATE POLICY "doc_upload_ficha_basica"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos_fotos'
  AND COALESCE((storage.foldername(name))[1], '') ~ '^[0-9]+$'
  AND public.current_user_pode_editar_ficha_basica(((storage.foldername(name))[1])::integer)
);

DROP POLICY IF EXISTS "doc_update_ficha_basica" ON storage.objects;
CREATE POLICY "doc_update_ficha_basica"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos_fotos'
  AND COALESCE((storage.foldername(name))[1], '') ~ '^[0-9]+$'
  AND public.current_user_pode_editar_ficha_basica(((storage.foldername(name))[1])::integer)
);
