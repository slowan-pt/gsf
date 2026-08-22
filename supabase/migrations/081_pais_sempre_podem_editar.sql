-- Remove a "janela de edição" dos responsáveis: pais/responsáveis agora
-- sempre podem editar a ficha básica e os documentos dos filhos vinculados
-- (mesmo nível de quem tem 16 anos ou mais editando a própria ficha), sem
-- depender de um período liberado pelo admin em documentos_pais_config.
--
-- current_user_pode_editar_ficha_basica() (migração 080) já não dependia da
-- janela. Esta migração ajusta a única função que ainda dependia dela,
-- current_user_can_parent_edit_docs() (migração 011) — usada nas policies de
-- documento_imagens/documento_status/storage. Como é CREATE OR REPLACE com a
-- mesma assinatura, toda policy que já referencia essa função passa a valer
-- com a regra nova automaticamente, sem precisar recriar policy nenhuma.
CREATE OR REPLACE FUNCTION public.current_user_can_parent_edit_docs(
  target_clube_id INTEGER,
  target_membro_id INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.responsavel_membros rm
    WHERE rm.usuario_id = auth.uid()
      AND rm.clube_id = target_clube_id
      AND rm.membro_id = target_membro_id
      AND rm.ativo = TRUE
      AND rm.pode_enviar_documentos = TRUE
  )
$$;
