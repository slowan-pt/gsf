-- O ID do SGC identifica uma pessoa: não pode se repetir em dois cadastros.
-- Se já existir ID repetido, a migration PARA e mostra quais são (nada é alterado);
-- corrija os cadastros pela ficha do membro e rode de novo.
DO $$
DECLARE
  repetidos text;
BEGIN
  SELECT string_agg(x.id_sgc || ' → ' || x.nomes, E'\n')
    INTO repetidos
  FROM (
    SELECT btrim(id_sgc) AS id_sgc, string_agg(nome || ' (#' || id || ')', ', ' ORDER BY id) AS nomes
    FROM public.desbravadores
    WHERE id_sgc IS NOT NULL AND btrim(id_sgc) <> ''
    GROUP BY btrim(id_sgc)
    HAVING count(*) > 1
  ) x;

  IF repetidos IS NOT NULL THEN
    RAISE EXCEPTION E'Existem IDs do SGC repetidos; corrija e rode de novo:\n%', repetidos;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS desbravadores_id_sgc_unico
    ON public.desbravadores (btrim(id_sgc))
    WHERE id_sgc IS NOT NULL AND btrim(id_sgc) <> '';
END $$;
