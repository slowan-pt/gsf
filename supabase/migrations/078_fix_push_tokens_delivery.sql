-- Garante que o app Android consiga registrar o token Expo Push
-- e que administradores consigam disparar notificacoes para o clube.

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'push_tokens'
      AND column_name = 'plataforma'
  ) THEN
    UPDATE public.push_tokens
       SET platform = COALESCE(platform, plataforma)
     WHERE platform IS NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_user_token
  ON public.push_tokens(user_id, token);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id
  ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_tokens TO service_role;

DROP POLICY IF EXISTS "push_tokens_owner_insert" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_insert"
ON public.push_tokens FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_tokens_owner_update" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_update"
ON public.push_tokens FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "push_tokens_owner_delete" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_delete"
ON public.push_tokens FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "push_tokens_admin_select" ON public.push_tokens;
CREATE POLICY "push_tokens_admin_select"
ON public.push_tokens FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());
