-- LGPD consent terms and acceptances

CREATE TABLE IF NOT EXISTS public.lgpd_termos (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS lgpd_termos_ativo_unique
  ON public.lgpd_termos (ativo)
  WHERE ativo = TRUE;

CREATE TABLE IF NOT EXISTS public.lgpd_aceites (
  id BIGSERIAL PRIMARY KEY,
  termo_id BIGINT NOT NULL REFERENCES public.lgpd_termos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nome TEXT,
  perfil TEXT,
  user_agent TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (termo_id, usuario_id)
);

ALTER TABLE public.lgpd_termos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_aceites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lgpd_termos_select_authenticated" ON public.lgpd_termos;
DROP POLICY IF EXISTS "lgpd_termos_admin_all" ON public.lgpd_termos;
DROP POLICY IF EXISTS "lgpd_aceites_select_own_or_admin" ON public.lgpd_aceites;
DROP POLICY IF EXISTS "lgpd_aceites_insert_own" ON public.lgpd_aceites;
DROP POLICY IF EXISTS "lgpd_aceites_admin_all" ON public.lgpd_aceites;

CREATE POLICY "lgpd_termos_select_authenticated"
  ON public.lgpd_termos
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "lgpd_termos_admin_all"
  ON public.lgpd_termos
  FOR ALL
  USING (COALESCE(public.current_user_perfil(), '') IN ('admin_total', 'admin_geral', 'admin_diretoria'))
  WITH CHECK (COALESCE(public.current_user_perfil(), '') IN ('admin_total', 'admin_geral', 'admin_diretoria'));

CREATE POLICY "lgpd_aceites_select_own_or_admin"
  ON public.lgpd_aceites
  FOR SELECT
  USING (
    usuario_id = auth.uid()
    OR COALESCE(public.current_user_perfil(), '') IN ('admin_total', 'admin_geral', 'admin_diretoria')
  );

CREATE POLICY "lgpd_aceites_insert_own"
  ON public.lgpd_aceites
  FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "lgpd_aceites_admin_all"
  ON public.lgpd_aceites
  FOR ALL
  USING (COALESCE(public.current_user_perfil(), '') IN ('admin_total', 'admin_geral', 'admin_diretoria'))
  WITH CHECK (COALESCE(public.current_user_perfil(), '') IN ('admin_total', 'admin_geral', 'admin_diretoria'));

INSERT INTO public.lgpd_termos (titulo, conteudo, versao, ativo)
SELECT
  'Termo de consentimento LGPD',
  $$TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS E COMPROMISSO DE RESPONSABILIDADE

Ao acessar o sistema do Clube de Desbravadores Fonseca, declaro estar ciente de que meus dados pessoais e, quando aplicável, dados de menores sob minha responsabilidade ou acompanhamento, poderão ser tratados para fins administrativos, pastorais, educacionais, organizacionais e de segurança do clube.

Os dados tratados podem incluir identificação, contato, data de nascimento, unidade, cargo, pontuação, participação em atividades, documentos entregues, imagens anexadas, foto de perfil e demais informações necessárias ao funcionamento do clube.

Comprometo-me a utilizar as informações disponíveis no sistema com responsabilidade, sigilo e finalidade legítima, não compartilhando dados, imagens ou documentos com terceiros não autorizados.

Declaro compreender que o tratamento dos dados observará a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD), sendo os dados utilizados apenas para as finalidades relacionadas às atividades do Clube de Desbravadores Fonseca.

Estou ciente de que o acesso ao sistema é pessoal e intransferível, e que ações realizadas com meu usuário poderão ser registradas para fins de segurança e auditoria.

Ao marcar o aceite, confirmo que li, compreendi e concordo com este termo.$$,
  1,
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.lgpd_termos WHERE ativo = TRUE);
