-- Imagens dos 16 mestrados (arquivos em public/mestrados, publicados junto com a web).
-- So preenche quem ainda nao tem imagem; nao sobrescreve o que o ADMIN TI ja enviou.
UPDATE public.mestrados m
SET imagem_url = v.url
FROM (VALUES
  ('ME-001', 'https://dbvplus.pages.dev/mestrados/me-001.png'),
  ('ME-002', 'https://dbvplus.pages.dev/mestrados/me-002.png'),
  ('ME-003', 'https://dbvplus.pages.dev/mestrados/me-003.png'),
  ('ME-004', 'https://dbvplus.pages.dev/mestrados/me-004.png'),
  ('ME-005', 'https://dbvplus.pages.dev/mestrados/me-005.png'),
  ('ME-006', 'https://dbvplus.pages.dev/mestrados/me-006.png'),
  ('ME-007', 'https://dbvplus.pages.dev/mestrados/me-007.png'),
  ('ME-008', 'https://dbvplus.pages.dev/mestrados/me-008.png'),
  ('ME-009', 'https://dbvplus.pages.dev/mestrados/me-009.png'),
  ('ME-010', 'https://dbvplus.pages.dev/mestrados/me-010.png'),
  ('ME-011', 'https://dbvplus.pages.dev/mestrados/me-011.png'),
  ('ME-012', 'https://dbvplus.pages.dev/mestrados/me-012.png'),
  ('ME-013', 'https://dbvplus.pages.dev/mestrados/me-013.png'),
  ('ME-014', 'https://dbvplus.pages.dev/mestrados/me-014.png'),
  ('ME-015', 'https://dbvplus.pages.dev/mestrados/me-015.png'),
  ('ME-016', 'https://dbvplus.pages.dev/mestrados/me-016.png')
) AS v(codigo, url)
WHERE m.codigo = v.codigo
  AND (m.imagem_url IS NULL OR btrim(m.imagem_url) = '');
