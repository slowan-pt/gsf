-- Libera a alteração da aparência (paleta/fonte das atividades) do clube
-- para qualquer membro vinculado, não só admin_ti/admin_clube — pedido
-- explícito: "quero que todos os membros possam alterar a aparência, como
-- no admin". A tela já foi liberada no app; sem isso o INSERT/UPDATE seria
-- rejeitado pelo RLS mesmo assim.
DROP POLICY IF EXISTS "config_visual_admin_all" ON public.configuracoes_visuais_clube;

CREATE POLICY "config_visual_membros_all"
ON public.configuracoes_visuais_clube FOR ALL TO authenticated
USING (public.current_user_has_clube(clube_id))
WITH CHECK (public.current_user_has_clube(clube_id));
