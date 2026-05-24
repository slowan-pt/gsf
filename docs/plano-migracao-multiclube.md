# Plano de Migração Multi-Clube

Este plano transforma o sistema atual, feito para um único clube, em uma base preparada para múltiplos clubes de Desbravadores e Aventureiros.

O princípio desta fase é **não quebrar o Clube Fonseca atual**.

## Premissas Confirmadas

- Programas atendidos inicialmente:
  - Desbravadores
  - Aventureiros
- Cada clube pertence a um único programa.
- Um usuário pode ter múltiplos vínculos e contextos.
- Um responsável pode ter filhos em Desbravadores e Aventureiros.
- Um responsável também pode ser diretoria, conselheiro, pastor ou outro perfil em um ou mais clubes.
- O clube atual será:
  - Programa: Desbravadores
  - Clube: Fonseca
  - Nome completo: Clube de Desbravadores Fonseca
- Admin inicial da plataforma:
  - `sloan.nascimento@gmail.com`

## Estratégia

### Fase 1 - Base Multi-Clube Conservadora

Criar a estrutura de plataforma sem remover nem renomear as tabelas atuais.

Entregas:

- `programas`
- `clubes`
- `perfis_acesso`
- `usuario_clubes`
- `responsavel_membros`
- `classes_modelo`
- `cargos_modelo`
- `documentos_modelo`
- `especialidades_modelo`
- `pontuacao_itens`
- colunas `clube_id` nas tabelas atuais
- preenchimento do Clube Fonseca como `clube_id = 1`
- vínculo inicial do usuário `sloan.nascimento@gmail.com` como `admin_ti`

Nesta fase, a tabela `desbravadores` continua existindo e funcionando.

### Fase 2 - Login por Contexto

Depois da base criada, ajustar o app para:

- carregar vínculos operacionais em `usuario_clubes`;
- carregar vínculos familiares em `responsavel_membros`;
- montar contextos de acesso;
- entrar direto quando houver apenas um contexto;
- exibir seleção quando houver múltiplos contextos.

### Fase 3 - Telas por Clube Ativo

Adaptar as telas para sempre usar:

- `clube_ativo`
- `programa_ativo`
- `perfil_ativo`
- `contexto_tipo`
- `membro_ativo`, quando aplicável

### Fase 4 - Programa Aventureiros

Cadastrar e ativar:

- classes de Aventureiros;
- cargos de Aventureiros;
- documentos padrão de Aventureiros;
- primeiro clube de Aventureiros.

### Fase 5 - Normalização de Membros

Criar a tabela `membros` e migrar gradualmente a tabela `desbravadores` para uma estrutura genérica.

Esta fase deve ser feita só depois que a base multi-clube estiver estável.

## Cuidados

- Não alterar o funcionamento atual do Fonseca durante a Fase 1.
- Não trocar o perfil atual dos usuários no app antigo imediatamente.
- Não renomear `desbravadores` para `membros` ainda.
- Não remover colunas antigas.
- Todas as tabelas novas devem ser idempotentes.
- Toda tabela operacional nova deve ter RLS.

## Documentos Padrão

Na Fase 1, usar a lista atual do Fonseca como padrão DBV:

- RG
- CPF
- RG Responsável
- Cartão SUS
- Cartão de Plano
- Ficha de Saúde
- Carteira de Vacinação
- Laudo Médico
- Ficha de Reg. Atualizada
- Comp. Residência
- Aut. Saída
- Aut. Viagem Autenticada
- RI Assinado
- Foto
- Ant. Criminais

O padrão de Aventureiros será ajustado depois.

## Especialidades Modelo

A estrutura de especialidades deve suportar:

- nome
- código/sigla
- categoria/área
- tipo/nível
- ano de criação
- ano de revisão
- idade indicada
- pré-requisitos
- requisitos
- quantidade de requisitos
- insígnia/emblema
- mestrado relacionado
- materiais necessários
- observações
- fonte oficial
- status: Ativa, revisada, substituída, descontinuada

As listas completas de especialidades serão importadas depois.

## Matriz Inicial de Permissões

| perfil | escopo | membros | documentos | pontuação | agenda | atividades | relatórios | usuários/MFA | clubes |
|---|---|---|---|---|---|---|---|---|---|
| `admin_ti` | plataforma | total | total | total | total | total | total | total | total |
| `admin_clube` | clube | total | total | total | total | total | total | total no clube | editar clube |
| `usuario_secretaria` | clube | total | total | leitura | leitura/escrita | leitura | total | limitado | não |
| `usuario_tesouraria` | clube | leitura | limitado | não | leitura | leitura | financeiro | não | não |
| `usuario_diretoria` | clube | leitura/escrita | status/anexos conforme regra | total | total | total | leitura | não | não |
| `usuario_conselheiro` | unidade | membros da unidade | status, sem abrir anexos sensíveis | lançar/acompanhar unidade | leitura | acompanhar unidade | unidade | não | não |
| `usuario_desbravador` | próprio | próprio | próprio conforme regra | leitura própria | leitura | responder próprias | próprio | não | não |
| `usuario_aventureiro` | próprio | próprio | próprio conforme regra | leitura própria | leitura | responder próprias | próprio | não | não |
| `usuario_regional` | regional | leitura | status agregado | leitura | leitura | leitura | agregado | não | não |
| `usuario_distrital` | distrito | leitura | status agregado | leitura | leitura | leitura | agregado | não | não |
| `usuario_pastor` | clubes vinculados | leitura | sem anexos sensíveis por padrão | leitura | leitura | leitura | leitura | não | não |
| `usuario_capelao` | clube | leitura | não | não | leitura | devocional/acompanhar | leitura | não | não |
| responsável | filhos vinculados | filhos | conforme vínculo | leitura dos filhos | leitura | responder filhos | filhos | não | não |

Responsável não é perfil operacional; é vínculo em `responsavel_membros`.

## Resultado Esperado da Fase 1

Depois da migração:

- O app atual continua funcionando.
- O banco passa a saber que todos os dados atuais pertencem ao Clube Fonseca.
- A plataforma passa a ter estrutura para novos clubes.
- O login ainda pode continuar no modelo atual até a Fase 2.

