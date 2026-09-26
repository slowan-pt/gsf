-- 123_classes_biblicas.sql
-- Classes bíblicas em HTML, compartilhadas por todos os clubes e cadastradas
-- pelo Admin TI. As respostas dos campos continuam por usuário (e por clube),
-- agora também por classe (classe_slug). A classe original "Jóias da Eternidade"
-- segue como arquivo estático do app e mantém o slug 'joias-da-eternidade'.

CREATE TABLE IF NOT EXISTS public.classes_biblicas (
  id         BIGSERIAL PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titulo     TEXT NOT NULL,
  descricao  TEXT,
  html       TEXT NOT NULL,
  ordem      INTEGER NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  versao     INTEGER NOT NULL DEFAULT 1,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.classes_biblicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "classes_biblicas_select" ON public.classes_biblicas;
DROP POLICY IF EXISTS "classes_biblicas_admin_ti_all" ON public.classes_biblicas;

-- Todo usuário logado lê as classes ativas; só o Admin TI vê as inativas e edita.
CREATE POLICY "classes_biblicas_select" ON public.classes_biblicas
  FOR SELECT TO authenticated
  USING (ativo OR public.current_user_is_admin_ti());

CREATE POLICY "classes_biblicas_admin_ti_all" ON public.classes_biblicas
  FOR ALL TO authenticated
  USING (public.current_user_is_admin_ti())
  WITH CHECK (public.current_user_is_admin_ti());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes_biblicas TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.classes_biblicas_id_seq TO authenticated;

-- Respostas: uma linha por usuário + clube + classe + campo.
ALTER TABLE public.classe_biblica_respostas
  ADD COLUMN IF NOT EXISTS classe_slug TEXT NOT NULL DEFAULT 'joias-da-eternidade';

-- Troca a unicidade antiga (sem a classe) pela nova (com a classe).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.classe_biblica_respostas'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) NOT LIKE '%classe_slug%'
  LOOP
    EXECUTE format('ALTER TABLE public.classe_biblica_respostas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS classe_biblica_respostas_unica
  ON public.classe_biblica_respostas (usuario_id, clube_id, classe_slug, campo_id);
