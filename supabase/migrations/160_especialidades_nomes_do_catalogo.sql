-- 160_especialidades_nomes_do_catalogo.sql
-- Duas especialidades concluidas estavam gravadas com um nome que nao existe no catalogo, entao nao contavam para
-- nenhum mestrado (o reconhecimento compara o nome da ficha com o do catalogo):
--   "Excursionismo de Pedestre com Mochila"  ->  "Excursionismo pedestre com mochila"   (Vida Campestre)
--   "Aventuras com Cristo (13/06)"           ->  "Aventuras com Cristo"                  (Testificacao)
-- Corrige so o NOME nos registros dos membros (status e demais dados ficam como estao), nunca quando o membro ja tem
-- a especialidade com o nome certo (evita duplicar), e reavalia todos os mestrados em seguida (idempotente).
-- O resultado mostra quantos registros foram ajustados e quantos mestrados novos foram encaminhados a diretoria.

CREATE TEMP TABLE IF NOT EXISTS _esp_nome_ajuste (membro text, de text, para text);
TRUNCATE _esp_nome_ajuste;

DO $$
DECLARE
  v_antes integer;
BEGIN
  SELECT count(*) INTO v_antes FROM public.mestrado_processos;

  WITH mapa(de_norm, para_nome) AS (
    VALUES ('excursionismo de pedestre com mochila', 'Excursionismo pedestre com mochila'),
           ('aventuras com cristo (13/06)',          'Aventuras com Cristo')
  ),
  alvo AS (
    SELECT e.id, e.dbv_id, e.nome AS de, mp.para_nome
    FROM public.especialidades e
    JOIN mapa mp ON public.mestrado_norm(e.nome) = mp.de_norm
    -- o nome novo precisa existir no catalogo e o membro nao pode ja tê-lo
    WHERE EXISTS (SELECT 1 FROM public.especialidades_modelo em WHERE public.mestrado_norm(em.nome) = public.mestrado_norm(mp.para_nome))
      AND NOT EXISTS (SELECT 1 FROM public.especialidades x
                      WHERE x.dbv_id = e.dbv_id AND public.mestrado_norm(x.nome) = public.mestrado_norm(mp.para_nome))
  ),
  ajustadas AS (
    UPDATE public.especialidades e SET nome = a.para_nome
    FROM alvo a WHERE e.id = a.id
    RETURNING e.dbv_id, a.de, a.para_nome
  )
  INSERT INTO _esp_nome_ajuste
  SELECT d.nome, j.de, j.para_nome FROM ajustadas j JOIN public.desbravadores d ON d.id = j.dbv_id;

  -- A troca de nome nao dispara o gatilho (ele so olha o status): reavalia todos agora.
  PERFORM public.mestrado_reavaliar_todos(NULL);

  INSERT INTO _esp_nome_ajuste VALUES ('(mestrados novos encaminhados a diretoria)', NULL,
    ((SELECT count(*) FROM public.mestrado_processos) - v_antes)::text);
END $$;

SELECT membro, de AS nome_antigo, para AS nome_novo FROM _esp_nome_ajuste ORDER BY membro NULLS LAST;
