-- Perfis externos: Pastor, Regional e Associacao.
--
-- Nao pertencem a um clube especifico: podem estar ligados a varios clubes, com
-- responsabilidades diferentes das de um clube. Sao criados so pelo Admin TI e pela
-- Associacao (a Associacao cria Pastor e Regional; so o Admin TI cria Associacao).
--
-- perfis_externos e o registro de quem e externo e de que tipo. O acesso a cada clube
-- continua em usuario_clubes (e o que o app usa para montar o contexto e as permissoes).
-- Toda criacao/edicao passa pelas funcoes abaixo, que conferem quem esta pedindo.

-- 1) Novo perfil "Associacao"
INSERT INTO public.perfis_acesso (codigo, nome, descricao, escopo, ordem, permissoes)
VALUES ('usuario_associacao', 'Associação', 'Cria e gerencia os perfis externos (pastor e regional).', 'clube', 90, '{"perfis_externos": true}'::jsonb)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, ordem = EXCLUDED.ordem, ativo = TRUE, permissoes = EXCLUDED.permissoes;

ALTER TABLE IF EXISTS public.usuarios DROP CONSTRAINT IF EXISTS usuarios_perfil_check;
ALTER TABLE IF EXISTS public.usuarios
  ADD CONSTRAINT usuarios_perfil_check
  CHECK (
    perfil IN (
      'admin_total', 'admin_geral', 'admin_diretoria', 'desbravador',
      'admin_ti', 'admin_clube', 'usuario_secretaria', 'usuario_tesouraria',
      'usuario_conselheiro', 'usuario_instrutor', 'usuario_diretoria', 'usuario_desbravador',
      'usuario_aventureiro', 'usuario_regional', 'usuario_distrital',
      'usuario_pastor', 'usuario_capelao', 'usuario_pais', 'usuario_associacao'
    )
  );

-- 2) Registro de perfis externos
CREATE TABLE IF NOT EXISTS public.perfis_externos (
  usuario_id uuid PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('pastor', 'regional', 'associacao')),
  ativo boolean NOT NULL DEFAULT TRUE,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.perfis_externos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.perfil_externo_codigo(p_tipo text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_tipo
    WHEN 'pastor' THEN 'usuario_pastor'
    WHEN 'regional' THEN 'usuario_regional'
    WHEN 'associacao' THEN 'usuario_associacao'
  END
$$;

-- Quem gerencia: Admin TI e Associacao.
CREATE OR REPLACE FUNCTION public.perfil_externo_pode_gerir()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.current_user_is_admin_ti()
  OR EXISTS (SELECT 1 FROM public.perfis_externos pe WHERE pe.usuario_id = auth.uid() AND pe.tipo = 'associacao' AND pe.ativo)
  OR EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.perfil = 'usuario_associacao')
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid() AND uc.ativo = TRUE AND uc.perfil = 'usuario_associacao'
  )
$$;

DROP POLICY IF EXISTS "perfis_externos_select" ON public.perfis_externos;
CREATE POLICY "perfis_externos_select" ON public.perfis_externos
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.perfil_externo_pode_gerir());
GRANT SELECT ON public.perfis_externos TO authenticated;
GRANT EXECUTE ON FUNCTION public.perfil_externo_pode_gerir() TO authenticated;

-- Regionais que ja existiam entram no registro.
INSERT INTO public.perfis_externos (usuario_id, tipo)
SELECT DISTINCT uc.usuario_id, 'regional'
FROM public.usuario_clubes uc
WHERE uc.perfil = 'usuario_regional' AND uc.ativo = TRUE
ON CONFLICT (usuario_id) DO NOTHING;

-- 3) Listagem (com os clubes de cada um)
CREATE OR REPLACE FUNCTION public.perfis_externos_listar()
RETURNS TABLE (usuario_id uuid, nome text, email text, tipo text, ativo boolean, clubes integer[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.perfil_externo_pode_gerir() THEN
    RAISE EXCEPTION 'Sem permissao para ver os perfis externos.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT pe.usuario_id, u.nome::text, u.email::text, pe.tipo, pe.ativo,
         COALESCE((
           SELECT array_agg(DISTINCT uc.clube_id::integer ORDER BY uc.clube_id::integer)
           FROM public.usuario_clubes uc
           WHERE uc.usuario_id = pe.usuario_id AND uc.ativo = TRUE AND uc.perfil = public.perfil_externo_codigo(pe.tipo)
         ), ARRAY[]::integer[])
  FROM public.perfis_externos pe
  LEFT JOIN public.usuarios u ON u.id = pe.usuario_id
  WHERE pe.ativo
  ORDER BY pe.tipo, u.nome;
END;
$$;

CREATE OR REPLACE FUNCTION public.perfis_externos_clubes()
RETURNS TABLE (id integer, nome text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.perfil_externo_pode_gerir() THEN
    RAISE EXCEPTION 'Sem permissao.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT c.id::integer, c.nome::text FROM public.clubes c ORDER BY c.nome;
END;
$$;

-- Procura uma conta ja existente pelo e-mail (para vincular em vez de criar). Contas de plataforma ficam de fora.
CREATE OR REPLACE FUNCTION public.perfil_externo_buscar(p_email text)
RETURNS TABLE (id uuid, nome text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.perfil_externo_pode_gerir() THEN
    RAISE EXCEPTION 'Sem permissao.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id, u.nome::text, u.email::text
  FROM public.usuarios u
  WHERE lower(u.email) = lower(btrim(p_email))
    AND COALESCE(u.perfil, '') NOT IN ('admin_ti', 'admin_total', 'admin_geral');
END;
$$;
GRANT EXECUTE ON FUNCTION public.perfil_externo_buscar(text) TO authenticated;

-- 4) Criar / editar. p_usuario_id vem da conta recem criada (ou de uma conta que ja existe).
CREATE OR REPLACE FUNCTION public.perfil_externo_salvar(
  p_usuario_id uuid, p_tipo text, p_nome text, p_email text, p_clubes integer[]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_perfil text;
  v_atual text;
  v_clube integer;
BEGIN
  IF NOT public.perfil_externo_pode_gerir() THEN
    RAISE EXCEPTION 'Sem permissao para gerenciar perfis externos.' USING ERRCODE = '42501';
  END IF;
  IF p_tipo NOT IN ('pastor', 'regional', 'associacao') THEN
    RAISE EXCEPTION 'Tipo de perfil externo invalido.';
  END IF;
  IF p_tipo = 'associacao' AND NOT public.current_user_is_admin_ti() THEN
    RAISE EXCEPTION 'Somente o Admin TI cria perfis de Associacao.' USING ERRCODE = '42501';
  END IF;
  IF p_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Conta de usuario nao informada.';
  END IF;

  v_perfil := public.perfil_externo_codigo(p_tipo);

  SELECT perfil INTO v_atual FROM public.usuarios WHERE id = p_usuario_id;
  IF v_atual IN ('admin_ti', 'admin_total', 'admin_geral') THEN
    RAISE EXCEPTION 'Esta conta tem perfil de plataforma e nao pode virar perfil externo.' USING ERRCODE = '42501';
  END IF;

  -- Libera o gatilho que protege a mudanca de perfil (esta funcao ja conferiu quem pede).
  PERFORM set_config('app.perfil_externo', '1', TRUE);

  INSERT INTO public.usuarios (id, email, nome, perfil)
  VALUES (p_usuario_id, lower(btrim(p_email)), btrim(p_nome), v_perfil)
  ON CONFLICT (id) DO UPDATE
    SET perfil = v_perfil,
        nome = COALESCE(NULLIF(btrim(p_nome), ''), public.usuarios.nome);

  INSERT INTO public.perfis_externos (usuario_id, tipo, ativo, criado_por)
  VALUES (p_usuario_id, p_tipo, TRUE, auth.uid())
  ON CONFLICT (usuario_id) DO UPDATE SET tipo = p_tipo, ativo = TRUE, updated_at = now();

  -- Clubes: tira os que sairam e acrescenta os novos.
  DELETE FROM public.usuario_clubes
   WHERE usuario_id = p_usuario_id AND perfil = v_perfil
     AND NOT (clube_id::integer = ANY (COALESCE(p_clubes, ARRAY[]::integer[])));

  FOREACH v_clube IN ARRAY COALESCE(p_clubes, ARRAY[]::integer[]) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.usuario_clubes
       WHERE usuario_id = p_usuario_id AND clube_id = v_clube AND perfil = v_perfil
    ) THEN
      INSERT INTO public.usuario_clubes (usuario_id, clube_id, perfil, ativo)
      VALUES (p_usuario_id, v_clube, v_perfil, TRUE);
    END IF;
  END LOOP;
END;
$$;

-- Remover: tira os vinculos e desativa o registro (a conta e o historico ficam).
CREATE OR REPLACE FUNCTION public.perfil_externo_remover(p_usuario_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tipo text;
BEGIN
  IF NOT public.perfil_externo_pode_gerir() THEN
    RAISE EXCEPTION 'Sem permissao.' USING ERRCODE = '42501';
  END IF;
  SELECT tipo INTO v_tipo FROM public.perfis_externos WHERE usuario_id = p_usuario_id;
  IF v_tipo IS NULL THEN RETURN; END IF;
  IF v_tipo = 'associacao' AND NOT public.current_user_is_admin_ti() THEN
    RAISE EXCEPTION 'Somente o Admin TI remove perfis de Associacao.' USING ERRCODE = '42501';
  END IF;
  IF p_usuario_id = auth.uid() THEN
    RAISE EXCEPTION 'Voce nao pode remover o proprio acesso.';
  END IF;
  DELETE FROM public.usuario_clubes WHERE usuario_id = p_usuario_id AND perfil = public.perfil_externo_codigo(v_tipo);
  UPDATE public.perfis_externos SET ativo = FALSE, updated_at = now() WHERE usuario_id = p_usuario_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.perfis_externos_listar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.perfis_externos_clubes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.perfil_externo_salvar(uuid, text, text, text, integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.perfil_externo_remover(uuid) TO authenticated;

-- 5) O gatilho que protege perfil/vinculo aceita a mudanca feita por perfil_externo_salvar.
CREATE OR REPLACE FUNCTION public.usuarios_protege_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.current_user_is_admin_ti()
     OR current_setting('app.perfil_externo', TRUE) = '1' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.perfil, '') IN ('admin_ti', 'admin_total', 'admin_geral') THEN
      RAISE EXCEPTION 'Somente o Admin TI cria contas de plataforma.' USING ERRCODE = '42501';
    END IF;
    IF NEW.id = auth.uid() AND (NEW.dbv_id IS NOT NULL OR NEW.unidade_id IS NOT NULL) THEN
      RAISE EXCEPTION 'O vínculo com o membro é definido pela administração do clube.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.perfil IS DISTINCT FROM OLD.perfil
     OR NEW.dbv_id IS DISTINCT FROM OLD.dbv_id
     OR NEW.unidade_id IS DISTINCT FROM OLD.unidade_id THEN
    IF COALESCE(NEW.perfil, '') IN ('admin_ti', 'admin_total', 'admin_geral') THEN
      RAISE EXCEPTION 'Somente o Admin TI concede perfis de plataforma.' USING ERRCODE = '42501';
    END IF;
    IF OLD.id = auth.uid() THEN
      RAISE EXCEPTION 'Você não pode alterar o próprio perfil ou vínculo.' USING ERRCODE = '42501';
    END IF;
    IF NOT public.gestor_da_conta(OLD.id, TRUE) THEN
      RAISE EXCEPTION 'Sem permissão para alterar o perfil ou o vínculo desta conta.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END
$$;
