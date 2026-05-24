CREATE TABLE IF NOT EXISTS public.documento_tipos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campo text NOT NULL UNIQUE,
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  ordem integer DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documento_status (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dbv_id integer NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  campo text NOT NULL,
  status text CHECK (status IN ('OK', 'NA', 'NOK')),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (dbv_id, campo)
);

ALTER TABLE public.documento_imagens ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.documento_imagens ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'image';

INSERT INTO public.documento_tipos (campo, nome, ordem, ativo) VALUES
  ('rg', 'RG', 1, true),
  ('cpf', 'CPF', 2, true),
  ('rg_resp', 'RG Responsável', 3, true),
  ('cartao_sus', 'Cartão SUS', 4, true),
  ('cartao_plano', 'Cartão de Plano', 5, true),
  ('ficha_saude', 'Ficha de Saúde', 6, true),
  ('carteira_vacinacao', 'Carteira de Vacinação', 7, true),
  ('laudo_medico', 'Laudo Médico', 8, true),
  ('ficha_reg', 'Ficha de Reg. Atualizada', 9, true),
  ('comp_residencia', 'Comp. Residência', 10, true),
  ('aut_saida', 'Aut. Saída', 11, true),
  ('aut_viagem', 'Aut. Viagem Autenticada', 12, true),
  ('ri_assinado', 'RI Assinado', 13, true),
  ('foto', 'Foto', 14, true),
  ('ant_criminais', 'Ant. Criminais', 15, true)
ON CONFLICT (campo) DO UPDATE
SET nome = EXCLUDED.nome,
    ordem = EXCLUDED.ordem,
    ativo = true;

ALTER TABLE public.documento_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_documento_tipos" ON public.documento_tipos;
DROP POLICY IF EXISTS "admin_all_documento_tipos" ON public.documento_tipos;
DROP POLICY IF EXISTS "admin_or_owner_select_documento_status" ON public.documento_status;
DROP POLICY IF EXISTS "admin_or_owner_all_documento_status" ON public.documento_status;

CREATE POLICY "authenticated_select_documento_tipos"
ON public.documento_tipos FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_documento_tipos"
ON public.documento_tipos FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "admin_or_owner_select_documento_status"
ON public.documento_status FOR SELECT
USING (public.is_admin() OR dbv_id = public.current_user_dbv_id());

CREATE POLICY "admin_or_owner_all_documento_status"
ON public.documento_status FOR ALL
USING (public.is_admin() OR dbv_id = public.current_user_dbv_id())
WITH CHECK (public.is_admin() OR dbv_id = public.current_user_dbv_id());
