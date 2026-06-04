-- Convites externos para responsáveis/pais.

CREATE TABLE IF NOT EXISTS public.responsavel_convites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  token uuid NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  email text NOT NULL,
  telefone text,
  membro_id integer NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  clube_id integer NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  programa_id integer NOT NULL REFERENCES public.programas(id),
  parentesco text,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usado boolean NOT NULL DEFAULT false,
  usado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.responsavel_convites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responsavel_convites_manage_admin" ON public.responsavel_convites;
CREATE POLICY "responsavel_convites_manage_admin"
ON public.responsavel_convites
FOR ALL
TO authenticated
USING (
  public.current_user_is_admin_ti()
  OR public.current_user_has_clube(clube_id)
)
WITH CHECK (
  public.current_user_is_admin_ti()
  OR public.current_user_has_clube(clube_id)
);

DROP POLICY IF EXISTS "responsavel_convites_public_token_read" ON public.responsavel_convites;
CREATE POLICY "responsavel_convites_public_token_read"
ON public.responsavel_convites
FOR SELECT
TO anon, authenticated
USING (usado = false);
