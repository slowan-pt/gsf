-- Itens concluídos que devem ser entregues na próxima investidura
-- e correção de status de documentos importados como OK sem anexo.

CREATE TABLE IF NOT EXISTS public.investidura_itens (
  id BIGSERIAL PRIMARY KEY,
  clube_id INTEGER NOT NULL REFERENCES public.clubes(id) ON DELETE CASCADE,
  dbv_id INTEGER NOT NULL REFERENCES public.desbravadores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('classe', 'especialidade')),
  item_nome TEXT NOT NULL,
  marcado BOOLEAN NOT NULL DEFAULT TRUE,
  entregue BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clube_id, dbv_id, tipo, item_nome)
);

ALTER TABLE public.investidura_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investidura_itens_select_clube" ON public.investidura_itens;
CREATE POLICY "investidura_itens_select_clube"
ON public.investidura_itens
FOR SELECT
TO authenticated
USING (
  public.current_user_can_admin_clube(clube_id)
  OR EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.dbv_id = investidura_itens.dbv_id
  )
);

DROP POLICY IF EXISTS "investidura_itens_admin_all" ON public.investidura_itens;
CREATE POLICY "investidura_itens_admin_all"
ON public.investidura_itens
FOR ALL
TO authenticated
USING (public.current_user_can_admin_clube(clube_id))
WITH CHECK (public.current_user_can_admin_clube(clube_id));

-- A regra atual é: Entregue (OK) só conta quando há anexo.
-- "Não se aplica" continua contando como resolvido.
UPDATE public.documento_status ds
SET status = NULL,
    updated_at = now()
WHERE ds.status = 'OK'
  AND NOT EXISTS (
    SELECT 1
    FROM public.documento_imagens di
    WHERE di.clube_id = ds.clube_id
      AND di.dbv_id = ds.dbv_id
      AND di.campo = ds.campo
  );

DELETE FROM public.documento_status
WHERE status IS NULL;

DO $$
DECLARE
  col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'rg','cpf','rg_resp','cartao_sus','cartao_plano','ficha_saude',
    'carteira_vacinacao','laudo_medico','ficha_reg','comp_residencia',
    'aut_saida','aut_viagem','ri_assinado','foto','ant_criminais'
  ]
  LOOP
    EXECUTE format(
      'UPDATE public.documentos d
          SET %I = NULL,
              updated_at = now()
        WHERE %I = %L
          AND NOT EXISTS (
            SELECT 1
            FROM public.documento_imagens di
            WHERE di.clube_id = d.clube_id
              AND di.dbv_id = d.dbv_id
              AND di.campo = %L
          )',
      col,
      col,
      'OK',
      col
    );
  END LOOP;
END $$;
