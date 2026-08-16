-- 075_normaliza_tipo_classes_modelo.sql
-- O campo classes_modelo.tipo era texto livre e foi preenchido de formas
-- diferentes ("avançada", "avançado", vazio), o que fazia a mesma categoria
-- aparecer repetida na tela do catálogo. Padroniza em três valores:
-- Regulares, Avançadas e Líder.
--
-- A tela já classifica pelo nome da classe, então ela funciona mesmo sem esta
-- migração — isto aqui acerta o dado guardado.

-- 1) Liderança primeiro: "Líder Máster Avançado" é liderança, não avançada.
UPDATE public.classes_modelo
SET tipo = 'Líder'
WHERE lower(nome) LIKE '%lider%' OR lower(nome) LIKE '%líder%';

-- 2) Avançadas, pelos nomes oficiais (aceita as duas grafias de Pesquisador).
UPDATE public.classes_modelo
SET tipo = 'Avançadas'
WHERE tipo IS DISTINCT FROM 'Líder'
  AND nome IN (
    'Amigo da Natureza',
    'Companheiro de Excursionismo',
    'Pesquisador de Campos e Bosques',
    'Pesquisador de Campo e Bosque',
    'Pioneiro de Novas Fronteiras',
    'Excursionista na Mata',
    'Guia de Exploração'
  );

-- 3) Todo o resto vira Regulares.
UPDATE public.classes_modelo
SET tipo = 'Regulares'
WHERE tipo IS NULL OR tipo NOT IN ('Líder', 'Avançadas');
