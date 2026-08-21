-- Autoatendimento (16+), edição por responsável (pais) e por conselheiro da
-- própria unidade, mais o novo perfil "usuario_instrutor".
--
-- Estratégia: só ADICIONA políticas novas, nunca substitui as existentes —
-- políticas RLS permissivas se somam (OR), então isto amplia o acesso sem
-- arriscar quebrar os fluxos de admin/secretaria já em produção.

-- 1) Perfil "Instrutor" ------------------------------------------------------
ALTER TABLE IF EXISTS public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_perfil_check;
ALTER TABLE IF EXISTS public.usuarios
  ADD CONSTRAINT usuarios_perfil_check
  CHECK (
    perfil IN (
      'admin_total', 'admin_geral', 'admin_diretoria', 'desbravador',
      'admin_ti', 'admin_clube', 'usuario_secretaria', 'usuario_tesouraria',
      'usuario_conselheiro', 'usuario_instrutor', 'usuario_diretoria', 'usuario_desbravador',
      'usuario_aventureiro', 'usuario_regional', 'usuario_distrital',
      'usuario_pastor', 'usuario_capelao', 'usuario_pais'
    )
  );

INSERT INTO public.perfis_acesso (codigo, nome, descricao, escopo, ordem, permissoes)
VALUES
  ('usuario_instrutor', 'Instrutor(a)', 'Acompanha pontuação e atividades como o conselheiro, mas só edita a própria ficha.', 'unidade', 31, '{"unidade": "acompanhar"}'::jsonb)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    escopo = EXCLUDED.escopo,
    ordem = EXCLUDED.ordem,
    ativo = TRUE,
    permissoes = EXCLUDED.permissoes;

-- is_admin() ganha o mesmo tratamento do conselheiro (usado por várias telas
-- de acompanhamento/validação de classes e especialidades).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_perfil(), '') IN (
    'admin_total', 'admin_geral', 'admin_diretoria',
    'admin_ti', 'admin_clube', 'usuario_diretoria',
    'usuario_secretaria', 'usuario_conselheiro', 'usuario_instrutor'
  )
  OR public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.ativo = TRUE
      AND uc.perfil IN (
        'admin_ti', 'admin_clube', 'usuario_diretoria',
        'usuario_secretaria', 'usuario_conselheiro', 'usuario_instrutor'
      )
  )
$$;

-- 2) Quem pode editar a ficha básica de um membro (fora do fluxo de admin) --
-- Cobre: o próprio membro (o app também trava isso para 16+ na tela), o
-- responsável pelo filho vinculado, e o conselheiro da MESMA unidade do
-- membro. Instrutor fica de fora de propósito: só edita a própria ficha
-- (já coberto pelo primeiro caso, current_user_dbv_id()).
CREATE OR REPLACE FUNCTION public.current_user_pode_editar_ficha_basica(target_membro_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    target_membro_id = public.current_user_dbv_id()
    OR EXISTS (
      SELECT 1 FROM public.responsavel_membros rm
      WHERE rm.usuario_id = auth.uid()
        AND rm.membro_id = target_membro_id
        AND rm.ativo = TRUE
        AND rm.pode_enviar_documentos = TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM public.desbravadores d
      JOIN public.usuario_clubes uc ON uc.clube_id = d.clube_id
      WHERE d.id = target_membro_id
        AND uc.usuario_id = auth.uid()
        AND uc.ativo = TRUE
        AND uc.perfil = 'usuario_conselheiro'
        AND uc.unidade_id IS NOT NULL
        AND uc.unidade_id = d.unidade_id
    )
$$;

-- desbravadores: soma a permissão de UPDATE acima da já existente (a
-- autoedição da própria linha já valia via "dbv_update_own_photo" — isto
-- soma responsável e conselheiro da mesma unidade, sem tirar nada).
DROP POLICY IF EXISTS "ficha_update_responsavel_ou_conselheiro" ON public.desbravadores;
CREATE POLICY "ficha_update_responsavel_ou_conselheiro"
ON public.desbravadores FOR UPDATE
USING (public.current_user_pode_editar_ficha_basica(id))
WITH CHECK (public.current_user_pode_editar_ficha_basica(id));

-- documento_imagens / documento_status: mesma soma, agora incluindo a foto
-- (a política antiga bloqueava `campo = 'foto'` para o responsável — ela
-- continua valendo, mas esta nova política adicional libera a foto também).
DROP POLICY IF EXISTS "documento_imagens_ficha_basica" ON public.documento_imagens;
CREATE POLICY "documento_imagens_ficha_basica"
ON public.documento_imagens FOR ALL
TO authenticated
USING (public.current_user_pode_editar_ficha_basica(dbv_id))
WITH CHECK (public.current_user_pode_editar_ficha_basica(dbv_id));

DROP POLICY IF EXISTS "documento_status_ficha_basica" ON public.documento_status;
CREATE POLICY "documento_status_ficha_basica"
ON public.documento_status FOR ALL
TO authenticated
USING (public.current_user_pode_editar_ficha_basica(dbv_id))
WITH CHECK (public.current_user_pode_editar_ficha_basica(dbv_id));

-- 3) Storage do bucket fotos_membros: mesma regra, lendo o dbv_id do nome da
-- pasta (upload sempre grava em "<dbv_id>/arquivo.ext").
CREATE OR REPLACE FUNCTION public.current_user_pode_gerenciar_foto_arquivo(name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((storage.foldername(name))[1], '') ~ '^[0-9]+$'
    AND public.current_user_pode_editar_ficha_basica(((storage.foldername(name))[1])::integer)
$$;

DROP POLICY IF EXISTS "foto_membros_insert_ficha_basica" ON storage.objects;
CREATE POLICY "foto_membros_insert_ficha_basica"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fotos_membros' AND public.current_user_pode_gerenciar_foto_arquivo(name));

DROP POLICY IF EXISTS "foto_membros_update_ficha_basica" ON storage.objects;
CREATE POLICY "foto_membros_update_ficha_basica"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'fotos_membros' AND public.current_user_pode_gerenciar_foto_arquivo(name))
WITH CHECK (bucket_id = 'fotos_membros' AND public.current_user_pode_gerenciar_foto_arquivo(name));

DROP POLICY IF EXISTS "foto_membros_delete_ficha_basica" ON storage.objects;
CREATE POLICY "foto_membros_delete_ficha_basica"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fotos_membros' AND public.current_user_pode_gerenciar_foto_arquivo(name));

-- 4) Senha de login: além de admin_ti/admin_clube/secretaria (que já podiam
-- mudar tudo), agora o próprio usuário, o responsável pelo filho e o
-- conselheiro da mesma unidade também podem trocar a SENHA do login
-- vinculado ao membro — nunca o e-mail, perfil ou vínculos, que continuam
-- exclusivos do admin.
CREATE OR REPLACE FUNCTION public.atualizar_login_membro(
  target_user_id uuid,
  novo_email text DEFAULT NULL,
  nova_senha text DEFAULT NULL,
  novo_nome text DEFAULT NULL,
  novo_perfil text DEFAULT NULL,
  novo_dbv_id integer DEFAULT NULL,
  novo_unidade_id integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  pode_admin boolean;
  pode_so_senha boolean;
  email_final text;
  senha_final text;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido.';
  END IF;

  SELECT public.current_user_is_admin_ti()
    OR EXISTS (
      SELECT 1
      FROM public.usuario_clubes uc
      WHERE uc.usuario_id = auth.uid()
        AND uc.ativo = TRUE
        AND uc.perfil IN ('admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria')
    )
  INTO pode_admin;

  IF NOT COALESCE(pode_admin, false) THEN
    SELECT
      target_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.usuarios u_alvo
        JOIN public.responsavel_membros rm ON rm.membro_id = u_alvo.dbv_id
        WHERE u_alvo.id = target_user_id
          AND rm.usuario_id = auth.uid()
          AND rm.ativo = TRUE
          AND rm.pode_enviar_documentos = TRUE
      )
      OR EXISTS (
        SELECT 1
        FROM public.usuarios u_alvo
        JOIN public.desbravadores d ON d.id = u_alvo.dbv_id
        JOIN public.usuario_clubes uc ON uc.clube_id = d.clube_id
        WHERE u_alvo.id = target_user_id
          AND uc.usuario_id = auth.uid()
          AND uc.ativo = TRUE
          AND uc.perfil = 'usuario_conselheiro'
          AND uc.unidade_id IS NOT NULL
          AND uc.unidade_id = d.unidade_id
      )
    INTO pode_so_senha;
  END IF;

  IF NOT COALESCE(pode_admin, false) AND NOT COALESCE(pode_so_senha, false) THEN
    RAISE EXCEPTION 'Apenas admin_ti/admin_clube pode alterar credenciais de login.';
  END IF;

  senha_final := NULLIF(trim(nova_senha), '');

  IF NOT COALESCE(pode_admin, false) THEN
    -- Fora do admin: só a senha muda. E-mail, perfil e vínculos ficam intocados.
    IF senha_final IS NULL THEN
      RAISE EXCEPTION 'Informe a nova senha.';
    END IF;
    IF length(senha_final) < 6 THEN
      RAISE EXCEPTION 'A senha precisa ter pelo menos 6 caracteres.';
    END IF;

    UPDATE auth.users
       SET encrypted_password = crypt(senha_final, gen_salt('bf')),
           updated_at = now()
     WHERE id = target_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Usuário de autenticação não encontrado.';
    END IF;
    RETURN;
  END IF;

  email_final := NULLIF(lower(trim(novo_email)), '');

  IF email_final IS NOT NULL
     AND EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = email_final AND id <> target_user_id) THEN
    RAISE EXCEPTION 'Já existe outro usuário com este e-mail.';
  END IF;

  IF senha_final IS NOT NULL AND length(senha_final) < 6 THEN
    RAISE EXCEPTION 'A senha precisa ter pelo menos 6 caracteres.';
  END IF;

  UPDATE auth.users
     SET email = COALESCE(email_final, email),
         encrypted_password = CASE
           WHEN senha_final IS NOT NULL THEN crypt(senha_final, gen_salt('bf'))
           ELSE encrypted_password
         END,
         email_confirmed_at = COALESCE(email_confirmed_at, now()),
         confirmation_token = '',
         recovery_token = '',
         raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
           || jsonb_strip_nulls(jsonb_build_object(
             'nome', NULLIF(trim(novo_nome), ''),
             'perfil', novo_perfil,
             'dbv_id', novo_dbv_id,
             'unidade_id', novo_unidade_id
           )),
         updated_at = now()
   WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário de autenticação não encontrado.';
  END IF;

  UPDATE public.usuarios
     SET email = COALESCE(email_final, email),
         nome = COALESCE(NULLIF(trim(novo_nome), ''), nome),
         perfil = COALESCE(novo_perfil, perfil),
         dbv_id = COALESCE(novo_dbv_id, dbv_id),
         unidade_id = COALESCE(novo_unidade_id, unidade_id)
   WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_login_membro(uuid, text, text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atualizar_login_membro(uuid, text, text, text, text, integer, integer) TO authenticated;
