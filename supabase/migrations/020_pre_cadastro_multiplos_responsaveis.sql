-- Pré-cadastro com múltiplos responsáveis e fluxo de conversão para acesso.

CREATE TABLE IF NOT EXISTS public.pre_cadastro_responsaveis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pre_cadastro_id UUID NOT NULL REFERENCES public.pre_cadastros(id) ON DELETE CASCADE,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  parentesco TEXT,
  responsavel_principal BOOLEAN NOT NULL DEFAULT FALSE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pre_cadastro_responsaveis_pre
  ON public.pre_cadastro_responsaveis (pre_cadastro_id);

CREATE INDEX IF NOT EXISTS idx_pre_cadastro_responsaveis_clube
  ON public.pre_cadastro_responsaveis (clube_id);

CREATE INDEX IF NOT EXISTS idx_pre_cadastro_responsaveis_email
  ON public.pre_cadastro_responsaveis (lower(email));

ALTER TABLE public.pre_cadastro_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pre_cadastro_responsaveis_public_insert" ON public.pre_cadastro_responsaveis;
CREATE POLICY "pre_cadastro_responsaveis_public_insert"
ON public.pre_cadastro_responsaveis
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.pre_cadastros p
    JOIN public.pre_cadastro_links l ON l.id = p.link_id
    WHERE p.id = pre_cadastro_responsaveis.pre_cadastro_id
      AND p.clube_id = pre_cadastro_responsaveis.clube_id
      AND l.ativo = TRUE
      AND (l.expira_em IS NULL OR l.expira_em > NOW())
  )
);

DROP POLICY IF EXISTS "pre_cadastro_responsaveis_admin_all" ON public.pre_cadastro_responsaveis;
CREATE POLICY "pre_cadastro_responsaveis_admin_all"
ON public.pre_cadastro_responsaveis
FOR ALL
TO authenticated
USING (public.current_user_can_admin_clube(clube_id))
WITH CHECK (public.current_user_can_admin_clube(clube_id));

-- Migra responsáveis antigos do pré-cadastro simples para a nova tabela.
INSERT INTO public.pre_cadastro_responsaveis (
  pre_cadastro_id, clube_id, nome, email, telefone, parentesco, responsavel_principal
)
SELECT
  p.id,
  p.clube_id,
  p.nome_responsavel,
  p.email_responsavel,
  p.contato_responsavel,
  COALESCE(p.parentesco_responsavel, 'Responsável'),
  TRUE
FROM public.pre_cadastros p
WHERE p.nome_responsavel IS NOT NULL
  AND trim(p.nome_responsavel) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.pre_cadastro_responsaveis r
    WHERE r.pre_cadastro_id = p.id
      AND lower(COALESCE(r.email, '')) = lower(COALESCE(p.email_responsavel, ''))
      AND lower(r.nome) = lower(p.nome_responsavel)
  );
