-- Confere se todas as partes do seed do Ano Bíblico foram aplicadas.
-- Esperado: catalogo=367, textos=1612, pares_distintos=403,
-- pt=403, en=403, fr=403, es=403 (todas as colunas com os mesmos números).

SELECT
  (SELECT COUNT(*) FROM public.ano_biblico_catalogo) AS catalogo,
  (SELECT COUNT(*) FROM public.ano_biblico_textos) AS textos,
  (SELECT COUNT(DISTINCT (livro_abrev, capitulo)) FROM public.ano_biblico_textos) AS pares_distintos,
  (SELECT COUNT(*) FROM public.ano_biblico_textos WHERE idioma = 'pt') AS pt,
  (SELECT COUNT(*) FROM public.ano_biblico_textos WHERE idioma = 'en') AS en,
  (SELECT COUNT(*) FROM public.ano_biblico_textos WHERE idioma = 'fr') AS fr,
  (SELECT COUNT(*) FROM public.ano_biblico_textos WHERE idioma = 'es') AS es;

-- Se "textos" for menor que 1612, esta query mostra exatamente quais
-- (livro, capítulo, idioma) faltaram, comparando com o catálogo:
SELECT DISTINCT p.livro_abrev, p.capitulo, i.idioma
FROM public.ano_biblico_catalogo c
CROSS JOIN LATERAL jsonb_to_recordset(c.passagens) AS p(livro_abrev text, capitulo int, verso_ini int, verso_fim int)
CROSS JOIN (VALUES ('pt'), ('en'), ('fr'), ('es')) AS i(idioma)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ano_biblico_textos t
  WHERE t.livro_abrev = p.livro_abrev AND t.capitulo = p.capitulo AND t.idioma = i.idioma
)
ORDER BY 1, 2, 3;
