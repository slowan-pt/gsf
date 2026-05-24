# Modelagem Multi-Clube

Este documento define a evolução do sistema Fonseca para uma plataforma multi-clube, preparada inicialmente para dois programas:

- Desbravadores
- Aventureiros

O objetivo é permitir vários clubes usando a mesma aplicação e o mesmo banco, com isolamento seguro de dados por clube.

## Decisões Fechadas

### Programas Atendidos

Por enquanto, o sistema atenderá somente:

- Clube de Desbravadores
- Clube de Aventureiros

Outros tipos de ministério ou clube ficam fora do escopo inicial.

### Clube e Programa

Cada clube pertence a exatamente um programa.

Exemplos:

- Clube Fonseca - Desbravadores
- Clube Fonseca - Aventureiros

Mesmo que estejam na mesma igreja e tenham o mesmo nome-base, serão clubes diferentes no sistema.

### Usuário em Mais de Um Clube

Um mesmo usuário poderá participar de mais de um clube.

Exemplos:

- Uma pessoa da diretoria pode atuar no clube de Desbravadores e no clube de Aventureiros.
- Um pastor pode acompanhar vários clubes.
- Um regional ou distrital pode acompanhar vários clubes.
- Um responsável pode ter filhos em clubes diferentes.
- Uma mesma pessoa pode ser diretoria em um clube e, ao mesmo tempo, responsável por um filho em outro clube.

Um membro infantil/juvenil comum não deve ser simultaneamente desbravador e aventureiro, porque as faixas etárias são incompatíveis.

### Nome Comercial

Por enquanto o app pode continuar com a identidade Fonseca.

Para trocar depois sem quebrar a estrutura, a marca visual deve sair de configuração:

- nome da plataforma
- logo
- cores
- textos de login
- favicon/ícone

Isso permite mudar de "Fonseca" para um nome mais amplo no futuro.

## Programas

Tabela sugerida: `programas`

Campos:

- `id`
- `codigo`
- `nome`
- `idade_minima_membro`
- `idade_maxima_membro`
- `idade_minima_diretoria`
- `ativo`

Dados iniciais:

| codigo | nome | idade_minima_membro | idade_maxima_membro | idade_minima_diretoria |
|---|---|---:|---:|---:|
| `desbravadores` | Desbravadores | 10 | 15 | 16 |
| `aventureiros` | Aventureiros | 6 | 9 | 16 |

## Clubes

Tabela sugerida: `clubes`

Campos:

- `id`
- `programa_id`
- `nome`
- `nome_curto`
- `codigo`
- `igreja`
- `distrito`
- `regional`
- `cidade`
- `uf`
- `logo_url`
- `cor_primaria`
- `cor_secundaria`
- `ativo`
- `created_at`
- `updated_at`

Regra:

- Todo registro operacional do sistema deve pertencer a um `clube_id`.
- O clube define qual programa será usado.

## Usuários, Papéis e Vínculos

O usuário representa somente a identidade de login.

Ele não deve ter um único perfil global definitivo, porque a mesma pessoa pode acumular papéis diferentes.

Exemplo real:

- Diretor no clube de Desbravadores.
- Conselheiro no clube de Aventureiros.
- Pastor com acesso a vários clubes.
- Pai de um aventureiro.
- Pai de um desbravador.

Essas relações precisam ser vínculos paralelos.

Tabela: `usuarios`

Campos principais:

- `id`
- `email`
- `nome`
- `foto_url`
- `ativo`
- `created_at`

### Papéis Operacionais no Clube

Os papéis administrativos, pastorais e operacionais ficam em `usuario_clubes`.

Tabela sugerida: `usuario_clubes`

Campos:

- `id`
- `usuario_id`
- `clube_id`
- `membro_id`
- `perfil`
- `unidade_id`
- `ativo`
- `created_at`
- `updated_at`

Com isso, a mesma pessoa pode ter perfis diferentes em clubes diferentes, ou até mais de um papel no mesmo clube quando necessário.

Exemplo:

| usuario | clube | perfil |
|---|---|---|
| João | Fonseca DBV | `usuario_diretoria` |
| João | Fonseca Aventureiros | `usuario_conselheiro` |
| Pastor Carlos | Fonseca DBV | `usuario_pastor` |
| Pastor Carlos | Fonseca Aventureiros | `usuario_pastor` |

### Vínculo Familiar/Responsável

Ser pai, mãe ou responsável não deve ser tratado como perfil único do usuário.

É um vínculo entre `usuario` e `membro`.

Tabela sugerida: `responsavel_membros`

Campos:

- `id`
- `usuario_id`
- `membro_id`
- `clube_id`
- `programa_id`
- `parentesco`
- `responsavel_principal`
- `pode_visualizar`
- `pode_visualizar_documentos`
- `pode_enviar_documentos`
- `pode_responder_atividades`
- `ativo`
- `created_at`
- `updated_at`

Exemplo:

| usuario | vínculo |
|---|---|
| Sloan | Pai de João no Clube Fonseca Aventureiros |
| Sloan | Pai de Maria no Clube Fonseca Desbravadores |
| Sloan | Diretor no Clube Fonseca Desbravadores |
| Sloan | Conselheiro no Clube Fonseca Aventureiros |

Essa estrutura permite que o mesmo login tenha acesso aos filhos e também exerça função de diretoria, conselheiro, pastor ou outro papel.

### Contextos de Acesso

Após o login, o sistema deve montar os contextos disponíveis para o usuário.

Um contexto é uma forma concreta de entrar no sistema.

Exemplo:

```txt
Entrar como:
- Diretor - Clube Fonseca Desbravadores
- Conselheiro - Clube Fonseca Aventureiros
- Pai de João - Clube Fonseca Aventureiros
- Pai de Maria - Clube Fonseca Desbravadores
```

Se houver apenas um contexto, o sistema entra direto.

Se houver mais de um, exibe uma tela de escolha de contexto.

Depois de escolhido o contexto, a aplicação guarda:

- `clube_ativo`
- `programa_ativo`
- `perfil_ativo`
- `membro_ativo`, quando aplicável
- `contexto_tipo`: `clube` ou `responsavel`

### Botão "Meus Filhos"

Usuários que tenham registros ativos em `responsavel_membros` devem ver um botão:

```txt
Meus filhos
```

Esse botão deve aparecer mesmo quando a pessoa estiver usando outro contexto, como diretoria, conselheiro ou pastor.

Ele permite trocar rapidamente para a visão de um filho vinculado.

## Perfis de Acesso

Perfis previstos:

- `admin_ti`
- `admin_clube`
- `usuario_secretaria`
- `usuario_tesouraria`
- `usuario_conselheiro`
- `usuario_diretoria`
- `usuario_desbravador`
- `usuario_aventureiro`
- `usuario_regional`
- `usuario_distrital`
- `usuario_pastor`
- `usuario_capelao`

### Escopo dos Perfis

`admin_ti`

- Gerencia toda a plataforma.
- Vê todos os clubes.
- Pode criar/editar/desativar clubes.
- Pode resolver problemas de acesso e dados.

`admin_clube`

- Gerencia um clube específico.
- Administra usuários, vínculos, MFA, permissões, documentos e configurações do clube.

`usuario_secretaria`

- Gerencia cadastros, documentos, relatórios e registros administrativos do clube.

`usuario_tesouraria`

- Acesso a dados financeiros quando esse módulo existir.
- Sem acesso irrestrito a documentos sensíveis, salvo se o clube permitir.

`usuario_conselheiro`

- Acompanha membros de unidade vinculada.
- Pode ver status documental, mas não deve visualizar documentos sensíveis sem permissão explícita.

`usuario_diretoria`

- Perfil amplo da diretoria do clube.
- Pode lançar pontuações, atividades e acompanhar membros.

`usuario_desbravador`

- Acesso próprio do membro DBV.

`usuario_aventureiro`

- Acesso próprio do membro aventureiro.

`usuario_regional`, `usuario_distrital`, `usuario_pastor`

- Acesso de acompanhamento.
- Pode envolver múltiplos clubes.
- Permissões precisam ser configuráveis por escopo.

`usuario_capelao`

- Acesso pastoral/devocional.
- Pode acompanhar atividades e registros permitidos pelo clube.

### Responsáveis

Responsável/pai/mãe não é perfil operacional principal.

O acesso de responsável vem da tabela `responsavel_membros`.

Esse acesso permite visualizar ou agir somente nos membros vinculados, conforme permissões do vínculo:

- ver dados do filho;
- ver status de documentos;
- anexar documentos, se permitido;
- responder atividades, se permitido;
- acompanhar pontuação e agenda do clube do filho.

## Membros

Para suportar DBV e Aventureiros, a entidade deve ser genérica.

Tabela sugerida: `membros`

Campos:

- `id`
- `clube_id`
- `programa_id`
- `unidade_id`
- `nome`
- `data_nascimento`
- `idade`
- `genero`
- `cargo_id`
- `tipo_membro`
- `email`
- `telefone`
- `nome_responsavel`
- `contato_responsavel`
- `foto_url`
- `ativo`

`tipo_membro` pode ser:

- `desbravador`
- `aventureiro`
- `diretoria`
- `responsavel`

Regra:

- Se o clube for de Desbravadores, membros comuns devem ter 10 a 15 anos.
- Se o clube for de Aventureiros, membros comuns devem ter 6 a 9 anos.
- Diretoria deve ter 16+.

## Unidades

Tabela sugerida: `unidades`

Campos:

- `id`
- `clube_id`
- `nome`
- `cor`
- `ativo`
- `created_at`
- `updated_at`

Regra:

- Unidades são sempre por clube.
- Dois clubes podem ter unidades com o mesmo nome sem conflito.

## Cargos

Cargos devem ser gerais, com variações por programa quando necessário.

Tabela sugerida: `cargos_modelo`

Campos:

- `id`
- `programa_id`
- `codigo`
- `nome_masculino`
- `nome_feminino`
- `tipo`
- `idade_minima`
- `idade_maxima`
- `perfil_sugerido`
- `ativo`

Exemplos:

| programa | masculino | feminino | idade | perfil_sugerido |
|---|---|---|---|---|
| Desbravadores | Desbravador | Desbravadora | 10-15 | `usuario_desbravador` |
| Aventureiros | Aventureiro | Aventureira | 6-9 | `usuario_aventureiro` |
| Ambos | Conselheiro | Conselheira | 16+ | `usuario_conselheiro` |
| Ambos | Diretor | Diretora | 16+ | `usuario_diretoria` |

### Cargos de Desbravadores

Cargos permitidos no programa Desbravadores:

- Diretor(a)
- Diretor(a) associado(a)
- Secretário(a)
- Tesoureiro(a)
- Capelão
- Instrutor(a) de classes
- Instrutor(a) de especialidades
- Conselheiro(a)
- Capitão/Capitã de unidade
- Secretário(a) de unidade
- Comunicação

### Cargos de Aventureiros

Cargos permitidos no programa Aventureiros:

- Diretor(a)
- Diretor(a) associado(a)
- Secretário(a)
- Tesoureiro(a)
- Capelão
- Instrutor(a) de classes
- Instrutor(a) de especialidades
- Conselheiro(a)
- Comunicação

### Diferenças de Cargos

Desbravadores possui cargos de unidade que não entram inicialmente em Aventureiros:

- Capitão/Capitã de unidade
- Secretário(a) de unidade

Essas diferenças devem ser controladas por `programa_id` em `cargos_modelo`.

## Classes

Classes devem ser cadastradas por programa.

Tabela sugerida: `classes_modelo`

Campos:

- `id`
- `programa_id`
- `nome`
- `ordem`
- `ativo`

### Classes de Aventureiros

Total: 4 classes, uma por idade.

| idade | classe |
|---:|---|
| 6 | Abelhinhas Laboriosas |
| 7 | Luminares |
| 8 | Edificadores |
| 9 | Mãos Ajudadoras |

### Classes de Desbravadores

Total: 12 classes.

São 6 classes regulares e 6 classes avançadas.

| ordem | classe | tipo |
|---:|---|---|
| 1 | Amigo | regular |
| 2 | Amigo da Natureza | avançada |
| 3 | Companheiro | regular |
| 4 | Companheiro de Excursionismo | avançada |
| 5 | Pesquisador | regular |
| 6 | Pesquisador de Campo e Bosque | avançada |
| 7 | Pioneiro | regular |
| 8 | Pioneiro de Novas Fronteiras | avançada |
| 9 | Excursionista | regular |
| 10 | Excursionista na Mata | avançada |
| 11 | Guia | regular |
| 12 | Guia de Exploração | avançada |

Tabela de progresso:

`membro_classes`

- `id`
- `membro_id`
- `classe_id`
- `status`
- `data_conclusao`
- `observacao`

## Especialidades

Especialidades devem ser por programa.

Tabela sugerida: `especialidades_modelo`

Campos:

- `id`
- `programa_id`
- `nome`
- `codigo`
- `categoria`
- `tipo_nivel`
- `ano_criacao`
- `ano_revisao`
- `idade_indicada`
- `pre_requisitos`
- `requisitos`
- `quantidade_requisitos`
- `insignia_url`
- `mestrado_relacionado`
- `materiais_necessarios`
- `observacoes`
- `fonte_oficial`
- `status`
- `ativo`

Estimativas:

- Aventureiros: cerca de 125 especialidades
- Desbravadores: cerca de 518 especialidades

Status possíveis:

- Ativa
- Revisada
- Substituída
- Descontinuada

Tabela de vínculo:

`membro_especialidades`

- `id`
- `membro_id`
- `especialidade_id`
- `status`
- `data_conclusao`
- `observacao`

## Documentos

Documentos podem variar por programa e por clube.

Tabela modelo:

`documentos_modelo`

- `id`
- `programa_id`
- `nome`
- `obrigatorio`
- `permite_anexo`
- `limite_anexos`
- `ordem`
- `ativo`

Tabela do membro:

`membro_documentos`

- `id`
- `membro_id`
- `documento_modelo_id`
- `status`
- `observacao`

Tabela de anexos:

`membro_documento_anexos`

- `id`
- `membro_documento_id`
- `clube_id`
- `membro_id`
- `url`
- `tipo`
- `nome_arquivo`
- `created_at`

Status:

- `pendente`
- `entregue`
- `nao_aplica`

## Pontuação

Pontuações podem ser personalizadas por clube.

Tabela:

`pontuacao_itens`

- `id`
- `clube_id`
- `programa_id`
- `titulo`
- `sigla`
- `valor`
- `ativo`
- `ordem`
- `padrao`
- `created_at`
- `updated_at`

Modelo padrão inicial, baseado no cadastro atual:

| título | sigla | valor padrão |
|---|---|---:|
| Presença | PR | 25 |
| Pontualidade | PO | 100 |
| Material | MA | 25 |
| Uniforme | UN | 25 |

Regras:

- Cada clube pode incluir novas pontuações.
- Cada clube pode alterar título, sigla e valor.
- Cada clube pode desativar pontuações que não deseja usar.
- O modelo padrão serve apenas como ponto de partida para novos clubes.
- Alterações feitas por um clube não afetam outros clubes.

Tabela de lançamentos:

`pontuacoes`

- `id`
- `clube_id`
- `membro_id`
- `data`
- `lancado_por`
- `observacao`
- `created_at`
- `updated_at`

Tabela de itens marcados:

`pontuacao_lancamentos`

- `id`
- `pontuacao_id`
- `pontuacao_item_id`
- `valor_aplicado`
- `observacao`

Essa estrutura permite criar, editar, desativar e reorganizar pontuações sem mudar colunas no banco.

## Agenda, Atividades e Mensagens

Todas devem receber `clube_id`.

Tabelas:

- `eventos`
- `atividades`
- `atividades_anexos`
- `atividades_respostas`
- `mensagens`

Regra:

- Um usuário só vê registros dos clubes aos quais está vinculado.

## LGPD

Termos podem ser por plataforma ou por clube.

Sugestão:

- Termo base da plataforma.
- Termo complementar por clube, se necessário.

Tabelas:

- `lgpd_termos`
- `lgpd_aceites`

Adicionar:

- `clube_id` opcional
- `programa_id` opcional

Assim é possível ter:

- termo global da plataforma;
- termo específico de um clube;
- termo específico de DBV ou Aventureiros.

## Login e Seleção de Clube

Fluxo:

1. Usuário digita e-mail e senha.
2. Supabase autentica.
3. Sistema busca vínculos operacionais em `usuario_clubes`.
4. Sistema busca vínculos familiares em `responsavel_membros`.
5. Sistema monta a lista de contextos disponíveis.
6. Se houver um único contexto ativo, entra direto.
7. Se houver mais de um, exibe tela "Escolha como deseja acessar".
8. Após escolher, grava o contexto ativo.
9. Todas as telas filtram dados conforme o contexto ativo.

O usuário não precisa informar o clube no login.

### Exemplos de Contextos

```txt
Diretor - Clube Fonseca Desbravadores
Conselheiro - Clube Fonseca Aventureiros
Pastor - Clube Fonseca Desbravadores
Responsável por Ana - Clube Fonseca Aventureiros
Responsável por Lucas - Clube Fonseca Desbravadores
```

### Regras do Contexto

Contexto operacional:

- vem de `usuario_clubes`;
- pode liberar visão por clube, unidade ou função;
- usado para diretoria, conselheiro, pastor, secretaria, tesouraria, regional, distrital e admin.

Contexto responsável:

- vem de `responsavel_membros`;
- libera somente dados dos membros vinculados;
- nunca libera automaticamente o clube inteiro.

## Segurança RLS

Todas as tabelas com dados operacionais precisam filtrar por `clube_id`.

Regra base para papéis de clube:

```sql
clube_id IN (
  SELECT clube_id
  FROM usuario_clubes
  WHERE usuario_id = auth.uid()
    AND ativo = true
)
```

Para `admin_ti`, permitir acesso global.

Regra base para responsáveis:

```sql
membro_id IN (
  SELECT membro_id
  FROM responsavel_membros
  WHERE usuario_id = auth.uid()
    AND ativo = true
)
```

Em tabelas que possuem `clube_id` e `membro_id`, o responsável só pode acessar registros diretamente relacionados ao filho ou dependente.

Ele não deve acessar listas completas do clube.

## Plano de Migração

### Fase 1 - Preparação

- Criar tabelas `programas`, `clubes`, `usuario_clubes`.
- Criar programa `desbravadores`.
- Criar clube atual `Fonseca` vinculado ao programa `desbravadores`.
- Adicionar `clube_id` nas principais tabelas atuais.
- Preencher tudo com `clube_id = 1`.

### Fase 2 - Normalização

- Criar `membros` como evolução de `desbravadores`.
- Criar tabelas dinâmicas de classes, documentos, especialidades e pontuação.
- Migrar dados atuais para as novas tabelas.
- Manter compatibilidade temporária com telas antigas.

### Fase 3 - Login Multi-Clube

- Ajustar login para carregar vínculos do usuário.
- Criar tela de seleção de contexto quando houver mais de um vínculo.
- Carregar vínculos de `usuario_clubes`.
- Carregar vínculos de `responsavel_membros`.
- Aplicar contexto ativo na aplicação.
- Criar botão "Meus filhos" quando houver vínculos familiares.

### Fase 4 - Aventureiros

- Criar programa `aventureiros`.
- Popular classes e cargos de Aventureiros.
- Cadastrar documentos padrão.
- Permitir criação de clube de Aventureiros.

### Fase 5 - Marca e Plataforma

- Separar identidade visual da plataforma em configurações.
- Permitir trocar nome, logo e cores sem alterar código.

## Ponto de Atenção

Não é recomendado criar um Supabase separado para cada clube.

O melhor caminho é uma única base multi-clube, com:

- `clube_id` em todos os dados;
- RLS forte;
- vínculos explícitos de usuário por clube;
- permissões por perfil;
- Storage separado por pasta de clube.
