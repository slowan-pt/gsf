-- Paleta visual dos blocos de atividades, configuravel por clube.

CREATE TABLE IF NOT EXISTS public.configuracoes_visuais_clube (
  clube_id INTEGER PRIMARY KEY REFERENCES public.clubes(id) ON DELETE CASCADE,
  paleta_atividades TEXT NOT NULL DEFAULT 'viva',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.configuracoes_visuais_clube ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_visual_select_contexto" ON public.configuracoes_visuais_clube;
DROP POLICY IF EXISTS "config_visual_admin_all" ON public.configuracoes_visuais_clube;

CREATE POLICY "config_visual_select_contexto"
ON public.configuracoes_visuais_clube
FOR SELECT TO authenticated
USING (public.current_user_has_clube(clube_id));

CREATE POLICY "config_visual_admin_all"
ON public.configuracoes_visuais_clube
FOR ALL TO authenticated
USING (public.current_user_can_admin_clube(clube_id))
WITH CHECK (public.current_user_can_admin_clube(clube_id));

INSERT INTO public.configuracoes_visuais_clube (clube_id, paleta_atividades)
SELECT id, 'viva' FROM public.clubes
ON CONFLICT (clube_id) DO NOTHING;
