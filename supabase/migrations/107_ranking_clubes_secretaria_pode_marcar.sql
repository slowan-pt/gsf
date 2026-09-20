-- Rankings Externos (ARF): além de admin_ti/admin_clube, a secretaria também
-- pode marcar um requisito como concluído/pendente — é quem normalmente
-- acompanha esse checklist no dia a dia do clube.
DROP POLICY IF EXISTS "ranking_clubes_pontuacoes_admin_all" ON public.ranking_clubes_pontuacoes;
CREATE POLICY "ranking_clubes_pontuacoes_admin_all"
ON public.ranking_clubes_pontuacoes FOR ALL TO authenticated
USING (
  public.current_user_can_admin_clube(clube_id)
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = ranking_clubes_pontuacoes.clube_id
      AND uc.ativo = TRUE
      AND uc.perfil = 'usuario_secretaria'
  )
)
WITH CHECK (
  public.current_user_can_admin_clube(clube_id)
  OR EXISTS (
    SELECT 1 FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = ranking_clubes_pontuacoes.clube_id
      AND uc.ativo = TRUE
      AND uc.perfil = 'usuario_secretaria'
  )
);
