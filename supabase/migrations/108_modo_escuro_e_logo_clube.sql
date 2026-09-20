-- Modo escuro é preferência pessoal (por usuário), mesmo padrão de
-- configuracoes_visuais_usuario já usado pra cor de cabeçalho/relatórios.
ALTER TABLE public.configuracoes_visuais_usuario
  ADD COLUMN IF NOT EXISTS modo_escuro BOOLEAN NOT NULL DEFAULT FALSE;

-- Logo do clube — visível por todo mundo do clube, editável só por quem
-- administra o clube (tela Modelos).
ALTER TABLE public.clubes
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
