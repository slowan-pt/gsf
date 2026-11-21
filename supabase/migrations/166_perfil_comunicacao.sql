BEGIN;

INSERT INTO public.perfis_acesso (codigo, nome, descricao, escopo, ordem, permissoes, ativo)
SELECT 'usuario_comunicacao', 'Comunicação', 'Mesmas permissões iniciais do Instrutor.',
       escopo, ordem + 1, permissoes, TRUE
FROM public.perfis_acesso
WHERE codigo = 'usuario_instrutor'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil, permissao)
SELECT 'usuario_comunicacao', instrutor.permissao
FROM public.perfil_permissoes instrutor
WHERE instrutor.perfil = 'usuario_instrutor'
  AND NOT EXISTS (SELECT 1 FROM public.perfil_permissoes WHERE perfil = 'usuario_comunicacao')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  regra text;
  assinatura regprocedure;
BEGIN
  -- Preserva a lista já aceita no banco.
  SELECT pg_get_expr(conbin, conrelid) INTO STRICT regra
  FROM pg_constraint
  WHERE conrelid = 'public.usuarios'::regclass AND conname = 'usuarios_perfil_check';
  ALTER TABLE public.usuarios DROP CONSTRAINT usuarios_perfil_check;
  EXECUTE format(
    'ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_perfil_check CHECK ((%s) OR perfil = %L)',
    regra, 'usuario_comunicacao'
  );

  -- As listas legadas de equipe continuam aplicando as mesmas regras do Instrutor.
  FOREACH assinatura IN ARRAY ARRAY[
    'public.is_admin()'::regprocedure,
    'public.is_staff_clube(integer)'::regprocedure,
    'public.agenda_pode_acao(integer,text)'::regprocedure
  ] LOOP
    regra := pg_get_functiondef(assinatura);
    IF strpos(regra, quote_literal('usuario_comunicacao')) = 0 THEN
      IF strpos(regra, quote_literal('usuario_instrutor')) = 0 THEN
        RAISE EXCEPTION 'Lista de perfis do Instrutor não encontrada em %', assinatura;
      END IF;
      EXECUTE replace(regra, quote_literal('usuario_instrutor'),
        quote_literal('usuario_instrutor') || ', ' || quote_literal('usuario_comunicacao'));
    END IF;
  END LOOP;

  regra := pg_get_functiondef('public.gerenciar_acesso_usuario_interno(uuid,text,integer,boolean)'::regprocedure);
  IF strpos(regra, quote_literal('usuario_comunicacao')) = 0 THEN
    IF strpos(regra, 'IF novo_perfil NOT IN (') = 0 THEN
      RAISE EXCEPTION 'Lista de perfis editáveis não encontrada';
    END IF;
    EXECUTE replace(regra, 'IF novo_perfil NOT IN (', 'IF novo_perfil NOT IN (''usuario_comunicacao'', ');
  END IF;
END
$$;

-- Atribui o perfil somente ao vínculo próprio do Yann cadastrado no Fonseca.
DO $$
DECLARE
  vinculo record;
BEGIN
  SELECT uc.id, uc.usuario_id INTO STRICT vinculo
  FROM public.usuario_clubes uc
  JOIN public.desbravadores d ON d.id = uc.membro_id AND d.clube_id = uc.clube_id
  JOIN public.usuarios u ON u.id = uc.usuario_id AND u.dbv_id = d.id
  WHERE d.id = 57 AND d.id_sgc = '2045470' AND d.clube_id = 1
    AND uc.ativo AND uc.perfil NOT IN ('usuario_pais', 'admin_ti', 'admin_total', 'admin_geral')
    AND u.perfil NOT IN ('usuario_pais', 'admin_ti', 'admin_total', 'admin_geral');

  UPDATE public.usuario_clubes SET perfil = 'usuario_comunicacao' WHERE id = vinculo.id;
  IF NOT EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = vinculo.usuario_id AND uc.ativo AND uc.id <> vinculo.id
  ) THEN
    UPDATE public.usuarios SET perfil = 'usuario_comunicacao' WHERE id = vinculo.usuario_id;
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('perfil', 'usuario_comunicacao')
    WHERE id = vinculo.usuario_id;
  END IF;
EXCEPTION
  WHEN no_data_found OR too_many_rows THEN
    RAISE WARNING 'Perfil criado. Atribuição ao Yann pendente: vínculo próprio ativo não encontrado ou ambíguo.';
END
$$;

COMMIT;
