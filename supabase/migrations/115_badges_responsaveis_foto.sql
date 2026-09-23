-- Permite montar os selos de responsáveis com a foto real do usuário.
--
-- A tabela usuarios só pode ser lida pelo próprio usuário/admin. Para os
-- badges, o app precisa de um recorte bem menor: nome e foto dos responsáveis
-- ativos de membros do clube que o usuário já pode acessar. Esta RPC evita
-- relaxar a RLS geral de usuarios.

CREATE OR REPLACE FUNCTION public.badges_responsaveis_membros(p_membro_ids INTEGER[])
RETURNS TABLE (
  membro_id INTEGER,
  usuario_id UUID,
  nome TEXT,
  foto_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rm.membro_id,
    rm.usuario_id,
    COALESCE(NULLIF(u.nome, ''), NULLIF(rm.nome_cache, ''), 'Responsável') AS nome,
    u.foto_url
  FROM public.responsavel_membros rm
  JOIN public.desbravadores d
    ON d.id = rm.membro_id
   AND d.clube_id = rm.clube_id
  LEFT JOIN public.usuarios u
    ON u.id = rm.usuario_id
  WHERE rm.ativo = TRUE
    AND rm.membro_id = ANY(COALESCE(p_membro_ids, ARRAY[]::INTEGER[]))
    AND public.current_user_has_clube(d.clube_id)
  ORDER BY rm.membro_id, COALESCE(rm.responsavel_principal, FALSE) DESC, rm.id;
$$;

REVOKE ALL ON FUNCTION public.badges_responsaveis_membros(INTEGER[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.badges_responsaveis_membros(INTEGER[]) TO authenticated;
