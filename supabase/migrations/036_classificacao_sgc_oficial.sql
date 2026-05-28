-- Classificacao SGC / 5 Estrelas.
-- Mantem este score separado dos rankings de membros, unidades, ARF e Campori.

INSERT INTO public.ranking_clubes_niveis
  (programa_id, escopo, nome, pontos_min, pontos_max, estrelas, cor, ordem, ativo)
SELECT
  programa_id, 'SGC', nome, pontos_min, pontos_max, estrelas, cor, ordem, TRUE
FROM (VALUES (1), (2)) AS programas(programa_id)
CROSS JOIN (VALUES
  ('5 estrelas', 800, NULL::numeric, 5, '#f6c344', 1),
  ('4 estrelas', 500, 799,           4, '#9ca3af', 2),
  ('3 estrelas', 300, 499,           3, '#cd7f32', 3),
  ('2 estrelas', 150, 299,           2, '#4f8edb', 4),
  ('1 estrela',    0, 149,           1, '#78909c', 5)
) AS niveis(nome, pontos_min, pontos_max, estrelas, cor, ordem)
ON CONFLICT (programa_id, escopo, nome) DO UPDATE SET
  pontos_min = EXCLUDED.pontos_min,
  pontos_max = EXCLUDED.pontos_max,
  estrelas = EXCLUDED.estrelas,
  cor = EXCLUDED.cor,
  ordem = EXCLUDED.ordem,
  ativo = TRUE;

INSERT INTO public.ranking_clubes_requisitos
  (programa_id, escopo, item_codigo, requisito, estrategia, onde_cadastrar,
   pontuacao_maxima, prazo, observacoes, ordem, ativo)
SELECT
  programas.programa_id,
  'SGC',
  criterios.item_codigo,
  criterios.requisito,
  criterios.estrategia,
  criterios.onde_cadastrar,
  criterios.pontuacao_maxima,
  NULL,
  criterios.observacoes,
  criterios.ordem,
  TRUE
FROM (VALUES (1), (2)) AS programas(programa_id)
CROSS JOIN (VALUES
  ('1', 'Seguro anual',
    '100% dos membros ativos inseridos no seguro anual vigente; a liderança não contabiliza.',
    'Documentos / Seguro anual', 150, 'Comprovação anual conforme regra SGC.', 1),
  ('2', 'Inventário de patrimônio (bens)',
    'Quantidade de bens cadastrados correspondente a 30% do total de membros ativos.',
    'Classificação / Comprovações', 25, 'Comprovação manual até existir módulo de patrimônio.', 2),
  ('3', 'Agenda de atividades',
    '48 atividades cadastradas no ano vigente.',
    'Agenda', 50, 'Integrável com a agenda do clube.', 3),
  ('4', 'Documentos',
    'Possuir no mínimo 10 documentos estáticos ou dinâmicos.',
    'Membros / Documentos', 25, 'Comprovação pelos documentos cadastrados.', 4),
  ('5', 'Tesouraria',
    'Mínimo de 48 itens de contas a pagar ou a receber no ano vigente.',
    'Classificação / Comprovações', 50, 'Comprovação manual até existir módulo financeiro.', 5),
  ('6', 'Cantinho da Unidade - Ranking de Unidades',
    '100% dos membros ativos com dados preenchidos no relatório do Cantinho da Unidade.',
    'Unidades / Pontuação', 150, 'Integrável com a gestão das unidades.', 6),
  ('7', 'Especialidades',
    'No mínimo 5 especialidades por cada membro ativo.',
    'Membros / Especialidades', 25, 'Integrável com especialidades entregues.', 7),
  ('8', 'Classes',
    'No mínimo 1 classe por membro ativo; liderança não contabiliza.',
    'Membros / Classes', 25, 'Integrável com classes entregues.', 8),
  ('9', 'Cartões de Classes',
    '100% dos membros ativos, exceto liderança, com requisitos de classes parcialmente preenchidos.',
    'Membros / Classes', 100, 'Integrável com progresso de classes.', 9),
  ('10', 'Atualização de cadastros',
    '100% dos membros ativos com cadastro revisado no ano vigente.',
    'Membros', 50, 'A revisão precisa registrar data anual.', 10),
  ('11', 'Ficha médica',
    '100% dos membros ativos com fichas médicas atualizadas.',
    'Membros / Documentos', 75, 'Documento sensível sujeito às permissões vigentes.', 11),
  ('12', 'Dados do clube',
    'Dados do clube atualizados, incluindo coordenadas e histórico.',
    'Admin / Clubes', 25, 'Critério binário: 0 ou 25 pontos.', 12),
  ('13', 'Ranking do Campo',
    'Clube preenchendo 100% de um ranking do campo com no mínimo 20 requisitos.',
    'Ranking Campo', 150, 'Mantido separado da Classificação SGC.', 13),
  ('14', 'Termos de Adesão',
    '100% dos membros ativos com autorizações coletadas.',
    'LGPD / Documentos', 50, 'Integrável com termos e consentimentos.', 14),
  ('15', 'Acessos do Secretário do Clube',
    'Secretário ativo com no mínimo 48 acessos no ano, média de 4 por mês.',
    'Auditoria', 50, 'Integrável com registros de acesso.', 15)
) AS criterios(item_codigo, requisito, estrategia, onde_cadastrar, pontuacao_maxima, observacoes, ordem)
ON CONFLICT (programa_id, escopo, item_codigo) DO UPDATE SET
  requisito = EXCLUDED.requisito,
  estrategia = EXCLUDED.estrategia,
  onde_cadastrar = EXCLUDED.onde_cadastrar,
  pontuacao_maxima = EXCLUDED.pontuacao_maxima,
  prazo = NULL,
  observacoes = EXCLUDED.observacoes,
  ordem = EXCLUDED.ordem,
  ativo = TRUE,
  updated_at = NOW();

INSERT INTO public.ranking_clubes_pontuacoes (clube_id, requisito_id, pontos_atuais)
SELECT c.id, r.id, 0
FROM public.clubes c
JOIN public.ranking_clubes_requisitos r
  ON r.programa_id = c.programa_id
 AND r.escopo = 'SGC'
 AND r.ativo = TRUE
ON CONFLICT (clube_id, requisito_id) DO NOTHING;
