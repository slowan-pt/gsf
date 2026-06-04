-- Corrige clones limpos onde migrations antigas criaram atividades.id como UUID.
-- O app atual e as migrations de fluxo usam IDs numericos para atividades.

DO $$
DECLARE
  atividades_id_type text;
BEGIN
  SELECT data_type
  INTO atividades_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'atividades'
    AND column_name = 'id';

  IF atividades_id_type = 'uuid' THEN
    DROP TABLE IF EXISTS public.atividades_mensagens CASCADE;
    DROP TABLE IF EXISTS public.atividades_alvos CASCADE;
    DROP TABLE IF EXISTS public.atividades_anexos CASCADE;
    DROP TABLE IF EXISTS public.atividades_respostas CASCADE;
    DROP TABLE IF EXISTS public.atividades CASCADE;

    CREATE TABLE public.atividades (
      id bigserial PRIMARY KEY,
      clube_id integer REFERENCES public.clubes(id),
      titulo text NOT NULL,
      descricao text,
      data text,
      destino text NOT NULL DEFAULT 'todos',
      unidade_id integer,
      unidade_nome text,
      dbv_id integer REFERENCES public.desbravadores(id) ON DELETE SET NULL,
      dbv_nome text,
      criado_por text,
      avaliador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      avaliador_nome text,
      item_formativo_tipo text,
      item_formativo_nome text,
      gera_investidura boolean DEFAULT false,
      plano_formativo_id bigint,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE public.atividades_anexos (
      id bigserial PRIMARY KEY,
      clube_id integer REFERENCES public.clubes(id),
      atividade_id bigint NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
      nome text NOT NULL,
      url text NOT NULL,
      tipo text DEFAULT 'outro',
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE public.atividades_respostas (
      id bigserial PRIMARY KEY,
      clube_id integer REFERENCES public.clubes(id),
      atividade_id bigint NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
      dbv_id integer NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
      dbv_nome text,
      texto text,
      anexo_url text,
      anexo_nome text,
      status text NOT NULL DEFAULT 'entregue',
      nota numeric,
      comentario_avaliador text,
      avaliado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      avaliado_em timestamptz,
      reaberto_ate timestamptz,
      entregue_em timestamptz,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE (atividade_id, dbv_id)
    );

    ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.atividades_anexos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.atividades_respostas ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
