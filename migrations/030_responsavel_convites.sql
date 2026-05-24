-- ============================================================
-- MIGRATION 030: Sistema de convites para responsáveis externos
-- Execute este SQL no dashboard do Supabase (SQL Editor)
-- ============================================================

-- 1. Tabela de convites pendentes
CREATE TABLE IF NOT EXISTS responsavel_convites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  email       TEXT        NOT NULL,
  membro_id   INTEGER     NOT NULL,
  clube_id    INTEGER     NOT NULL,
  programa_id INTEGER     NOT NULL,
  parentesco  TEXT,
  criado_por  UUID,
  usado       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE responsavel_convites ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ler (necessário para processar o convite após login)
DROP POLICY IF EXISTS "responsavel_convites_select" ON responsavel_convites;
CREATE POLICY "responsavel_convites_select" ON responsavel_convites
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admins do clube podem inserir convites
DROP POLICY IF EXISTS "responsavel_convites_insert" ON responsavel_convites;
CREATE POLICY "responsavel_convites_insert" ON responsavel_convites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuario_clubes uc
      WHERE uc.usuario_id = auth.uid()
        AND uc.clube_id = responsavel_convites.clube_id
        AND uc.perfil IN ('admin_ti','admin_clube','usuario_secretaria','usuario_diretoria')
        AND uc.ativo = true
    )
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.perfil IN ('admin_ti','admin_clube')
    )
  );

-- Qualquer autenticado pode atualizar (para marcar como usado via RPC)
DROP POLICY IF EXISTS "responsavel_convites_update" ON responsavel_convites;
CREATE POLICY "responsavel_convites_update" ON responsavel_convites
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Admins podem deletar
DROP POLICY IF EXISTS "responsavel_convites_delete" ON responsavel_convites;
CREATE POLICY "responsavel_convites_delete" ON responsavel_convites
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM usuario_clubes uc
      WHERE uc.usuario_id = auth.uid()
        AND uc.clube_id = responsavel_convites.clube_id
        AND uc.perfil IN ('admin_ti','admin_clube','usuario_secretaria','usuario_diretoria')
        AND uc.ativo = true
    )
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.perfil IN ('admin_ti','admin_clube')
    )
  );

-- 2. Stored procedure para aceitar convite (SECURITY DEFINER bypassa RLS)
CREATE OR REPLACE FUNCTION aceitar_convite_responsavel(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_convite  responsavel_convites%ROWTYPE;
  v_user_id  UUID;
  v_email    TEXT;
  v_exist_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_convite FROM responsavel_convites
  WHERE token = p_token AND NOT usado;

  IF NOT FOUND THEN
    -- Convite já usado: verifica se já está vinculado (re-login com convite antigo)
    SELECT * INTO v_convite FROM responsavel_convites WHERE token = p_token AND usado;
    IF FOUND THEN
      RETURN json_build_object('success', true, 'membro_id', v_convite.membro_id, 'ja_vinculado', true);
    END IF;
    RETURN json_build_object('error', 'invalid_token');
  END IF;

  IF LOWER(v_convite.email) != LOWER(v_email) THEN
    RETURN json_build_object('error', 'email_mismatch', 'esperado', v_convite.email);
  END IF;

  -- Verifica se já existe vínculo (ativo ou inativo)
  SELECT id INTO v_exist_id FROM responsavel_membros
  WHERE usuario_id = v_user_id AND membro_id = v_convite.membro_id
  LIMIT 1;

  IF FOUND THEN
    UPDATE responsavel_membros SET ativo = true WHERE id = v_exist_id;
  ELSE
    INSERT INTO responsavel_membros (usuario_id, membro_id, clube_id, programa_id, parentesco, ativo)
    VALUES (v_user_id, v_convite.membro_id, v_convite.clube_id, v_convite.programa_id, v_convite.parentesco, true);
  END IF;

  UPDATE responsavel_convites SET usado = true WHERE id = v_convite.id;

  RETURN json_build_object('success', true, 'membro_id', v_convite.membro_id);
END;
$$;

-- 3. Políticas adicionais para responsavel_membros (caso não existam)
-- Admins podem inserir vínculos diretos (para "vincular membro do clube")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'responsavel_membros' AND policyname = 'admins_insert_responsavel_membros'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admins_insert_responsavel_membros" ON responsavel_membros
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM usuario_clubes uc
            WHERE uc.usuario_id = auth.uid()
              AND uc.clube_id = responsavel_membros.clube_id
              AND uc.perfil IN ('admin_ti','admin_clube','usuario_secretaria','usuario_diretoria')
              AND uc.ativo = true
          )
          OR EXISTS (
            SELECT 1 FROM usuarios u
            WHERE u.id = auth.uid() AND u.perfil IN ('admin_ti','admin_clube')
          )
        )
    $policy$;
  END IF;
END;
$$;

-- Admins podem atualizar vínculos (remover/reativar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'responsavel_membros' AND policyname = 'admins_update_responsavel_membros'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admins_update_responsavel_membros" ON responsavel_membros
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM usuario_clubes uc
            WHERE uc.usuario_id = auth.uid()
              AND uc.clube_id = responsavel_membros.clube_id
              AND uc.perfil IN ('admin_ti','admin_clube','usuario_secretaria','usuario_diretoria')
              AND uc.ativo = true
          )
          OR EXISTS (
            SELECT 1 FROM usuarios u
            WHERE u.id = auth.uid() AND u.perfil IN ('admin_ti','admin_clube')
          )
        )
    $policy$;
  END IF;
END;
$$;
