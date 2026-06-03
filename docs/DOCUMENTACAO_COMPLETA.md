# 📘 Documentação Completa — Plataforma de Gestão de Clubes (PWA)

> Documento técnico-descritivo que define a **arquitetura canônica** da plataforma, escrito
> para dois públicos:
> 1. **Humanos** (desenvolvedores, mantenedores, diretoria) que precisam entender a
>    estrutura, as regras e como operar o sistema.
> 2. **Uma IA** que receba este documento como especificação para **construir** a plataforma
>    do zero.
>
> ### ⚠️ Premissas canônicas desta documentação
> Esta documentação descreve a plataforma **alvo**, com as seguintes decisões de projeto
> fechadas (independentemente de detalhes legados que existam no código histórico):
>
> 1. **É um PWA web puro.** Não é, e nunca será, um aplicativo Android/iOS empacotado.
>    Não há build de APK/AAB, não há Expo EAS, não há lojas de aplicativo.
> 2. **Não existem módulos offline.** Não há SQLite local, fila de sincronização, nem
>    cache de banco no dispositivo. A aplicação fala **diretamente com o Supabase** via HTTPS.
> 3. **Multiclube desde a origem.** A plataforma é multitenant por natureza: programas,
>    clubes e contextos de acesso são a fundação, não um acréscimo. Não há "modo clube único".
> 4. **Dados são portáveis.** Existe um mecanismo de **exportação e importação** de dados de
>    um projeto Supabase para outro (migração, clonagem, backup).
>
> Documentos complementares:
> - `GUIA_HOSPEDAGEM_E_SETUP.md` — como hospedar (web), criar o banco e migrar dados.
> - `CREDENCIAIS_TOKENS_API.md` — chaves e segredos (não versionado).
> - `modelagem-multiclube.md` — projeto detalhado do modelo multiclube.

Última atualização desta doc: **2026-06-02**

---

## Índice

1. [Visão geral e propósito](#1-visão-geral-e-propósito)
2. [Stack tecnológica](#2-stack-tecnológica)
3. [Arquitetura e padrões de engenharia](#3-arquitetura-e-padrões-de-engenharia)
4. [Estrutura de diretórios](#4-estrutura-de-diretórios)
5. [Modelo de dados (banco)](#5-modelo-de-dados-banco)
6. [Modelo multiclube e contextos de acesso](#6-modelo-multiclube-e-contextos-de-acesso)
7. [Tipos de usuário e perfis](#7-tipos-de-usuário-e-perfis)
8. [Matriz de permissões](#8-matriz-de-permissões)
9. [Mapa de telas, menus e quem acessa](#9-mapa-de-telas-menus-e-quem-acessa)
10. [Módulos funcionais e regras de negócio](#10-módulos-funcionais-e-regras-de-negócio)
11. [Acesso a dados (web direto ao Supabase)](#11-acesso-a-dados-web-direto-ao-supabase)
12. [Exportação e importação de dados entre Supabases](#12-exportação-e-importação-de-dados-entre-supabases)
13. [Segurança: RLS, MFA, LGPD](#13-segurança-rls-mfa-lgpd)
14. [PWA e notificações](#14-pwa-e-notificações)
15. [Boas práticas de engenharia adotadas](#15-boas-práticas-de-engenharia-adotadas)
16. [Como construir este projeto com uma IA](#16-como-construir-este-projeto-com-uma-ia)

---

## 1. Visão geral e propósito

Plataforma **web (PWA)** de gestão para **Clubes de Desbravadores e Aventureiros**
(ministério jovem da Igreja Adventista). É **multitenant (multiclube) desde a origem**:
vários clubes e dois programas (Desbravadores e Aventureiros) coexistem na mesma base de
dados, isolados por `clube_id` e protegidos por RLS (Row Level Security).

### Forma de entrega
- **Aplicação Web (PWA)** — instalável no celular/desktop, hospedada no Cloudflare Pages.
- **Acesso por navegador** — funciona em qualquer dispositivo com browser moderno.
- **Sem app de loja** — não há APK/AAB, não há publicação em Play Store/App Store.

### Objetivos do produto
- Cadastro e acompanhamento de membros (desbravadores/aventureiros).
- Controle de **documentação** obrigatória (ficha de saúde, RG, autorizações, etc.).
- **Pontuação** semanal gamificada e **ranking** por membro e por unidade.
- **Atividades formativas** com fluxo entrega → avaliação → aprovação, incluindo classes e
  especialidades.
- **Agenda** de eventos do clube.
- **Avisos/mensagens** para os membros.
- **Gestão financeira** de Campori (parcelas e pagamentos).
- Acesso de **pais/responsáveis** à visão dos filhos.
- **Classe Bíblica** (estudo bíblico interativo).
- **Portabilidade de dados** entre instâncias Supabase (migração/clonagem/backup).

---

## 2. Stack tecnológica

### Frontend / App (web)
| Tecnologia | Papel |
|---|---|
| **Expo + React Native Web** | Renderiza a aplicação para o navegador (web) |
| **React** | Biblioteca de UI |
| **Expo Router** | Roteamento por arquivos (file-based routing) |
| **TypeScript** | Tipagem estática |
| **Zustand** | Gerência de estado global (stores) |
| **TanStack Query** | Cache/queries assíncronas |
| **date-fns** | Datas e formatação (locale pt-BR) |
| **react-native-gifted-charts** | Gráficos do ranking |
| **xlsx** | Importação de planilhas |
| **@expo/vector-icons** (Ionicons) | Ícones |

> **Observação de arquitetura:** o projeto usa React Native Web por compartilhar a base de
> componentes do ecossistema Expo, mas o **alvo de execução é exclusivamente o navegador**.
> Não há dependências nativas de SQLite, armazenamento seguro de dispositivo, detecção de
> rede offline ou empacotamento mobile.

### Backend / Infra
| Tecnologia | Papel |
|---|---|
| **Supabase** | PostgreSQL gerenciado + Auth + Storage + RLS + Realtime |
| **Cloudflare Pages** | Hospedagem do PWA |
| **Expo Push (Web Push)** | Notificações via navegador |

### APIs do navegador / web usadas
Upload de arquivos (input file / picker web), geração de **PDF** (impressão do navegador),
download de blobs, `localStorage` (sessão e preferências), Service Worker (PWA).

---

## 3. Arquitetura e padrões de engenharia

### 3.1. Visão em camadas
```
┌─────────────────────────────────────────────────────────────┐
│  CAMADA DE APRESENTAÇÃO  (app/ — Expo Router)                │
│  Telas .tsx, navegação por arquivos, componentes de UI       │
└───────────────────────────┬─────────────────────────────────┘
                            │ usa
┌───────────────────────────▼─────────────────────────────────┐
│  CAMADA DE ESTADO  (src/stores/ — Zustand)                   │
│  authStore, contextoStore, dbvStore, pontuacaoStore, …       │
└───────────────────────────┬─────────────────────────────────┘
                            │ usa
┌───────────────────────────▼─────────────────────────────────┐
│  CAMADA DE SERVIÇOS/LIB  (src/lib/)                          │
│  supabase, permissoes, contextoAtual, notifications,         │
│  lgpd, auditoria, modelosPrograma, paletaAtividades, …       │
└───────────────────────────┬─────────────────────────────────┘
                            │ acessa (HTTPS, direto)
┌───────────────────────────▼─────────────────────────────────┐
│  PERSISTÊNCIA REMOTA                                          │
│  SUPABASE — PostgreSQL + Storage (sem cache local)           │
└──────────────────────────────────────────────────────────────┘
```

> **Não há camada de persistência local.** Toda leitura/escrita vai direto ao Supabase. A
> reatividade da UI vem do estado em memória (Zustand) e de re-fetches sob foco/ação.

### 3.2. Padrões e decisões-chave
- **File-based routing (Expo Router):** cada arquivo em `app/` é uma rota. Pastas com
  `(parênteses)` são grupos que não entram na URL (ex.: `(tabs)`). Colchetes são parâmetros
  dinâmicos (ex.: `membro/[id].tsx`).
- **Web-only, online-first:** a aplicação assume conexão. Não há fila de sincronização nem
  banco local; a fonte de verdade é sempre o Supabase.
- **Estado por contexto ativo:** todo dado é filtrado pelo **contexto ativo** (clube +
  programa + perfil), recuperado via `getClubeAtivoId()`, `getProgramaAtivoId()`, etc.
- **Permissões declarativas:** uma **matriz central** (`src/lib/permissoes.ts`) mapeia
  perfil → permissões. A UI consulta `usePermissoes().pode('...')`.
- **Segurança no servidor (RLS):** a autorização real é feita por **Row Level Security** no
  Postgres, nunca confiando apenas no cliente.
- **Migrations versionadas:** todo o schema evolui por arquivos numerados em
  `supabase/migrations/`, aplicados em ordem.
- **Multitenancy por `clube_id`:** isolamento de dados entre clubes na mesma base.
- **Componentização leve:** componentes reutilizáveis em `src/components/` (ex.: `BottomNav`,
  `DateField`, `Avatar`). Telas grandes concentram a lógica de domínio.
- **Tema/identidade configurável:** cores de navegação centralizadas (`navTheme.ts`),
  paleta de atividades personalizável por clube (`paletaAtividades.ts`).

---

## 4. Estrutura de diretórios

```
plataforma-clubes/
├── app/                          # ROTAS (Expo Router) — camada de apresentação
│   ├── _layout.tsx               # Layout raiz: Stack, init de sessão, notificações, fontes
│   ├── +html.tsx                 # Shell HTML do web
│   ├── index.tsx                 # Entrada → redireciona conforme login/contexto
│   │
│   ├── auth/                     # Autenticação
│   │   ├── login.tsx             # Login (e-mail + senha)
│   │   ├── mfa.tsx               # MFA TOTP (obrigatório p/ admins)
│   │   ├── consent.tsx           # Aceite LGPD
│   │   └── contexto.tsx          # Seleção de contexto (multiclube)
│   │
│   ├── (tabs)/                   # Navegação principal por abas
│   │   ├── _layout.tsx           # Define as abas + badges + visibilidade por permissão
│   │   ├── index.tsx             # DASHBOARD / Início (atalhos, aniversariantes)
│   │   ├── ranking.tsx           # Ranking gamificado (membros/unidades)
│   │   ├── membros.tsx           # Lista de membros
│   │   ├── pontuacao.tsx         # Lançamento de pontuação (admin)
│   │   ├── atividades.tsx        # Re-exporta app/atividades/index.tsx
│   │   ├── calendario.tsx        # Agenda de eventos
│   │   ├── extras.tsx            # Pontos extras / itens especiais
│   │   ├── unidades.tsx          # Gestão de unidades
│   │   ├── campori.tsx           # Campori (aba oculta)
│   │   ├── mensagens.tsx         # Avisos (aba oculta, acessível por link)
│   │   └── anexo.tsx             # Visualizador de anexos (aba oculta)
│   │
│   ├── atividades/               # Módulo de Atividades (o maior do sistema)
│   │   ├── _layout.tsx
│   │   └── index.tsx             # CRUD + fluxo de avaliação + chat + progresso
│   │
│   ├── admin/                    # Telas administrativas
│   │   ├── acessos.tsx           # Gestão de usuários e permissões
│   │   ├── aparencia.tsx         # Personalização visual do clube
│   │   ├── auditoria.tsx         # Log de auditoria
│   │   ├── classificacao.tsx     # Classificação SGC oficial
│   │   ├── clubes.tsx            # Gestão de clubes (admin_ti)
│   │   ├── lgpd.tsx              # Administração de termos LGPD
│   │   ├── mensagens.tsx         # Envio de avisos/mensagens
│   │   ├── menus-publicos.tsx    # Configura menus públicos
│   │   ├── modelos.tsx           # Modelos de pontuação e documentos
│   │   ├── pre-cadastros.tsx     # Aprovação de pré-cadastros
│   │   ├── ranking-clubes.tsx    # Ranking entre clubes (campo)
│   │   └── vincular-usuarios.tsx # Vincular login ↔ membro
│   │
│   ├── membro/[id].tsx           # Ficha individual do membro (dados, docs, responsáveis)
│   ├── relatorios/index.tsx      # Relatórios (PDF) + visão formativa
│   ├── importar/index.tsx        # Importação de planilhas (xlsx)
│   ├── extrato/[dbv_id].tsx      # Extrato de pontuação do membro
│   ├── convite/[token].tsx       # Aceite de convite de responsável
│   ├── pre-cadastro/[token].tsx  # Formulário público de pré-cadastro
│   ├── classe-biblica/index.tsx  # Classe Bíblica (estudo interativo via iframe)
│   └── perfil.tsx                # Perfil do usuário logado
│
├── src/
│   ├── components/               # Componentes reutilizáveis
│   │   ├── BottomNav.tsx         # Rodapé de navegação (usado em telas não-tab)
│   │   ├── DateField.tsx         # Campo de data
│   │   └── common/Avatar.tsx     # Avatar com iniciais/cor
│   │
│   ├── stores/                   # Estado global (Zustand)
│   │   ├── authStore.ts          # Login, sessão, MFA, consentimento
│   │   ├── contextoStore.ts      # Contextos multiclube, contexto ativo
│   │   ├── dbvStore.ts           # Membros
│   │   ├── pontuacaoStore.ts     # Pontuação e itens configuráveis
│   │   └── camporiStore.ts       # Campori (parcelas/pagamentos)
│   │
│   ├── lib/                      # Serviços e utilitários
│   │   ├── supabase.ts           # Cliente Supabase (storage de sessão = localStorage)
│   │   ├── permissoes.ts         # Matriz de perfis → permissões + hook
│   │   ├── contextoAtual.ts      # Getters do contexto ativo (clube/programa/…)
│   │   ├── notifications.ts      # Registro de token + envio de push (web push)
│   │   ├── lgpd.ts               # Verificação/registro de consentimento
│   │   ├── auditoria.ts          # Registro de eventos de auditoria
│   │   ├── modelosPrograma.ts    # Classes/cargos/documentos por programa
│   │   ├── documentosPaisConfig.ts # Janela de edição de docs por pais
│   │   ├── paletaAtividades.ts   # Tema visual das atividades
│   │   ├── navTheme.ts           # Cores da navegação
│   │   ├── publicMenuConfig.ts   # Configuração de menus públicos
│   │   └── pwa.ts                # Registro do service worker (PWA)
│   │
│   └── types/index.ts            # Tipos TypeScript do domínio
│
├── supabase/migrations/          # Migrations SQL versionadas
├── public/                       # Assets estáticos do web (PWA, sw.js, joias-da-eternidade.html)
├── scripts/                      # Scripts de build e de export/import de dados
│   ├── copy-pwa-assets.mjs       # Injeta manifesto PWA, service worker, fontes
│   ├── export-data.mjs           # Exporta dados de um Supabase → JSON
│   └── import-data.mjs           # Importa JSON → outro Supabase
├── docs/                         # Esta documentação
├── assets/                       # Ícones, splash, imagens
│
├── app.json                      # Config Expo (nome web, ícones, tema PWA)
├── package.json                  # Dependências e scripts npm (apenas web)
├── .env / .env.example           # Variáveis de ambiente (Supabase)
└── metro.config.js / tsconfig.json
```

> **Itens que NÃO existem nesta arquitetura** (e não devem ser introduzidos):
> `database.ts`/`database.web.ts` (SQLite), `seed_local.ts`, fila de sincronização
> (`sync.ts` no sentido offline), `eas.json`, configuração `android`/`ios` no `app.json`,
> scripts `build:android`/`build:preview`, e quaisquer `.apk`/`.aab`.

---

## 5. Modelo de dados (banco)

O banco é **PostgreSQL** (Supabase), **multiclube por construção**: toda tabela operacional
nasce com `clube_id` e RLS. Abaixo, os agrupamentos lógicos.

### 5.1. Identidade e acesso
| Tabela | Função |
|---|---|
| `auth.users` | Usuários do Supabase Auth (gerenciado) |
| `usuarios` | Perfil de aplicação ligado a `auth.users` (nome, foto, ativo) |
| `programas` | Desbravadores / Aventureiros (faixas etárias, regras) |
| `clubes` | Cada clube (pertence a 1 programa; cor, logo, nome curto) |
| `usuario_clubes` | Vínculo usuário ↔ clube ↔ perfil ↔ unidade (papéis operacionais) |
| `responsavel_membros` | Vínculo familiar usuário ↔ membro (pais/responsáveis) |

### 5.2. Membros e dados formativos
| Tabela | Função |
|---|---|
| `desbravadores` (membros) | Membros (nome, nascimento, gênero, unidade, cargo, foto, ativo) |
| `unidades` | Unidades do clube (nome, cor) |
| `documentos` | Status documental por membro (RG, CPF, ficha de saúde, etc.) |
| `documento_imagens` | Anexos (imagens/PDFs) de documentos por campo |
| `documentos_modelo` / `documentos_pais_config` | Documentos exigidos + janela de edição por pais |
| `progresso_classes` | Progresso nas classes regulares/avançadas |
| `especialidades` | Especialidades concluídas por membro (com origem em atividade) |
| `classes_modelo` / `cargos_modelo` | Modelos por programa (classes e cargos) |

### 5.3. Pontuação e ranking
| Tabela | Função |
|---|---|
| `pontuacoes` | Lançamento semanal (presença, pontualidade, material, uniforme + extras) |
| `config_pontuacao` | Valores-base dos critérios fixos |
| `pontuacao_itens` | **Itens de pontuação configuráveis** por clube (fonte única) |
| `pontuacoes_custom` | Lançamentos de itens customizados (histórico) |

### 5.4. Atividades formativas
| Tabela | Função |
|---|---|
| `atividades` | Atividade (título, prazo, destino, item formativo, avaliador) |
| `atividades_alvos` | A quem se destina (clube/unidade/membro) |
| `atividades_anexos` | Anexos da atividade |
| `atividades_respostas` | Entrega do membro (texto, anexo, status, nota, avaliação) |
| `atividades_mensagens` | Histórico/chat da atividade (sistema, avaliador, membro) |
| `planos_formativos` | Agrupa atividades de uma classe/especialidade (nº de avaliações) |

### 5.5. Comunicação e eventos
| Tabela | Função |
|---|---|
| `eventos` | Agenda do clube (data, horário, local, responsáveis) |
| `mensagens_clube` | Avisos/mensagens do clube |
| `mensagens_clube_lidos` | Marca de leitura por usuário |
| `mensagens_clube_ocultos` | Mensagens ocultadas por usuário |

### 5.6. Financeiro (Campori)
| Tabela | Função |
|---|---|
| `config_campori` | Nº de parcelas e dia de vencimento |
| `parcelas_campori_config` | Valor/descrição de cada parcela |
| `pagamentos_campori` | Pagamentos por membro e parcela |

### 5.7. Governança
| Tabela | Função |
|---|---|
| `lgpd_termos` / `lgpd_aceites` | Termos de consentimento e aceites |
| `auditoria` (admin_acessos) | Log de ações administrativas |
| `pre_cadastros` | Pré-cadastros públicos pendentes de aprovação |
| `classe_biblica_respostas` | Respostas da Classe Bíblica por usuário/clube |

> **Regra transversal inegociável:** toda tabela operacional carrega `clube_id` e é protegida
> por RLS, garantindo isolamento entre clubes desde a primeira migration.

---

## 6. Modelo multiclube e contextos de acesso

### 6.1. Conceitos (fundação do sistema)
- **Programa:** Desbravadores (10–15 anos) ou Aventureiros (6–9 anos). Define classes,
  cargos, especialidades e faixas etárias.
- **Clube:** pertence a **um** programa. "Fonseca Desbravadores" e "Fonseca Aventureiros"
  são **clubes distintos**, mesmo na mesma igreja.
- **Usuário:** apenas a identidade de login. **Não tem perfil global fixo** — acumula papéis.
- **Vínculo operacional** (`usuario_clubes`): define que a pessoa é, ex., diretoria no
  clube X e conselheiro no clube Y.
- **Vínculo familiar** (`responsavel_membros`): define que a pessoa é responsável por um
  membro específico (acesso restrito ao filho, nunca ao clube inteiro).

> O sistema **nasce multiclube**. Não há caminho de "clube único" nem identificadores fixos
> de clube embutidos no código. Toda operação resolve o clube a partir do **contexto ativo**.

### 6.2. Contexto de acesso
Após o login, o sistema monta a lista de **contextos** disponíveis (cada combinação de
clube + perfil, ou clube + filho, vira um contexto). Lógica em `contextoStore.ts`:

1. Busca vínculos em `usuario_clubes` e `responsavel_membros`.
2. Para `admin_ti`, gera um contexto para **cada clube** ativo da plataforma.
3. Monta a lista de `ContextoAcesso` (clube, programa, perfil, membro quando aplicável).
4. **Se houver 1 contexto → entra direto.** Se houver vários → tela de seleção
   (`auth/contexto.tsx`). O contexto escolhido é persistido em `localStorage`.

Exemplo de contextos de um mesmo login:
```
- Diretor — Clube Fonseca Desbravadores
- Conselheiro — Clube Fonseca Aventureiros
- Responsável por Ana — Clube Fonseca Aventureiros
- Responsável por Lucas — Clube Fonseca Desbravadores
```

### 6.3. Filtragem por contexto
Todas as telas filtram dados pelo **contexto ativo**, via getters de `contextoAtual.ts`:
`getClubeAtivoId()`, `getProgramaAtivoId()`, `getContextoUnidadeId()`, `getContextoMembroId()`.

### 6.4. Permissões mescladas
Se o usuário tem **mais de um papel no mesmo clube** (ex.: conselheiro **e** pai), as
permissões são **unificadas** (`permissoesMescladas`), evitando troca de contexto para cada
ação.

---

## 7. Tipos de usuário e perfis

Perfis definidos em `src/types/index.ts` e na matriz de `permissoes.ts`.

### Perfis e escopo
| Perfil | Nome exibido | Escopo |
|---|---|---|
| `admin_ti` | Admin TI | **Plataforma inteira.** Vê todos os clubes, cria/edita clubes, resolve acessos |
| `admin_clube` | Admin do clube | Administra **um clube**: usuários, vínculos, MFA, permissões, documentos, configs |
| `usuario_secretaria` | Secretaria | Cadastros, documentos, atividades, agenda, relatórios, mensagens |
| `usuario_tesouraria` | Tesouraria | Financeiro e relatórios |
| `usuario_conselheiro` | Conselheiro(a) | Acompanha a unidade: pontuação, atividades, agenda, relatórios |
| `usuario_diretoria` | Diretoria | Perfil amplo: membros, pontuação, unidades, atividades, agenda, mensagens, relatórios, financeiro |
| `usuario_capelao` | Capelão | Pastoral: atividades, mensagens, relatórios |
| `usuario_regional` | Regional | Acompanhamento (relatórios, unidade), múltiplos clubes |
| `usuario_distrital` | Distrital | Acompanhamento (relatórios, unidade) |
| `usuario_pastor` | Pastor | Acompanhamento (relatórios, unidade) |
| `usuario_desbravador` | Desbravador | Acesso próprio do membro |
| `usuario_aventureiro` | Aventureiro | Acesso próprio do membro |
| `usuario_pais` / `responsavel` | Pais/Responsável | Acesso **somente aos filhos** vinculados |

### Duração de sessão (regra de negócio de segurança)
Definida em `authStore.ts`:
- **Administradores** (admin_*, secretaria, diretoria): **48 horas**.
- **Membros/demais**: **7 dias**.
Após expirar, a sessão é invalidada e exige novo login.

---

## 8. Matriz de permissões

Fonte: `src/lib/permissoes.ts`. As **permissões** (capacidades) são:

`admin_plataforma`, `admin_clube`, `gerenciar_acessos`, `gerenciar_clubes`,
`gerenciar_membros`, `gerenciar_documentos`, `gerenciar_pontuacao`, `gerenciar_unidades`,
`gerenciar_agenda`, `gerenciar_atividades`, `enviar_mensagens`, `ver_relatorios`,
`ver_financeiro`, `ver_filhos`, `ver_unidade`.

### Tabela perfil × permissão
Legenda: ✅ = possui.

| Permissão / Perfil | admin_ti | admin_clube | secretaria | tesouraria | conselheiro | diretoria | capelao | regional | distrital | pastor | pais | dbv/aventureiro |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| admin_plataforma | ✅ | | | | | | | | | | | |
| admin_clube | ✅ | ✅ | | | | | | | | | | |
| gerenciar_acessos | ✅ | ✅ | | | | | | | | | | |
| gerenciar_clubes | ✅ | | | | | | | | | | | |
| gerenciar_membros | ✅ | ✅ | ✅ | | | ✅ | | | | | | |
| gerenciar_documentos | | | ✅ | | | | | | | | | |
| gerenciar_pontuacao | ✅ | ✅ | | | ✅ | ✅ | | | | | | |
| gerenciar_unidades | ✅ | ✅ | | | | ✅ | | | | | | |
| gerenciar_agenda | ✅ | ✅ | ✅ | | ✅ | ✅ | | | | | | |
| gerenciar_atividades | ✅ | ✅ | ✅ | | ✅ | ✅ | ✅ | | | | | |
| enviar_mensagens | ✅ | ✅ | ✅ | | | ✅ | ✅ | | | | | |
| ver_relatorios | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | | |
| ver_financeiro | ✅ | ✅ | | ✅ | | ✅ | | | | | | |
| ver_filhos | ✅ | ✅ | | | | ✅ | | | | | ✅ | |
| ver_unidade | ✅ | ✅ | ✅ | | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | | |

> Desbravador/Aventureiro não possuem permissões administrativas — têm acesso de **leitura
> da própria visão** (ranking, atividades destinadas a si, avisos, agenda).

### Como a UI usa
```ts
const { pode, podeAlguma, temPerfil } = usePermissoes();
if (pode('gerenciar_pontuacao')) { /* mostra aba/ação */ }
```

---

## 9. Mapa de telas, menus e quem acessa

### 9.1. Barra de abas inferior (`app/(tabs)/_layout.tsx`)
A visibilidade de cada aba depende de permissão. Abas com `href: null` ficam **ocultas** da
barra mas continuam acessíveis por link/rota.

| Aba | Rota | Ícone | Visível para |
|---|---|---|---|
| **Início** | `/(tabs)/index` | home | Todos |
| **Ranking** | `/(tabs)/ranking` | trophy | Todos |
| **Membros** | `/(tabs)/membros` | people | Todos (ações dependem de permissão) |
| **Pontuação** | `/(tabs)/pontuacao` | checkmark-circle | `gerenciar_pontuacao` |
| **Atividades** | `/(tabs)/atividades` | clipboard | Todos (visão varia por perfil) |
| **Extras** | `/(tabs)/extras` | star | `gerenciar_pontuacao` |
| **Unidades** | `/(tabs)/unidades` | flag | `gerenciar_unidades` |
| **Agenda** | `/(tabs)/calendario` | calendar | Todos |
| Campori | `/(tabs)/campori` | — | Oculta (acesso por link) |
| Avisos/Mensagens | `/(tabs)/mensagens` | — | Oculta (acesso por link) |
| Anexo (viewer) | `/(tabs)/anexo` | — | Oculta (interna) |

Há um botão flutuante **Sair** (logout) e **badges** na aba Atividades (pendências dos
filhos em laranja, itens a corrigir em verde).

### 9.2. Atalhos do Dashboard (`app/(tabs)/index.tsx`)
A tela Início mostra um grid de **Acesso Rápido** filtrado por permissão. Cada atalho:

| Atalho | Rota | Requer |
|---|---|---|
| Ranking | `/(tabs)/ranking` | — |
| Membros | `/(tabs)/membros` | — |
| Agenda | `/(tabs)/calendario` | — |
| Atividades | `/(tabs)/atividades` | — |
| Classe Bíblica | `/classe-biblica` | — |
| Avisos | `/mensagens` | — |
| Perfil | `/perfil` | — |
| Pontuação | `/(tabs)/pontuacao` | `gerenciar_pontuacao` |
| Extras | `/(tabs)/extras` | `gerenciar_pontuacao` |
| Unidades | `/(tabs)/unidades` | `gerenciar_unidades` |
| Importar | `/importar` | `gerenciar_membros` |
| Relatórios | `/relatorios` | `ver_relatorios` |
| Pré-cadastros | `/admin/pre-cadastros` | `gerenciar_membros` |
| Mensagens (envio) | `/admin/mensagens` | `enviar_mensagens` |
| Aparência | `/admin/aparencia` | `admin_clube` |
| Modelos | `/admin/modelos` | `admin_clube` |
| Classificação | `/admin/classificacao` | `admin_clube` |
| Ranking Campo | `/admin/ranking-clubes` | `admin_clube` |
| Auditoria | `/admin/auditoria` | `admin_clube` |
| LGPD | `/admin/lgpd` | `admin_clube` |
| Clubes | `/admin/clubes` | `admin_ti` |

Para **responsáveis puros** (só perfil de pais no clube), os atalhos administrativos são
ocultados; veem a visão dos filhos.

### 9.3. Telas administrativas (`app/admin/`)
| Tela | O que faz | Quem acessa |
|---|---|---|
| `acessos` | Lista/edita usuários, perfis e vínculos; reset de MFA | `gerenciar_acessos` |
| `aparencia` | Cores, logo e identidade visual do clube | `admin_clube` |
| `auditoria` | Log de ações sensíveis | `admin_clube` |
| `classificacao` | Classificação SGC oficial (DSA) | `admin_clube` |
| `clubes` | Criar/editar/desativar clubes e programas | `admin_ti` |
| `lgpd` | Gerenciar termos e ver aceites | `admin_clube` |
| `mensagens` | Compor e enviar avisos (+ fila WhatsApp) | `enviar_mensagens` |
| `menus-publicos` | Configurar menus/links públicos | `admin_clube` |
| `modelos` | Modelos de **pontuação** e **documentos** exigidos | `admin_clube` |
| `pre-cadastros` | Aprovar/recusar pré-cadastros públicos | `gerenciar_membros` |
| `ranking-clubes` | Ranking entre clubes do campo | `admin_clube` |
| `vincular-usuarios` | Ligar conta de login a um membro | `gerenciar_acessos` |

---

## 10. Módulos funcionais e regras de negócio

### 10.1. Autenticação e sessão
- Login por **e-mail + senha** (Supabase Auth).
- **MFA TOTP obrigatório** para perfis administrativos: se não houver fator verificado,
  fluxo de **setup**; se houver, exige **verify** (AAL2) a cada sessão.
- **Consentimento LGPD:** se o usuário ainda não aceitou o termo vigente, é barrado na tela
  de consentimento antes de entrar.
- **Expiração de sessão:** 48h (admin) / 7 dias (membro).
- Sessão persistida em `localStorage` com refresh automático de token (Supabase).

### 10.2. Membros (`membros.tsx`, `membro/[id].tsx`)
- Listagem com busca, filtro por unidade e status (ativo/inativo).
- Ficha individual: dados pessoais, foto, cargo (+ cargo adicional), documentos com anexos,
  classes, especialidades, e **responsáveis vinculados** (convidar/vincular/remover).
- **Inativar** (preserva histórico) vs **excluir permanentemente** (admin).
- **Janela de edição por pais:** `documentos_pais_config` define um período em que os pais
  podem anexar/editar documentos do filho (`janelaPaisAberta()`).

### 10.3. Pontuação (`pontuacao.tsx`, `extras.tsx`, `extrato/[dbv_id].tsx`)
- Critérios fixos: **Presença, Pontualidade, Material, Uniforme** (valores configuráveis).
- **Itens configuráveis por clube** (`pontuacao_itens`): cada clube cria/edita/desativa
  itens com título, sigla e valor.
- **Descontar pontos** (pontuação negativa): modal para aplicar desconto a vários membros.
- **Extrato:** histórico de pontos do membro.
- **Ranking** alimentado pela soma das pontuações.

### 10.4. Ranking (`ranking.tsx`, `admin/ranking-clubes.tsx`)
- Ranking **por membro** e **por unidade** (gráficos).
- **Ranking entre clubes** (visão de campo) para admins.

### 10.5. Atividades formativas (`atividades/index.tsx`) — módulo central
Fluxo de uma atividade:
```
CRIAÇÃO (admin/diretoria/conselheiro)
   ↓  define título, descrição, prazo, destino (clube/unidade/membro),
      item formativo (classe/especialidade), avaliador, anexos
ENTREGA (membro)  → status "entregue"
   ↓
AVALIAÇÃO (avaliador/admin)
   ├─ Aprovar  → status "aprovada" (+ nota, comentário) → pode gerar investidura/especialidade
   └─ Devolver → status "em_correcao" (com anotação) → membro Refaz
REABERTURA (admin) → volta de "aprovada" para "entregue" (remove aprovação)
```
Regras de negócio:
- **Destino/alvos:** clube todo, unidades específicas ou membros específicos
  (`atividades_alvos`).
- **Prazo:** entregas fora do prazo são **bloqueadas**; há **janela de reabertura**
  pós-aprovação configurável em que o membro pode editar.
- **Itens formativos:** atividade pode estar ligada a **classe** ou **especialidade** e, ao
  ser aprovada, registrar progresso/investidura (`gera_investidura`).
- **Planos formativos:** agrupam várias atividades de uma classe/especialidade e definem o
  número de avaliações necessárias.
- **Chat/histórico:** cada atividade tem histórico de mensagens (sistema, avaliador, membro).
- **Ordenação:** pendentes ordenadas pelo prazo mais próximo de vencer; cards de prazo
  encerrado ficam colapsados.
- **Visão de pais:** responsáveis veem as atividades pendentes dos filhos (badge laranja).
- **Visão de avaliador:** itens entregues aguardando avaliação (badge verde).
- **Progresso:** modal mostra quem entregou/aprovou por membro, com ações de avaliar/reabrir.

### 10.6. Agenda (`calendario.tsx`)
- Eventos por data, horário, local, responsável, apoio, material e observações.
- Divisão por **semestre**.
- Para pais/desbravadores é **somente leitura**.

### 10.7. Avisos/Mensagens (`mensagens.tsx`, `admin/mensagens.tsx`)
- Admin compõe avisos; opção de **fila WhatsApp** manual e **relatório de alcance** por membro.
- Membros recebem em `mensagens`: cards expansíveis, marca de **lido/não lido** (muda de
  cor), e **ocultar** mensagem por usuário.

### 10.8. Documentos (`admin/modelos.tsx`, ficha do membro)
- **Modelos de documentos** exigidos por programa/clube (obrigatório, limite de anexos —
  padrão 3).
- Status por documento: `OK` / `NOK` / `NA`.
- Anexos (imagem/PDF) por campo, com visualizador.

### 10.9. Campori (financeiro) (`campori.tsx`)
- Configuração de parcelas (nº, valores, vencimento).
- Registro de pagamentos por membro e parcela.

### 10.10. Relatórios (`relatorios/index.tsx`)
- **Visão formativa:** consolida classes, especialidades e investiduras por situação
  (`pronto`, `pendente_aprovacao`, `entregue`).
- Geração de **PDF** (impressão do navegador) com opção de incluir/excluir diretoria.

### 10.11. Importação (`importar/index.tsx`)
- Importa membros a partir de **planilha xlsx** (biblioteca `xlsx`).

### 10.12. Pré-cadastro e convites
- **Pré-cadastro público** (`pre-cadastro/[token].tsx`): formulário aberto por link;
  admin aprova em `admin/pre-cadastros`.
- **Convite de responsável** (`convite/[token].tsx`): link gerado na ficha do membro; ao
  aceitar (logado), cria vínculo em `responsavel_membros` via RPC
  `aceitar_convite_responsavel`.

### 10.13. Classe Bíblica (`classe-biblica/index.tsx`)
- Estudo bíblico interativo ("Jóias da Eternidade", 14 episódios) renderizado a partir de um
  **HTML estático** (`public/joias-da-eternidade.html`) dentro de um **iframe**.
- **Bridge `postMessage`:** o app injeta as respostas salvas (do Supabase) e recebe
  auto-saves do HTML, persistindo em `classe_biblica_respostas` (por usuário e clube).

### 10.14. Perfil e aparência
- `perfil.tsx`: dados do usuário logado, troca de contexto, logout.
- `admin/aparencia.tsx`: identidade visual do clube (cores/logo) — base para white-label.

---

## 11. Acesso a dados (web direto ao Supabase)

A aplicação é **online-first**: todas as telas leem e escrevem **diretamente no Supabase**
via `supabase-js`. Não há banco local nem fila de sincronização.

### Padrão de leitura
- Telas buscam dados sob **foco** (`useFocusEffect`) e após **ações** (re-fetch).
- O **contexto ativo** (`clube_id`) é sempre aplicado como filtro nas queries.
- O estado em memória (Zustand + estado local de tela) provê a reatividade da UI.

### Padrão de escrita
- Operações são **otimistas** na UI quando faz sentido (ex.: reabrir atividade atualiza o
  estado local imediatamente) e confirmadas pela resposta do Supabase.
- Updates sensíveis **verificam linhas afetadas** (`.select()` no update) para detectar
  bloqueios de RLS antes de refletir na interface.

### Sessão
- O cliente Supabase usa `localStorage` como storage de sessão no navegador, com
  `autoRefreshToken` e `persistSession` habilitados.

> **Implicação:** sem conexão, a aplicação não opera. Esse é um trade-off **intencional** —
> simplicidade e fonte de verdade única, sem a complexidade de reconciliação offline.

---

## 12. Exportação e importação de dados entre Supabases

A plataforma prevê **portabilidade de dados** entre projetos Supabase distintos — útil para:
- **Migração** (mudar de projeto/conta Supabase).
- **Clonagem** (criar um ambiente de homologação a partir de produção).
- **Backup/restore** lógico.
- **Onboarding de um novo clube** a partir de um modelo.

### 12.1. Abordagem A — Dump completo do banco (recomendado para migração total)
Usa as ferramentas nativas do Postgres/Supabase. Migra **todo** o schema + dados.

```bash
# Exportar (origem)
supabase db dump --db-url "postgresql://postgres:[SENHA]@db.[REF_ORIGEM].supabase.co:5432/postgres" \
  -f backup.sql

# Importar (destino) — primeiro aplique as migrations, depois os dados
psql "postgresql://postgres:[SENHA]@db.[REF_DESTINO].supabase.co:5432/postgres" -f backup.sql
```
- Use a **connection string** (Settings → Database) com a senha do Postgres.
- Para apenas dados (sem schema): `pg_dump --data-only`.

### 12.2. Abordagem B — Export/Import seletivo por tabela (JSON)
Scripts em `scripts/` usando a **service_role key**, ideais para migrar **um clube
específico** (`--clube-id`) ou um subconjunto de tabelas.

```bash
# Exporta dados → arquivos JSON em ./export/
node scripts/export-data.mjs --clube-id 1

# Importa os JSON em outro projeto (configurado por env do destino)
node scripts/import-data.mjs --dir ./export
```

**Desenho dos scripts (especificação):**
- Leem a lista de tabelas operacionais (todas com `clube_id`).
- `export-data.mjs`: para cada tabela, `SELECT * WHERE clube_id = ?` → grava
  `export/<tabela>.json`. Tabelas globais (`programas`) exportadas inteiras.
- `import-data.mjs`: para cada arquivo, faz `upsert` na tabela de destino, respeitando a
  **ordem de dependências** (programas → clubes → unidades → desbravadores → … → atividades).
- Remapeamento de IDs: como as PKs são `SERIAL`, o import deve **preservar IDs** (inserção
  com ID explícito) OU manter um **mapa de tradução** de IDs antigos→novos e reaplicar nas
  FKs. Para clonagem simples, preservar IDs é o caminho mais direto (destino vazio).
- **Arquivos do Storage** (fotos, anexos): migrados à parte, copiando os objetos entre os
  buckets de origem e destino (mesma estrutura de pastas por clube).

> ⚠️ A `service_role key` ignora RLS — rode os scripts **apenas em ambiente local seguro**,
> nunca no cliente. Veja `CREDENCIAIS_TOKENS_API.md`.

### 12.3. Ordem de importação (dependências)
```
programas → clubes → usuarios → usuario_clubes → responsavel_membros
        → unidades → desbravadores → documentos → documento_imagens
        → progresso_classes → especialidades
        → pontuacao_itens → pontuacoes → pontuacoes_custom
        → planos_formativos → atividades → atividades_alvos
        → atividades_anexos → atividades_respostas → atividades_mensagens
        → eventos → mensagens_clube (+ lidos/ocultos)
        → config_campori → parcelas_campori_config → pagamentos_campori
        → lgpd_termos → lgpd_aceites → classe_biblica_respostas
```

---

## 13. Segurança: RLS, MFA, LGPD

### 13.1. Row Level Security (RLS)
- **Habilitado em todas as tabelas operacionais.** A autorização real acontece no banco.
- **Regra base (papéis de clube):**
  ```sql
  clube_id IN (SELECT clube_id FROM usuario_clubes
               WHERE usuario_id = auth.uid() AND ativo = true)
  ```
- **`admin_ti`** tem acesso global.
- **Responsáveis** só acessam registros do **filho** vinculado:
  ```sql
  membro_id IN (SELECT membro_id FROM responsavel_membros
                WHERE usuario_id = auth.uid() AND ativo = true)
  ```
- Nunca confiar só no cliente: a UI esconde ações, mas o banco **impede** acesso indevido.

### 13.2. MFA (autenticação multifator)
- **TOTP** (Google Authenticator/Authy) **obrigatório para administradores**.
- O app força AAL2 (segundo fator) por sessão; sem isso, o admin não entra.

### 13.3. LGPD
- Termo de consentimento versionado (`lgpd_termos`); aceite registrado (`lgpd_aceites`).
- Bloqueio de acesso até o aceite do termo vigente.
- Admin gerencia termos em `admin/lgpd`.

### 13.4. Boas práticas de segredo
- Apenas **anon key** e **URL** ficam no cliente (`EXPO_PUBLIC_*`).
- **service_role** nunca vai ao app — só em scripts de servidor (migração/export-import).
- Sessão no navegador via `localStorage` com `autoRefreshToken`.

---

## 14. PWA e notificações

### PWA (`src/lib/pwa.ts`, `scripts/copy-pwa-assets.mjs`, `public/`)
- Service worker (`sw.js`) com `CACHE_NAME` versionado por timestamp a cada deploy
  (invalida cache automaticamente).
- Manifesto (`manifest.webmanifest`), ícones e fonte Ionicons injetados no `index.html` no
  passo de export.
- **Instalável** como app no celular/desktop (ícone na tela inicial, tela cheia).

### Notificações (Web Push)
- Registro de inscrição de **push do navegador** ao logar.
- Toque na notificação faz **deep-link** para a tela (`calendario`, `ranking`, `mensagens`,
  `atividades`).
- (Push depende de suporte do navegador a Service Worker + Push API.)

---

## 15. Boas práticas de engenharia adotadas

1. **Single source of truth de permissões** — matriz central, sem espalhar `if` de perfil
   pelo código.
2. **Segurança em profundidade** — RLS no banco + checagem de permissão na UI + MFA + LGPD.
3. **Migrations versionadas e ordenadas** — histórico reproduzível do schema.
4. **Online-first, fonte única de verdade** — sem banco local nem reconciliação; o Supabase
   é a verdade. Menos complexidade, menos bugs de sincronização.
5. **Web-only enxuto** — sem dependências nativas, sem build mobile; um único alvo (navegador).
6. **Roteamento declarativo por arquivos** — estrutura de `app/` espelha a navegação.
7. **Estado desacoplado** — Zustand para estado global, getters puros para o contexto ativo.
8. **Multitenancy por `clube_id`** — um único banco isolado por clube, em vez de N bancos.
9. **Dados portáveis** — export/import entre Supabases por dump completo ou por clube (JSON).
10. **Tema/identidade configurável** — caminho para white-label sem mexer no código.
11. **Tratamento de borda explícito** — verificação de linhas afetadas em updates sensíveis,
    fallbacks de perfil, mensagens de erro claras quando RLS bloqueia.
12. **CI/CD manual disciplinado** — toda mudança vira commit + deploy web; nada fica solto.
13. **Separação de segredos** — `.env` e arquivo de credenciais fora do versionamento.

### Pontos de atenção
- Telas grandes (ex.: `atividades/index.tsx`) concentram muita lógica — candidatas a
  extração de hooks/componentes.
- Por ser online-first, **toda a experiência depende de conexão** — garantir bom feedback de
  carregamento e de erro de rede.

---

## 16. Como construir este projeto com uma IA

Esta seção é um **briefing de especificação**: entregue-a a uma IA para gerar a plataforma.

### 16.1. Objetivo
> "Construa uma **plataforma web (PWA) multiclube** de gestão de Clubes de Desbravadores e
> Aventureiros. **Sem app mobile, sem APK, sem módulos offline.** Toda a aplicação roda no
> navegador e fala diretamente com o Supabase."

### 16.2. Stack obrigatória
- Expo + **React Native Web** + Expo Router + TypeScript (alvo: navegador).
- Zustand (estado) + TanStack Query (queries).
- Supabase (PostgreSQL + Auth + Storage + RLS).
- **Sem** expo-sqlite, **sem** NetInfo, **sem** fila de sync, **sem** expo-secure-store,
  **sem** EAS/app build. Sessão via `localStorage`.
- Deploy: `expo export --platform web` → **Cloudflare Pages** (branch `main` = produção).

### 16.3. Modelo de dados mínimo (multiclube desde a 1ª migration)
Implemente as tabelas das seções 5.1–5.7. Não negocie:
- `programas`, `clubes`, `usuarios`, `usuario_clubes`, `responsavel_membros`.
- `desbravadores` (membros), `unidades`, `documentos` (+ anexos), `progresso_classes`,
  `especialidades`.
- `pontuacoes` + `pontuacao_itens` (itens configuráveis por clube).
- `atividades` + `atividades_alvos` + `atividades_respostas` + `atividades_mensagens` +
  `planos_formativos`.
- `eventos`, `mensagens_clube` (+ lidos/ocultos), `config_campori`/`pagamentos_campori`.
- `lgpd_termos`/`lgpd_aceites`, auditoria, `pre_cadastros`, `classe_biblica_respostas`.
- **Toda tabela operacional nasce com `clube_id` e RLS.** Nada de IDs de clube fixos no código.

### 16.4. Regras de autorização (RLS) — implementar exatamente
- Papéis de clube filtram por `clube_id ∈ usuario_clubes(auth.uid())`.
- `admin_ti` = acesso global.
- Responsável só acessa `membro_id ∈ responsavel_membros(auth.uid())`.

### 16.5. Perfis e permissões
Replique a **matriz da seção 8** (perfil → permissões) e o conceito de **contexto ativo**
(seleção pós-login quando há múltiplos vínculos) com **permissões mescladas** no mesmo clube.

### 16.6. Fluxos de negócio críticos
1. **Login → MFA (admins) → LGPD → seleção de contexto → app.**
2. **Atividade:** criação → entrega → avaliação (aprovar/devolver) → reabertura; vínculo a
   classes/especialidades com geração de investidura; bloqueio por prazo.
3. **Pontuação:** itens configuráveis por clube + descontos; ranking por membro/unidade.
4. **Documentos:** modelos por programa, status + anexos, janela de edição por pais.
5. **Responsáveis:** convite por token → vínculo → visão restrita aos filhos.
6. **Acesso a dados:** sempre online, direto ao Supabase, filtrado por contexto ativo.

### 16.7. Telas mínimas (seção 9)
Login, MFA, Consentimento, Seleção de contexto, Dashboard, Ranking, Membros, Ficha do
membro, Pontuação, Extras, Atividades (com modais de detalhes/progresso/avaliação), Agenda,
Avisos, Unidades, Relatórios, Importar, Perfil, e telas admin (acessos, modelos, clubes,
aparência, mensagens, pré-cadastros, auditoria, LGPD, classificação).

### 16.8. Portabilidade de dados (obrigatória)
Inclua `scripts/export-data.mjs` e `scripts/import-data.mjs` (seção 12) para migrar dados
entre projetos Supabase, com suporte a export por `clube_id` e ordem de importação por
dependências.

### 16.9. Não funcionais
- Sessão: 48h admin / 7 dias membro.
- PWA instalável com service worker versionado.
- Web push com deep-link por tela.
- Identidade visual configurável (white-label-ready).
- **Deploy exclusivamente web** (Cloudflare Pages). **Nenhum** pipeline mobile.

### 16.10. Prompt-resumo para a IA
> "Implemente uma plataforma **web PWA** com Expo + React Native Web + Supabase, **multiclube
> desde a origem** (programas Desbravadores e Aventureiros), **sem qualquer código offline,
> SQLite ou build mobile**. Inclua login + MFA TOTP para admins + consentimento LGPD +
> seleção de contexto. Modele membros, unidades, documentos com anexos, classes,
> especialidades, pontuação configurável por clube, ranking, atividades formativas com fluxo
> de entrega/avaliação/aprovação/reabertura vinculadas a classes e especialidades, agenda,
> avisos, financeiro de campori, e acesso de pais restrito aos filhos. Use RLS por `clube_id`
> em todas as tabelas, sessão via localStorage, e deploy apenas web no Cloudflare Pages.
> Forneça scripts de export/import de dados entre projetos Supabase. Permissões em matriz
> central; toda autorização real no banco via RLS."

---

*Fim da documentação. Para credenciais, ver `CREDENCIAIS_TOKENS_API.md` (não versionado).
Para hospedagem/setup e migração de dados, ver `GUIA_HOSPEDAGEM_E_SETUP.md`.*
