-- Diagnóstico: por que a config de visibilidade do ranking não aplica pra
-- um DBV específico. NÃO altera nada — troque 'NOME DO DBV' pelo nome real
-- e rode. Me mande os 3 resultados.

-- 1) O clube desse DBV tem uma linha salva em config_ranking? Se "existe"
--    vier false, o app está caindo no padrão (tudo liberado) simplesmente
--    porque a configuração nunca foi salva pra esse clube.
SELECT
  d.nome,
  d.clube_id,
  EXISTS (SELECT 1 FROM public.config_ranking cr WHERE cr.clube_id = d.clube_id) AS existe_config,
  cr.membros_tipo_dbv, cr.membros_tipo_diretoria, cr.membros_tipo_conselheiros, cr.membros_tipo_unidades,
  cr.membros_ve_pontuacao, cr.membros_ve_posicao
FROM public.desbravadores d
LEFT JOIN public.config_ranking cr ON cr.clube_id = d.clube_id
WHERE d.nome ILIKE '%NOME DO DBV%';

-- 2) Esse DBV tem login próprio (usuario_clubes) vinculado ao clube dele,
--    ativo? Se "tem_vinculo_ativo" vier false, o app dele não consegue
--    passar em nenhuma policy que dependa de current_user_has_clube --
--    incluindo a leitura de config_ranking -- e cai no padrão liberado.
SELECT
  d.nome,
  u.email,
  uc.perfil,
  uc.ativo AS vinculo_ativo,
  uc.clube_id AS clube_do_vinculo,
  d.clube_id AS clube_do_membro,
  (uc.clube_id = d.clube_id AND uc.ativo) AS tem_vinculo_ativo
FROM public.desbravadores d
LEFT JOIN public.usuarios u ON u.dbv_id = d.id
LEFT JOIN public.usuario_clubes uc ON uc.usuario_id = u.id
WHERE d.nome ILIKE '%NOME DO DBV%';

-- 3) O perfil salvo no vínculo é mesmo um dos que a config de "membros
--    comuns" deveria cobrir? Fora dessa lista, o app trata como diretoria
--    (todos os tipos aparecem, é o comportamento esperado nesse caso).
--    Lista esperada: usuario_desbravador, usuario_aventureiro, usuario_pais, responsavel.
