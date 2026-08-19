-- Atualiza o termo LGPD para refletir o escopo real do sistema.
-- Criar uma nova versão ativa obriga novo aceite no próximo login.

DO $$
DECLARE
  v_conteudo TEXT := $termo$
TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS E COMPROMISSO DE RESPONSABILIDADE

Ao acessar o Sistema de Gerenciamento de Clubes, declaro que li e compreendi este termo e autorizo o tratamento dos dados pessoais necessários para a gestão de clubes de Desbravadores e Aventureiros.

1. Finalidades do sistema

Os dados serão utilizados para cadastro e atualização de membros, responsáveis e diretoria; organização por clubes, unidades e funções; controle de documentos; agenda; presença; pontuação e ranking; atividades; classes; especialidades; relatórios; mensagens; notificações; auditoria; controle de acesso; segurança e demais rotinas administrativas, educacionais, pastorais e operacionais do clube.

2. Dados que podem ser tratados

O sistema poderá tratar dados como nome, e-mail, telefone, data de nascimento, sexo, foto de perfil, unidade, cargo, função adicional, tipo de acesso, informações de responsáveis, vínculo entre pais/responsáveis e filhos, histórico de pontuação, rankings, agenda, atividades, respostas enviadas, anexos, classes, especialidades, termos aceitos, logs de auditoria e registros de acesso.

Quando necessário para a rotina do clube, também poderão ser tratados documentos e imagens anexadas, como RG, CPF, autorizações, fichas, comprovantes, informações médicas ou outros documentos solicitados pela secretaria do clube.

3. Dados de crianças e adolescentes

Estou ciente de que o sistema pode conter dados de crianças e adolescentes vinculados ao clube. Esses dados devem ser utilizados somente para as finalidades legítimas do clube e com atenção especial à proteção, confidencialidade e segurança.

4. Acesso aos dados

O acesso às informações é controlado por perfil e vínculo com o clube. Administradores autorizados, secretaria e perfis liberados poderão acessar os dados necessários às suas funções. Conselheiros e demais usuários terão acesso limitado conforme suas permissões. Arquivos e imagens de documentos não devem ser visualizados por quem não possuir permissão específica.

5. Responsabilidade do usuário

Comprometo-me a manter sigilo sobre as informações acessadas, não compartilhar documentos, imagens, relatórios, dados pessoais ou credenciais com pessoas não autorizadas, não utilizar os dados para finalidades particulares ou externas ao clube e comunicar imediatamente qualquer suspeita de acesso indevido.

Declaro que minhas credenciais de acesso, senha e códigos de autenticação em dois fatores são pessoais e intransferíveis. As ações realizadas com meu usuário poderão ser registradas para fins de segurança, auditoria e responsabilização.

6. Segurança, armazenamento e retenção

Os dados serão armazenados em ambiente digital com controles de acesso, autenticação, permissões por perfil, registros de auditoria e regras de segurança para anexos e documentos. Os dados poderão ser mantidos enquanto forem necessários para participação no clube, obrigações administrativas, histórico institucional, prestação de contas, segurança e cumprimento de obrigações legais ou regulatórias.

7. Direitos do titular

O titular dos dados ou seu responsável legal poderá solicitar à administração do clube informações sobre seus dados, correção, atualização, revisão de permissões, revogação de consentimento ou exclusão quando aplicável, observadas as necessidades administrativas, legais e de segurança do clube.

8. Consentimento

Ao marcar o aceite, confirmo que li, compreendi e concordo com este termo, autorizando o tratamento dos dados pessoais para as finalidades descritas e assumindo o compromisso de responsabilidade pelo uso correto das informações acessadas no sistema.
$termo$;
  v_versao INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.lgpd_termos
    WHERE ativo = TRUE
      AND titulo = 'Termo de consentimento LGPD e responsabilidade'
      AND conteudo = v_conteudo
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(versao), 0) + 1
    INTO v_versao
    FROM public.lgpd_termos;

  UPDATE public.lgpd_termos
     SET ativo = FALSE,
         updated_at = NOW()
   WHERE ativo = TRUE;

  INSERT INTO public.lgpd_termos (titulo, conteudo, versao, ativo, created_at, updated_at)
  VALUES (
    'Termo de consentimento LGPD e responsabilidade',
    v_conteudo,
    v_versao,
    TRUE,
    NOW(),
    NOW()
  );
END $$;
