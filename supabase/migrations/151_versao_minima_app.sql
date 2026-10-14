-- 151_versao_minima_app.sql
-- Atualização obrigatória por NÚMERO DE BUILD, para Android e iPhone.
-- O app consulta esta tabela ao abrir (e ao voltar para o primeiro plano). Se o build instalado for MENOR que
-- build_minimo da plataforma, uma tela cheia sem botão de fechar manda o usuário para a loja. Funciona também
-- para TestFlight e para APK fora da Play Store, onde a consulta às lojas não enxerga a versão nova.
-- Começa DESLIGADO (build_minimo = 0): só passe a exigir um build depois que ele estiver disponível na loja.

CREATE TABLE IF NOT EXISTS public.app_versao_minima (
  plataforma   TEXT PRIMARY KEY CHECK (plataforma IN ('ios', 'android')),
  build_minimo INTEGER NOT NULL DEFAULT 0,
  versao_exibida TEXT,
  url_loja     TEXT,
  mensagem     TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_versao_minima ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_versao_minima_leitura" ON public.app_versao_minima;
DROP POLICY IF EXISTS "app_versao_minima_admin_ti" ON public.app_versao_minima;

-- Leitura pública (a consulta acontece antes do login).
CREATE POLICY "app_versao_minima_leitura" ON public.app_versao_minima
  FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "app_versao_minima_admin_ti" ON public.app_versao_minima
  FOR ALL TO authenticated
  USING (public.current_user_is_admin_ti())
  WITH CHECK (public.current_user_is_admin_ti());

GRANT SELECT ON public.app_versao_minima TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_versao_minima TO authenticated;

INSERT INTO public.app_versao_minima (plataforma, build_minimo, versao_exibida, url_loja) VALUES
  ('android', 0, NULL, 'https://play.google.com/store/apps/details?id=com.slowdev.gsfdbv'),
  ('ios', 0, NULL, NULL)
ON CONFLICT (plataforma) DO NOTHING;
