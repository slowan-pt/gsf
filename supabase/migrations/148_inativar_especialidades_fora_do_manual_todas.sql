-- Especialidades fora do Manual 2025: inativas para todos, inclusive as que algum membro ja tem.
-- Quem ja tem a especialidade continua com ela na ficha e na faixa (o registro do membro nao e tocado);
-- ela so deixa de ser oferecida no catalogo. "ativo = false" e reversivel.
UPDATE public.especialidades_modelo em
SET ativo = FALSE, updated_at = now()
WHERE em.programa_id = (SELECT id FROM public.programas WHERE nome ILIKE '%desbravador%' ORDER BY id LIMIT 1)
  AND em.ativo = TRUE
  AND public.mestrado_norm(em.nome) IN (
    SELECT public.mestrado_norm(n) FROM unnest(ARRAY[
      'Desfile com Carros Alegóricos - avançado', 'Datilografia', 'Radioeletrônica', 'Radioamadorismo - avançado',
      'Mecânica Automotiva - avançado', 'Serviço Rádio do Cidadão', 'Bandeiras Náuticas', 'Blogs', 'Torno Mecânico',
      'Filatelia - avançado', 'Esqui Downhill', 'Esqui Aquático - avançado', 'Mergulho Autônomo - avançado',
      'Barco a Motor', 'Arco e Flecha - avançado', 'Ginástica Acrobática - avançado', 'Esqui Cross Country', 'Windsurf',
      'Equitação - avançado', 'Triathlon - avançado', 'Telecartofilia', 'Telecartofilia - avançado', 'Wakeboard',
      'Letterboxing', 'Letterboxing - avançado', 'Monociclo', 'Excursionismo Pedestre na Neve - avançado',
      'Bioquímica - avançado', 'Habilidades em Matemática III', 'Habilidades em Matemática IV', 'Geologia - avançado',
      'Espaçomodelismo - avançado', 'Esmaltado em Cobre - avançado', 'Corrida de Carrinhos de Madeira - avançado',
      'Apitos - avançado', 'Faróis - avançado', 'Balões de Ar Quente']) n)
;
