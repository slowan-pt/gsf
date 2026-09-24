-- Os selos de responsáveis (bolinhas ao lado do nome, na lista de membros e no
-- painel) só mostravam a foto gravada em usuarios.foto_url. Quem tem foto na
-- própria ficha de membro (caso da diretoria, que também é desbravador/líder)
-- aparecia só com a inicial. Agora, sem foto em usuarios, usa a foto da ficha
-- vinculada ao usuário (usuarios.dbv_id).

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
    COALESCE(NULLIF(u.foto_url, ''), NULLIF(df.foto_url, '')) AS foto_url
  FROM public.responsavel_membros rm
  JOIN public.desbravadores d
    ON d.id = rm.membro_id
   AND d.clube_id = rm.clube_id
  LEFT JOIN public.usuarios u
    ON u.id = rm.usuario_id
  LEFT JOIN public.desbravadores df
    ON df.id = u.dbv_id
  WHERE rm.ativo = TRUE
    AND rm.membro_id = ANY(COALESCE(p_membro_ids, ARRAY[]::INTEGER[]))
    AND public.current_user_has_clube(d.clube_id)
  ORDER BY rm.membro_id, COALESCE(rm.responsavel_principal, FALSE) DESC, rm.id;
$$;

REVOKE ALL ON FUNCTION public.badges_responsaveis_membros(INTEGER[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.badges_responsaveis_membros(INTEGER[]) TO authenticated;
