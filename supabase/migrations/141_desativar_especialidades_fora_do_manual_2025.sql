-- O Manual de Especialidades 2025 (DSA) tem 518 especialidades. O catalogo tinha 555: estas 37 nao
-- constam na edicao (itens antigos ou variantes "avancado" que deixaram de existir). Desativa (nao apaga)
-- as que nenhum membro registrou; "ativo = false" e reversivel. Quem ja tem alguma registrada continua
-- ativa, para nao quebrar o historico (hoje: Apitos - avancado).
UPDATE public.especialidades_modelo em
SET ativo = FALSE
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
  AND NOT EXISTS (
    SELECT 1 FROM public.especialidades e WHERE public.mestrado_norm(e.nome) = public.mestrado_norm(em.nome))
  AND NOT EXISTS (
    SELECT 1 FROM public.mestrado_especialidades me WHERE me.especialidade_id = em.id);
