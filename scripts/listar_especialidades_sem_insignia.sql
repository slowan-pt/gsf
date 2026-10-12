-- Especialidades ativas do programa Desbravadores que ainda nao tem insignia (imagem).
-- Somente leitura. Rode no SQL Editor do Supabase.
SELECT em.codigo,
       em.nome,
       em.area,
       em.nivel,
       em.insignia_url
  FROM public.especialidades_modelo em
 WHERE em.programa_id = (SELECT id FROM public.programas WHERE nome ILIKE '%desbravador%' ORDER BY id LIMIT 1)
   AND COALESCE(em.ativo, true)
   AND (em.insignia_url IS NULL OR btrim(em.insignia_url) = '')
 ORDER BY em.codigo;
