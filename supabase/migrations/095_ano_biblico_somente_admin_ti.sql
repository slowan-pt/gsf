-- Editar o plano do Ano Biblico (catalogo + textos) passa a ser exclusivo
-- do Admin TI. Antes admin_clube/admin_geral/admin_total tambem podiam
-- editar; por pedido do usuario, restringe pra evitar que qualquer clube
-- mexa no plano que e compartilhado por todos.

DROP POLICY IF EXISTS "ano_biblico_catalogo_admin" ON public.ano_biblico_catalogo;
CREATE POLICY "ano_biblico_catalogo_admin"
ON public.ano_biblico_catalogo FOR ALL TO authenticated
USING (public.current_user_is_admin_ti())
WITH CHECK (public.current_user_is_admin_ti());

DROP POLICY IF EXISTS "ano_biblico_textos_admin" ON public.ano_biblico_textos;
CREATE POLICY "ano_biblico_textos_admin"
ON public.ano_biblico_textos FOR ALL TO authenticated
USING (public.current_user_is_admin_ti())
WITH CHECK (public.current_user_is_admin_ti());
