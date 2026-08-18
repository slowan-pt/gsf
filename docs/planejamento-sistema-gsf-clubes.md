# GSF Clubes - Sistema de Gerenciamento de Clubes

**Subtítulo:** Aplicação web para clubes de Desbravadores e Aventureiros  
**Autor:** Sloan Nascimento  
**Data:** 20 de junho de 2026  
**Site em funcionamento:** https://gsf-clubes.pages.dev

## 1. Justificativa

O sistema GSF Clubes foi criado para atender uma necessidade prática de organização dos Clubes de Desbravadores e Aventureiros. Em muitos clubes, informações importantes ficam espalhadas em planilhas, conversas, papéis, fotos e controles manuais. Isso dificulta o acompanhamento de membros, documentos, pontuações, agenda, atividades, especialidades, classes e responsáveis.

O site é necessário para centralizar essas informações em um ambiente único, acessível por computador ou celular, com controle de permissões e segurança. Ele serve principalmente para a secretaria do clube, direção, conselheiros, instrutores, responsáveis/pais e membros juvenis, respeitando o que cada perfil pode acessar.

## 2. Objetivos

### Objetivo geral

Desenvolver um sistema web responsivo para facilitar a gestão de clubes de Desbravadores e Aventureiros, reunindo cadastro, documentos, pontuação, agenda, atividades, relatórios e acompanhamento formativo em uma plataforma única.

### Objetivos específicos

- Cadastrar, editar, inativar e consultar membros do clube.
- Gerenciar unidades, cargos, responsáveis e perfis de acesso.
- Controlar documentos entregues, pendentes ou não aplicáveis, com anexos seguros.
- Lançar pontuação individual, pontos extras e pontuação direta para unidades.
- Exibir rankings de membros, conselheiros, diretoria e unidades.
- Gerenciar agenda mensal de atividades do clube.
- Criar atividades avaliativas com anexos, respostas, correção, aprovação e histórico.
- Controlar especialidades e classes entregues ou a receber.
- Gerar relatórios administrativos e de secretaria.
- Permitir pré-cadastro externo com termo LGPD.
- Aplicar autenticação, permissões, MFA e aceite de termo de responsabilidade.

## 3. Desenvolvimento

### 3.1 Tecnologias principais

| Camada | Tecnologia | Função no sistema |
|---|---|---|
| Frontend | TypeScript, React Native Web e Expo | Criação das telas, navegação, formulários e interface responsiva. |
| Backend | Supabase | Autenticação, APIs automáticas, regras de acesso e funções RPC. |
| Banco de dados | PostgreSQL no Supabase | Armazena membros, clubes, usuários, pontuações, atividades, documentos e relatórios. |
| Arquivos | Supabase Storage | Guarda fotos, documentos, PDFs, imagens e anexos. |
| Hospedagem | Cloudflare Pages | Publica a versão web/PWA do sistema. |
| Segurança | RLS, MFA e LGPD | Controla acesso por usuário, dupla autenticação e aceite de termo. |
| Versionamento | Git | Registra histórico de alterações do código. |
| Deploy | Wrangler/Cloudflare CLI | Envia o sistema para publicação web. |

### 3.2 Páginas e menus do sistema

| Página/Menu | O que permite fazer |
|---|---|
| Login | Entrar no sistema com e-mail e senha, validar MFA quando exigido e aceitar termo LGPD. |
| Início/Dashboard | Ver resumo do clube, atalhos, aniversariantes, avisos e atividades pendentes. |
| Membros | Listar membros, abrir ficha individual, cadastrar, editar, inativar e consultar dados. |
| Ficha do membro | Gerenciar dados, documentos, responsáveis, classes, especialidades e itens a receber. |
| Responsáveis | Vincular responsáveis/pais aos membros e controlar o que podem acessar. |
| Unidades | Visualizar membros por unidade e gerenciar estrutura de unidades. |
| Pontuação | Lançar presença, pontualidade, material, uniforme e outros critérios configuráveis. |
| Pontuação de unidades | Lançar pontos diretamente para unidades e somar ao ranking de unidades. |
| Pontos extras | Lançar descontos ou pontos extras para membros selecionados. |
| Ranking | Ver classificação de membros, conselheiros, diretoria e unidades, com extratos. |
| Agenda | Exibir calendário mensal, cadastrar eventos e indicar atividades ou folgas. |
| Atividades | Criar atividades, anexar arquivos, receber respostas, devolver para correção e aprovar. |
| Modelos/Formativos | Cadastrar modelos de especialidades/classes com itens avaliativos. |
| Relatórios | Consultar e gerar relatórios de membros, documentos, especialidades, classes e clube. |
| Classe Bíblica | Acompanhar conteúdos, versos e progresso de classe bíblica. |
| Avisos/Mensagens | Enviar comunicados e permitir marcação como lido/não lido. |
| Pré-cadastro | Receber inscrições externas para aprovação pela secretaria. |
| Aparência | Ajustar paleta de cores e fontes do sistema por clube. |
| Administração/Auditoria | Acompanhar acessos, permissões, clubes e registros administrativos. |

### 3.3 Perfis de acesso

| Perfil | Acesso principal |
|---|---|
| admin_ti | Controle geral da plataforma, clubes, usuários, permissões e configurações técnicas. |
| admin_clube | Administração completa de um clube específico. |
| Secretaria do clube | Cadastro de membros, documentos, relatórios, pré-cadastros e controles de secretaria. |
| Diretoria | Gestão de atividades, agenda, acompanhamento de membros e ações administrativas permitidas. |
| Conselheiro | Acompanha sua unidade, pendências e progresso dos membros vinculados. |
| Instrutor/Avaliador | Corrige atividades, aprova ou devolve entregas e registra comentários. |
| Desbravador/Aventureiro | Visualiza suas atividades, ranking, agenda, avisos e progresso. |
| Pais/Responsáveis | Acompanha filhos vinculados, atividades pendentes e, quando liberado, documentos. |
| Tesouraria/Capelania/Pastor/Regional/Distrital | Perfis previstos para acessos específicos conforme necessidade do clube. |

### 3.4 Segurança e privacidade

O sistema trabalha com dados sensíveis, por isso utiliza autenticação por e-mail e senha, controle de sessão, permissões por perfil, MFA para perfis administrativos, aceite de termo LGPD e regras de acesso no banco de dados. Os documentos anexados têm visualização restrita aos perfis autorizados.

### 3.5 Funcionamento esperado do site

O usuário acessa o site em https://gsf-clubes.pages.dev, faz login e é direcionado ao contexto correto do clube. A partir do perfil, o sistema libera apenas os menus permitidos. Administradores e secretaria podem gerenciar dados; membros e responsáveis visualizam apenas o que lhes pertence ou foi liberado.

## 4. Conclusão

Espera-se que o GSF Clubes facilite a organização administrativa e pedagógica dos clubes, reduzindo controles manuais, melhorando o acompanhamento dos membros e aumentando a segurança das informações. O sistema também permite que a direção tenha uma visão mais clara de documentos, pontuações, atividades, especialidades, classes e pendências.

Com o site funcionando, o clube passa a ter uma ferramenta centralizada, acessível e escalável, podendo atender tanto Desbravadores quanto Aventureiros, com possibilidade de expansão para novos clubes no futuro.

## 5. Roteiro para apresentação ao instrutor

1. Abrir o documento e apresentar a justificativa do projeto.
2. Acessar o site: https://gsf-clubes.pages.dev.
3. Mostrar a tela de login, segurança e perfis.
4. Entrar no dashboard e apresentar os atalhos principais.
5. Demonstrar a ficha de um membro, incluindo dados, documentos e responsáveis.
6. Mostrar pontuação, ranking, agenda e atividades.
7. Finalizar explicando os relatórios, permissões e benefícios para o clube.
