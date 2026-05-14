-- Corrige alerta do Supabase: rls_disabled_in_public.
-- Habilita RLS em todas as tabelas públicas usadas pelo app e recria policies
-- sem consultar public.usuarios diretamente dentro das policies, evitando recursão.

-- Funções auxiliares SECURITY DEFINER. Elas rodam com o dono da função e
-- conseguem consultar usuarios/desbravadores sem disparar recursão nas policies.
CREATE OR REPLACE FUNCTION public.current_user_perfil()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT perfil FROM public.usuarios WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_unidade_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unidade_id FROM public.usuarios WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_dbv_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dbv_id FROM public.usuarios WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_perfil(), '') IN ('admin_geral', 'admin_diretoria')
$$;

-- Tabelas adicionadas depois da primeira versão. Criar aqui deixa o script
-- idempotente para projetos onde alguma delas ainda não exista.
CREATE TABLE IF NOT EXISTS public.config_pontuacao (
  id integer PRIMARY KEY DEFAULT 1,
  presenca integer DEFAULT 25,
  pontualidade integer DEFAULT 100,
  material integer DEFAULT 25,
  uniforme integer DEFAULT 25,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.config_pontuacao_itens (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  valor integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pontuacoes_custom (
  id serial PRIMARY KEY,
  dbv_id integer NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  data date NOT NULL,
  item_id integer NOT NULL REFERENCES public.config_pontuacao_itens(id) ON DELETE CASCADE,
  quantidade integer DEFAULT 0,
  pontos integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (dbv_id, data, item_id)
);

CREATE TABLE IF NOT EXISTS public.documento_imagens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dbv_id integer NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  campo text NOT NULL,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE TABLE IF NOT EXISTS public.mensagens_clube (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo text NOT NULL,
  corpo text NOT NULL,
  enviado_por text,
  lida boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.atividades (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo text NOT NULL,
  descricao text,
  data text,
  destino text NOT NULL DEFAULT 'todos',
  unidade_id integer,
  unidade_nome text,
  dbv_id integer REFERENCES public.desbravadores(id) ON DELETE SET NULL,
  dbv_nome text,
  criado_por text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.atividades_anexos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  atividade_id uuid NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  nome text NOT NULL,
  url text NOT NULL,
  tipo text DEFAULT 'outro',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.atividades_respostas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  atividade_id uuid NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  dbv_id integer NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  dbv_nome text,
  texto text,
  anexo_url text,
  anexo_nome text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (atividade_id, dbv_id)
);

INSERT INTO public.config_pontuacao (id, presenca, pontualidade, material, uniforme)
VALUES (1, 25, 100, 25, 25)
ON CONFLICT (id) DO NOTHING;

-- RLS em todas as tabelas públicas do app. IF EXISTS deixa seguro mesmo se alguma
-- tabela ainda não tiver sido criada no projeto remoto.
ALTER TABLE IF EXISTS public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.desbravadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documento_imagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.progresso_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.especialidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pontuacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.config_pontuacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.config_pontuacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pontuacoes_custom ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.config_campori ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parcelas_campori_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pagamentos_campori ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mensagens_clube ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.atividades_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.atividades_respostas ENABLE ROW LEVEL SECURITY;

-- Limpa policies antigas/conflitantes.
DROP POLICY IF EXISTS "usuario_le_proprio" ON public.usuarios;
DROP POLICY IF EXISTS "admin_geral_le_usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_self_or_admin_jwt" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin_jwt" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_self_or_admin" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert_admin" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin" ON public.usuarios;

DROP POLICY IF EXISTS "authenticated_select_unidades" ON public.unidades;
DROP POLICY IF EXISTS "admin_all_unidades" ON public.unidades;
DROP POLICY IF EXISTS "admin_geral_acesso_total" ON public.desbravadores;
DROP POLICY IF EXISTS "admin_diretoria_acesso_unidade" ON public.desbravadores;
DROP POLICY IF EXISTS "dbv_acesso_proprio" ON public.desbravadores;
DROP POLICY IF EXISTS "authenticated_select_desbravadores" ON public.desbravadores;
DROP POLICY IF EXISTS "admin_all_desbravadores" ON public.desbravadores;
DROP POLICY IF EXISTS "dbv_update_own_photo" ON public.desbravadores;

DROP POLICY IF EXISTS "admin_or_owner_select_documentos" ON public.documentos;
DROP POLICY IF EXISTS "admin_or_owner_update_documentos" ON public.documentos;
DROP POLICY IF EXISTS "admin_all_documentos" ON public.documentos;
DROP POLICY IF EXISTS "admin_or_owner_select_documento_imagens" ON public.documento_imagens;
DROP POLICY IF EXISTS "admin_or_owner_all_documento_imagens" ON public.documento_imagens;

DROP POLICY IF EXISTS "authenticated_select_progresso_classes" ON public.progresso_classes;
DROP POLICY IF EXISTS "admin_all_progresso_classes" ON public.progresso_classes;
DROP POLICY IF EXISTS "authenticated_select_especialidades" ON public.especialidades;
DROP POLICY IF EXISTS "admin_all_especialidades" ON public.especialidades;
DROP POLICY IF EXISTS "authenticated_select_eventos" ON public.eventos;
DROP POLICY IF EXISTS "admin_all_eventos" ON public.eventos;
DROP POLICY IF EXISTS "authenticated_select_pontuacoes" ON public.pontuacoes;
DROP POLICY IF EXISTS "admin_all_pontuacoes" ON public.pontuacoes;

DROP POLICY IF EXISTS "authenticated_select_config_pontuacao" ON public.config_pontuacao;
DROP POLICY IF EXISTS "admin_all_config_pontuacao" ON public.config_pontuacao;
DROP POLICY IF EXISTS "authenticated_select_config_pontuacao_itens" ON public.config_pontuacao_itens;
DROP POLICY IF EXISTS "admin_all_config_pontuacao_itens" ON public.config_pontuacao_itens;
DROP POLICY IF EXISTS "authenticated_select_pontuacoes_custom" ON public.pontuacoes_custom;
DROP POLICY IF EXISTS "admin_all_pontuacoes_custom" ON public.pontuacoes_custom;
DROP POLICY IF EXISTS "authenticated_select_config_campori" ON public.config_campori;
DROP POLICY IF EXISTS "admin_all_config_campori" ON public.config_campori;
DROP POLICY IF EXISTS "authenticated_select_parcelas_campori_config" ON public.parcelas_campori_config;
DROP POLICY IF EXISTS "admin_all_parcelas_campori_config" ON public.parcelas_campori_config;
DROP POLICY IF EXISTS "admin_or_owner_select_pagamentos_campori" ON public.pagamentos_campori;
DROP POLICY IF EXISTS "admin_all_pagamentos_campori" ON public.pagamentos_campori;

DROP POLICY IF EXISTS "push_tokens_owner_insert" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_owner_update" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_owner_delete" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_admin_select" ON public.push_tokens;

DROP POLICY IF EXISTS "authenticated_select_mensagens" ON public.mensagens_clube;
DROP POLICY IF EXISTS "admin_all_mensagens" ON public.mensagens_clube;
DROP POLICY IF EXISTS "atividades_select_by_target" ON public.atividades;
DROP POLICY IF EXISTS "admin_all_atividades" ON public.atividades;
DROP POLICY IF EXISTS "atividades_anexos_select_by_activity" ON public.atividades_anexos;
DROP POLICY IF EXISTS "admin_all_atividades_anexos" ON public.atividades_anexos;
DROP POLICY IF EXISTS "atividades_respostas_select" ON public.atividades_respostas;
DROP POLICY IF EXISTS "atividades_respostas_insert_own" ON public.atividades_respostas;
DROP POLICY IF EXISTS "atividades_respostas_update_own" ON public.atividades_respostas;
DROP POLICY IF EXISTS "atividades_respostas_delete_admin_or_own" ON public.atividades_respostas;

-- usuarios
CREATE POLICY "usuarios_select_self_or_admin"
ON public.usuarios FOR SELECT
USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "usuarios_insert_admin"
ON public.usuarios FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "usuarios_update_admin"
ON public.usuarios FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Dados gerais necessários ao app.
CREATE POLICY "authenticated_select_unidades"
ON public.unidades FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_unidades"
ON public.unidades FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "authenticated_select_desbravadores"
ON public.desbravadores FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_desbravadores"
ON public.desbravadores FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "dbv_update_own_photo"
ON public.desbravadores FOR UPDATE
USING (id = public.current_user_dbv_id())
WITH CHECK (id = public.current_user_dbv_id());

-- Documentos: sensíveis. Admin vê tudo; membro vê/atualiza somente o próprio.
CREATE POLICY "admin_or_owner_select_documentos"
ON public.documentos FOR SELECT
USING (public.is_admin() OR dbv_id = public.current_user_dbv_id());

CREATE POLICY "admin_or_owner_update_documentos"
ON public.documentos FOR UPDATE
USING (public.is_admin() OR dbv_id = public.current_user_dbv_id())
WITH CHECK (public.is_admin() OR dbv_id = public.current_user_dbv_id());

CREATE POLICY "admin_all_documentos"
ON public.documentos FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "admin_or_owner_select_documento_imagens"
ON public.documento_imagens FOR SELECT
USING (public.is_admin() OR dbv_id = public.current_user_dbv_id());

CREATE POLICY "admin_or_owner_all_documento_imagens"
ON public.documento_imagens FOR ALL
USING (public.is_admin() OR dbv_id = public.current_user_dbv_id())
WITH CHECK (public.is_admin() OR dbv_id = public.current_user_dbv_id());

-- Classes, especialidades, eventos e pontuações.
CREATE POLICY "authenticated_select_progresso_classes"
ON public.progresso_classes FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_progresso_classes"
ON public.progresso_classes FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "authenticated_select_especialidades"
ON public.especialidades FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_especialidades"
ON public.especialidades FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "authenticated_select_eventos"
ON public.eventos FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_eventos"
ON public.eventos FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "authenticated_select_pontuacoes"
ON public.pontuacoes FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_pontuacoes"
ON public.pontuacoes FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Configurações.
CREATE POLICY "authenticated_select_config_pontuacao"
ON public.config_pontuacao FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_config_pontuacao"
ON public.config_pontuacao FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "authenticated_select_config_pontuacao_itens"
ON public.config_pontuacao_itens FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_config_pontuacao_itens"
ON public.config_pontuacao_itens FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "authenticated_select_pontuacoes_custom"
ON public.pontuacoes_custom FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_pontuacoes_custom"
ON public.pontuacoes_custom FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "authenticated_select_config_campori"
ON public.config_campori FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_config_campori"
ON public.config_campori FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "authenticated_select_parcelas_campori_config"
ON public.parcelas_campori_config FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_parcelas_campori_config"
ON public.parcelas_campori_config FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "admin_or_owner_select_pagamentos_campori"
ON public.pagamentos_campori FOR SELECT
USING (public.is_admin() OR dbv_id = public.current_user_dbv_id());

CREATE POLICY "admin_all_pagamentos_campori"
ON public.pagamentos_campori FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Push tokens: usuário grava o próprio token; admin lê para disparar notificações.
CREATE POLICY "push_tokens_owner_insert"
ON public.push_tokens FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_tokens_owner_update"
ON public.push_tokens FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_tokens_owner_delete"
ON public.push_tokens FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "push_tokens_admin_select"
ON public.push_tokens FOR SELECT
USING (user_id = auth.uid() OR public.is_admin());

-- Mensagens.
CREATE POLICY "authenticated_select_mensagens"
ON public.mensagens_clube FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_mensagens"
ON public.mensagens_clube FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Atividades.
CREATE POLICY "atividades_select_by_target"
ON public.atividades FOR SELECT
USING (
  public.is_admin()
  OR destino = 'todos'
  OR unidade_id = public.current_user_unidade_id()
  OR dbv_id = public.current_user_dbv_id()
);

CREATE POLICY "admin_all_atividades"
ON public.atividades FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "atividades_anexos_select_by_activity"
ON public.atividades_anexos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.atividades a
    WHERE a.id = atividades_anexos.atividade_id
      AND (
        public.is_admin()
        OR a.destino = 'todos'
        OR a.unidade_id = public.current_user_unidade_id()
        OR a.dbv_id = public.current_user_dbv_id()
      )
  )
);

CREATE POLICY "admin_all_atividades_anexos"
ON public.atividades_anexos FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "atividades_respostas_select"
ON public.atividades_respostas FOR SELECT
USING (public.is_admin() OR dbv_id = public.current_user_dbv_id());

CREATE POLICY "atividades_respostas_insert_own"
ON public.atividades_respostas FOR INSERT
WITH CHECK (dbv_id = public.current_user_dbv_id());

CREATE POLICY "atividades_respostas_update_own"
ON public.atividades_respostas FOR UPDATE
USING (dbv_id = public.current_user_dbv_id())
WITH CHECK (dbv_id = public.current_user_dbv_id());

CREATE POLICY "atividades_respostas_delete_admin_or_own"
ON public.atividades_respostas FOR DELETE
USING (public.is_admin() OR dbv_id = public.current_user_dbv_id());
