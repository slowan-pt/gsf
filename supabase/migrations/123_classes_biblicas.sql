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

-- Respostas dos campos: uma linha por usuário + clube + classe + campo.
-- Tabela nova: a classe_biblica_respostas de produção guarda por episódio (JSON)
-- e não serve para classes genéricas em HTML.
CREATE TABLE IF NOT EXISTS public.classes_biblicas_respostas (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clube_id    BIGINT      NOT NULL,
  classe_slug TEXT        NOT NULL,
  campo_id    TEXT        NOT NULL,
  resposta    TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, clube_id, classe_slug, campo_id)
);

CREATE INDEX IF NOT EXISTS idx_cbresp_usuario_clube_classe
  ON public.classes_biblicas_respostas (usuario_id, clube_id, classe_slug);

ALTER TABLE public.classes_biblicas_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cbresp_own" ON public.classes_biblicas_respostas;
CREATE POLICY "cbresp_own" ON public.classes_biblicas_respostas
  FOR ALL TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes_biblicas_respostas TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.classes_biblicas_respostas_id_seq TO authenticated;

-- Aproveita o que já foi respondido em "Jóias da Eternidade" quando as chaves do
-- JSON seguem o padrão dos campos do HTML (ep1_q1, ep2_p1...). O que não segue
-- o padrão fica só na tabela antiga, sem ser apagado.
INSERT INTO public.classes_biblicas_respostas (usuario_id, clube_id, classe_slug, campo_id, resposta, updated_at)
SELECT r.usuario_id, r.clube_id, 'joias-da-eternidade', kv.key, kv.value, r.updated_at
FROM public.classe_biblica_respostas r,
     LATERAL jsonb_each_text(CASE WHEN jsonb_typeof(r.respostas) = 'object' THEN r.respostas ELSE '{}'::jsonb END) AS kv
WHERE kv.key ~ '^ep[0-9]+_' AND btrim(kv.value) <> ''
ON CONFLICT (usuario_id, clube_id, classe_slug, campo_id) DO NOTHING;
