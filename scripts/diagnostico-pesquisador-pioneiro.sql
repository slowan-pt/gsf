-- Diagnóstico: confere se as linhas de Pesquisador/Pioneiro (e avançadas)
-- ainda existem no catálogo, e se estão ativas ou não.
-- Rode isto no SQL Editor do Supabase e me mande o resultado.
SELECT classe_nome, ativo, count(*) AS linhas
FROM public.classes_requisitos_catalogo
WHERE classe_nome IN (
  'Pesquisador', 'Pioneiro',
  'Pesquisador de Campos e Bosques', 'Pioneiro de Novas Fronteiras'
)
GROUP BY classe_nome, ativo
ORDER BY classe_nome, ativo;
