-- current_user_has_clube() só verificava vínculo em `usuario_clubes` — mas o
-- convite de responsável (aceitar_convite_responsavel) grava só em
-- `responsavel_membros`, nunca cria linha em usuario_clubes. Resultado: um
-- pai/responsável falhava a policy de SELECT de qualquer tabela que dependa
-- dessa função (config_ranking, entre outras), e o app caía no valor padrão
-- "tudo liberado" — daí a configuração de visibilidade do ranking parecer
-- salva mas nunca ser aplicada pra quem entra como responsável.
--
-- current_user_has_clube é usada por várias policies (grep no schema por
-- "current_user_has_clube" antes de mudar a assinatura) — só ampliando o
-- critério de "tem acesso ao clube", sem tirar nada do que já valia.

CREATE OR REPLACE FUNCTION public.current_user_has_clube(target_clube_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_admin_ti()
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = target_clube_id
      AND uc.ativo = TRUE
  )
  OR EXISTS (
    SELECT 1
    FROM public.responsavel_membros rm
    WHERE rm.usuario_id = auth.uid()
      AND rm.clube_id = target_clube_id
      AND rm.ativo = TRUE
  )
$$;
