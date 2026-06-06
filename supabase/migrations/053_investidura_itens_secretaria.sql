-- Permite que secretaria/admin gerenciem itens manuais de especialidades/classes a receber.
-- Mantém leitura para o próprio membro e restringe escrita ao clube ativo do vínculo.

DROP POLICY IF EXISTS "investidura_itens_admin_all" ON public.investidura_itens;
CREATE POLICY "investidura_itens_admin_all"
ON public.investidura_itens
FOR ALL
TO authenticated
USING (
  public.current_user_can_admin_clube(clube_id)
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = investidura_itens.clube_id
      AND uc.ativo = true
      AND uc.perfil IN ('usuario_secretaria', 'admin_ti', 'admin_clube', 'admin_total', 'admin_geral')
  )
)
WITH CHECK (
  public.current_user_can_admin_clube(clube_id)
  OR EXISTS (
    SELECT 1
    FROM public.usuario_clubes uc
    WHERE uc.usuario_id = auth.uid()
      AND uc.clube_id = investidura_itens.clube_id
      AND uc.ativo = true
      AND uc.perfil IN ('usuario_secretaria', 'admin_ti', 'admin_clube', 'admin_total', 'admin_geral')
  )
);
