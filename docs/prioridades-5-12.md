# Prioridades 5 a 12 - Preparação de Implementação

Este arquivo organiza a próxima etapa da plataforma multi-clube. A regra continua sendo: não quebrar o Clube Fonseca atual enquanto a estrutura evolui para Desbravadores e Aventureiros.

## 5. Normalização de Membros

Objetivo: começar a transição de `desbravadores` para uma tabela genérica `membros`.

Preparado:

- tabela sombra `membros`;
- coluna `legacy_desbravador_id` para manter compatibilidade;
- view `v_membros` para leitura padronizada;
- carga inicial copiando dados atuais de `desbravadores`;
- RLS por clube, próprio membro e responsável.

Implementação futura:

- trocar leituras aos poucos de `desbravadores` para `v_membros`;
- manter escrita dupla temporária;
- só depois aposentar dependências diretas de `desbravadores`.

## 6. Responsáveis, Pais e Janelas de Documentos

Objetivo: permitir que pais/responsáveis acessem filhos vinculados e, quando autorizado, editem documentos por prazo definido.

Preparado:

- `responsavel_membros` já existe;
- `documentos_pais_config` já existe;
- `usuario_pais` já existe como perfil conhecido;
- matriz de permissão documentada.

Implementação futura:

- tela para vincular pai/responsável ao filho;
- tela para abrir/fechar janela de envio de documentos;
- aplicar a janela na tela de documentos do membro;
- registrar auditoria de anexos enviados por pais.

## 7. Onboarding de Novos Clubes

Objetivo: cadastrar clube novo com programa, identidade visual, unidades, pontuações e documentos padrão.

Preparado:

- `programas`, `clubes`, `classes_modelo`, `cargos_modelo`, `documentos_modelo`, `pontuacao_itens`;
- tela inicial de clubes;
- tabela `clubes_onboarding_status`.

Implementação futura:

- assistente passo a passo;
- clonar modelos de programa para o clube;
- criar unidades iniciais;
- convidar primeiro admin do clube.

## 8. Importação Multi-Clube

Objetivo: importar membros, agenda, pontuação e documentos em lote sem misturar clubes.

Preparado:

- tabelas `importacoes_lote` e `importacoes_lote_itens`;
- cada importação guarda `clube_id`, `programa_id`, status e resumo;
- estrutura pronta para validação linha a linha.

Implementação futura:

- ajustar tela de importação para criar um lote;
- validar colunas antes de gravar;
- exibir erros por linha;
- permitir reprocessar somente itens com erro.

## 9. Relatórios Multi-Clube

Objetivo: relatórios prontos por clube, programa, unidade e perfil.

Preparado:

- tabela `relatorios_modelo`;
- modelos iniciais para membros, documentos e pontuação;
- escopo por programa/clube.

Implementação futura:

- filtros por clube e programa;
- relatórios de responsáveis/filhos;
- relatórios de documentação por status;
- exportação PDF/Excel.

## 10. Arquivos e Storage Multi-Clube

Objetivo: padronizar metadados de anexos para documentos, atividades, fotos e respostas.

Preparado:

- tabela `arquivos_registro`;
- vínculo por `clube_id`, `programa_id`, `membro_id`, `tipo_entidade`;
- suporte a confidencialidade.

Implementação futura:

- registrar todo upload nessa tabela;
- padronizar caminhos no Storage por clube;
- aplicar RLS fina por tipo de arquivo;
- criar limpeza segura de arquivos órfãos.

## 11. Auditoria e Segurança

Objetivo: registrar alterações sensíveis para LGPD e gestão.

Preparado:

- tabela `auditoria_eventos`;
- função `registrar_auditoria`;
- campos para ator, clube, membro, ação e metadados.

Implementação futura:

- registrar alteração de perfil;
- registrar upload/exclusão de documentos;
- registrar aceite LGPD;
- registrar reset de MFA;
- criar tela de auditoria para `admin_ti` e `admin_clube`.

## 12. QA, Publicação e Operação

Objetivo: deixar a evolução previsível.

Preparado:

- esta fila numerada;
- migrações separadas por fase;
- caminho de deploy já estabilizado no Cloudflare Pages.

Implementação futura:

- checklist de teste por perfil;
- testes mínimos de login, MFA, membro, pontuação, agenda e documentos;
- rotina de deploy com smoke test;
- painel simples de saúde do sistema.

