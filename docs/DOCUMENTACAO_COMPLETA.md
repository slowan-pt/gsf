# 📘 Documentação Completa — Plataforma DBV Fonseca

> Documento técnico-descritivo do projeto, escrito para dois públicos:
> 1. **Humanos** (desenvolvedores, mantenedores, diretoria) que precisam entender a
>    estrutura, as regras e como operar o sistema.
> 2. **Uma IA** que receba este documento como especificação para **reconstruir** uma
>    plataforma equivalente do zero.
>
> Documentos complementares:
> - `GUIA_HOSPEDAGEM_E_SETUP.md` — como hospedar, criar o banco e publicar.
> - `CREDENCIAIS_TOKENS_API.md` — chaves e segredos (não versionado).
> - `modelagem-multiclube.md` — projeto detalhado do modelo multiclube.

Versão do app: **1.0.10** · Última atualização desta doc: **2026-06-02**

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
11. [Sincronização offline-first](#11-sincronização-offline-first)
12. [Segurança: RLS, MFA, LGPD](#12-segurança-rls-mfa-lgpd)
13. [Notificações e PWA](#13-notificações-e-pwa)
14. [Boas práticas de engenharia adotadas](#14-boas-práticas-de-engenharia-adotadas)
15. [Como reconstruir este projeto com uma IA](#15-como-reconstruir-este-projeto-com-uma-ia)

---

## 1. Visão geral e propósito

**DBV Fonseca** é uma plataforma de gestão para **Clubes de Desbravadores e Aventureiros**
(ministério jovem da Igreja Adventista). Nasceu para um clube específico (Fonseca) e evoluiu
para uma arquitetura **multiclube**: vários clubes e dois programas (Desbravadores e
Aventureiros) coexistem na mesma base de dados, isolados por `clube_id` e protegidos por RLS.

O sistema funciona como:
- **App Web (PWA)** — instalável, hospedado no Cloudflare Pages.
- **App Android nativo** — empacotado via Expo EAS (APK/AAB).
- Ambos compartilham **100% do código** (React Native + React Native Web).

### Objetivos do produto
- Cadastro e acompanhamento de membros (desbravadores/aventureiros).
- Controle de **documentação** obrigatória (ficha de saúde, RG, autorizações, etc.).
- **Pontuação** semanal gamificada e **ranking** por membro e por unidade.
- **Atividades formativas** com fluxo de entrega → avaliação → aprovação, incluindo
  classes e especialidades.
- **Agenda** de eventos do clube.
- **Avisos/mensagens** para os membros.
- **Gestão financeira** de Campori (parcelas e pagamentos).
- Acesso de **pais/responsáveis** à visão dos filhos.
- **Classe Bíblica** (estudo bíblico interativo).

---

## 2. Stack tecnológica

### Frontend / App
| Tecnologia | Versão | Papel |
|---|---|---|
| **React Native** | 0.81 | Base do app (mobile) |
| **React** | 19.1 | Biblioteca de UI |
| **React Native Web** | 0.21 | Renderiza o mesmo código no navegador |
| **Expo** | ~54 | Toolchain, build, APIs nativas |
| **Expo Router** | ^6 | Roteamento por arquivos (file-based routing) |
| **TypeScript** | ~5.9 | Tipagem estática |
| **Zustand** | ^5 | Gerência de estado global (stores) |
| **TanStack Query** | ^5 | Cache/queries assíncronas |
| **expo-sqlite** | ^16 | Banco local (offline-first, mobile) |
| **date-fns** | ^4 | Datas e formatação (locale pt-BR) |
| **react-native-gifted-charts** | gráficos do ranking |
| **xlsx** | importação de planilhas |
| **@expo/vector-icons** (Ionicons) | ícones |

### Backend / Infra
| Tecnologia | Papel |
|---|---|
| **Supabase** | PostgreSQL gerenciado + Auth + Storage + RLS + Realtime |
| **Cloudflare Pages** | Hospedagem do PWA |
| **Expo EAS** | Build e distribuição mobile |
| **Expo Notifications / FCM** | Push notifications |

### APIs nativas usadas (Expo)
`expo-notifications`, `expo-secure-store` (tokens seguros), `expo-image-picker`,
`expo-document-picker`, `expo-file-system`, `expo-print` (PDF de relatórios),
`expo-sharing`, `expo-device`, `expo-network`, `@react-native-community/netinfo`.

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
│  supabase, database (SQLite), sync, permissoes, contextoAtual│
│  notifications, lgpd, auditoria, modelosPrograma, …          │
└───────────────────────────┬─────────────────────────────────┘
                            │ acessa
┌───────────────────────────▼─────────────────────────────────┐
│  PERSISTÊNCIA                                                 │
│  • Local: SQLite (mobile) / memória+localStorage (web)       │
│  • Remoto: Supabase (PostgreSQL + Storage)                   │
└──────────────────────────────────────────────────────────────┘
```

### 3.2. Padrões e decisões-chave
- **File-based routing (Expo Router):** cada arquivo em `app/` é uma rota. Pastas com
  `(parênteses)` são grupos que não entram na URL (ex.: `(tabs)`). Colchetes são parâmetros
  dinâmicos (ex.: `membro/[id].tsx`).
- **Offline-first (mobile):** o app lê/escreve no **SQLite local** e usa uma **fila de
  sincronização** (`fila_sync`) para enviar mudanças ao Supabase quando há internet. No
  **web**, opera direto contra o Supabase (sem SQLite).
- **Plataforma condicional:** `Platform.OS === 'web'` separa comportamentos. Há até arquivos
  específicos por plataforma: `database.ts` (mobile) e `database.web.ts` (web).
- **Estado por contexto ativo:** todo dado é filtrado pelo **contexto ativo** (clube +
  programa + perfil), recuperado via `getClubeAtivoId()`, `getProgramaAtivoId()`, etc.
- **Permissões declarativas:** uma **matriz central** (`src/lib/permissoes.ts`) mapeia
  perfil → permissões. A UI consulta `usePermissoes().pode('...')`.
- **Segurança no servidor (RLS):** a autorização real é feita por **Row Level Security** no
  Postgres, não confiando apenas no cliente.
- **Migrations versionadas:** todo o schema evolui por arquivos numerados em
  `supabase/migrations/` (`001` … `047`), aplicados em ordem.
- **Componentização leve:** componentes reutilizáveis em `src/components/` (ex.: `BottomNav`,
  `DateField`, `Avatar`). Telas grandes concentram a lógica de domínio.
- **Tema/identidade configurável:** cores de navegação centralizadas (`navTheme.ts`),
  paleta de atividades personalizável por clube (`paletaAtividades.ts`).

---

## 4. Estrutura de diretórios

```
fonseca-app/
├── app/                          # ROTAS (Expo Router) — camada de apresentação
│   ├── _layout.tsx               # Layout raiz: Stack, init, notificações, fontes
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
│   │   ├── dbvStore.ts           # Desbravadores/membros
│   │   ├── pontuacaoStore.ts     # Pontuação e itens configuráveis
│   │   └── camporiStore.ts       # Campori (parcelas/pagamentos)
│   │
│   ├── lib/                      # Serviços e utilitários
│   │   ├── supabase.ts           # Cliente Supabase (storage seguro por plataforma)
│   │   ├── database.ts           # SQLite (mobile)
│   │   ├── database.web.ts       # Stub/variante web
│   │   ├── sync.ts               # Pull do Supabase + fila de sincronização
│   │   ├── permissoes.ts         # Matriz de perfis → permissões + hook
│   │   ├── contextoAtual.ts      # Getters do contexto ativo (clube/programa/…)
│   │   ├── notifications.ts      # Registro de token + envio de push
│   │   ├── lgpd.ts               # Verificação/registro de consentimento
│   │   ├── auditoria.ts          # Registro de eventos de auditoria
│   │   ├── modelosPrograma.ts    # Classes/cargos/documentos por programa
│   │   ├── documentosPaisConfig.ts # Janela de edição de docs por pais
│   │   ├── paletaAtividades.ts   # Tema visual das atividades
│   │   ├── navTheme.ts           # Cores da navegação
│   │   ├── publicMenuConfig.ts   # Configuração de menus públicos
│   │   ├── pwa.ts                # Registro do service worker (PWA)
│   │   └── seed_local.ts         # Popular SQLite local na 1ª execução
│   │
│   └── types/index.ts            # Tipos TypeScript do domínio
│
├── supabase/migrations/          # Migrations SQL versionadas (001 … 047)
├── public/                       # Assets estáticos do web (PWA, sw.js, joias-da-eternidade.html)
├── scripts/                      # Scripts de build (copy-pwa-assets.mjs)
├── docs/                         # Esta documentação
├── assets/                       # Ícones, splash, imagens
│
├── app.json                      # Config Expo (nome, ícones, package, permissões)
├── eas.json                      # Perfis de build EAS (preview/production)
├── package.json                  # Dependências e scripts npm
├── .env / .env.example           # Variáveis de ambiente (Supabase)
├── setup_supabase.mjs            # Automação de setup do banco
└── metro.config.js / tsconfig.json
```

---

## 5. Modelo de dados (banco)

O banco é **PostgreSQL** (Supabase). As tabelas evoluíram do modelo single-club (001) para
multiclube (010+). Abaixo, os agrupamentos lógicos.

### 5.1. Identidade e acesso
| Tabela | Função |
|---|---|
| `auth.users` | Usuários do Supabase Auth (gerenciado) |
| `usuarios` | Perfil de aplicação ligado a `auth.users` (nome, perfil, unidade) |
| `programas` | Desbravadores / Aventureiros (faixas etárias, regras) |
| `clubes` | Cada clube (pertence a 1 programa; tem cor, logo, nome curto) |
| `usuario_clubes` | Vínculo usuário ↔ clube ↔ perfil ↔ unidade (papéis operacionais) |
| `responsavel_membros` | Vínculo familiar usuário ↔ membro (pais/responsáveis) |

### 5.2. Membros e dados formativos
| Tabela | Função |
|---|---|
| `desbravadores` | Membros (nome, nascimento, gênero, unidade, cargo, foto, ativo) |
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
| `pontuacao_itens` | **Itens de pontuação configuráveis** por clube (fonte única atual) |
| `config_pontuacao_itens` | Tabela legada de itens (migrada para `pontuacao_itens`) |
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
| `fila_sync` (SQLite local) | Fila de operações offline a sincronizar |

> **Regra transversal:** toda tabela operacional carrega `clube_id` e é protegida por RLS,
> garantindo isolamento entre clubes.

---

## 6. Modelo multiclube e contextos de acesso

### 6.1. Conceitos
- **Programa:** Desbravadores (10–15 anos) ou Aventureiros (6–9 anos). Define classes,
  cargos, especialidades e faixas etárias.
- **Clube:** pertence a **um** programa. "Fonseca Desbravadores" e "Fonseca Aventureiros"
  são **clubes distintos**, mesmo na mesma igreja.
- **Usuário:** apenas a identidade de login. **Não tem perfil global fixo** — acumula papéis.
- **Vínculo operacional** (`usuario_clubes`): define que a pessoa é, ex., diretoria no
  clube X e conselheiro no clube Y.
- **Vínculo familiar** (`responsavel_membros`): define que a pessoa é responsável por um
  membro específico (acesso restrito ao filho, nunca ao clube inteiro).

### 6.2. Contexto de acesso
Após o login, o sistema monta a lista de **contextos** disponíveis (cada combinação de
clube + perfil ou clube + filho vira um contexto). Lógica em `contextoStore.ts`:

1. Busca vínculos em `usuario_clubes` e `responsavel_membros`.
2. Para `admin_ti`, gera um contexto para **cada clube** ativo da plataforma.
3. Monta a lista de `ContextoAcesso` (clube, programa, perfil, membro quando aplicável).
4. **Se houver 1 contexto → entra direto.** Se houver vários → tela de seleção
   (`auth/contexto.tsx`). O contexto escolhido é persistido (`AsyncStorage`).

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

Perfis definidos em `src/types/index.ts` e na matriz de `permissoes.ts`. Há perfis **legados**
(modelo antigo) mapeados para os **novos** via `PERFIS_LEGADOS`:

| Legado | Novo (efetivo) |
|---|---|
| `admin_total` | `admin_ti` |
| `admin_geral` | `admin_clube` |
| `admin_diretoria` | `usuario_diretoria` |
| `desbravador` | `usuario_desbravador` |

### Perfis ativos e escopo
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
Após expirar, a sessão local é invalidada e exige novo login.

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
- **Fallback de perfil:** se a leitura em `usuarios` falhar por RLS, monta um usuário mínimo
  (responsável ou desbravador) a partir do `auth.users`.
- **Expiração de sessão:** 48h (admin) / 7 dias (membro), controlada localmente.

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
  itens com título, sigla e valor. Fonte única após a migração (antes havia
  `config_pontuacao_itens` legada — sincronizada na migration 046).
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
- **Destino/alvos:** atividade pode ir para o clube todo, unidades específicas ou membros
  específicos (`atividades_alvos`).
- **Prazo:** entregas fora do prazo são **bloqueadas** (migration 033); há **janela de
  reabertura** pós-aprovação configurável (044) em que o membro pode editar.
- **Itens formativos:** uma atividade pode estar ligada a uma **classe** ou **especialidade**
  e, ao ser aprovada, registrar progresso/investidura (`gera_investidura`).
- **Planos formativos:** agrupam várias atividades de uma classe/especialidade e definem o
  número de avaliações necessárias.
- **Chat/histórico:** cada atividade tem um histórico de mensagens (sistema, avaliador,
  membro) — `atividades_mensagens`.
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
- Admin compõe avisos (`admin/mensagens`); opção de **fila WhatsApp** manual e **relatório
  de alcance** por membro.
- Membros recebem em `mensagens`: cards expansíveis, marca de **lido/não lido** (muda de
  cor), e **ocultar** mensagem por usuário.

### 10.8. Documentos (`admin/modelos.tsx`, ficha do membro)
- **Modelos de documentos** exigidos definidos por programa/clube (obrigatório, limite de
  anexos — padrão 3).
- Status por documento: `OK` / `NOK` / `NA`.
- Anexos (imagem/PDF) por campo, com visualizador.

### 10.9. Campori (financeiro) (`campori.tsx`)
- Configuração de parcelas (nº, valores, vencimento).
- Registro de pagamentos por membro e parcela.
- Padrão inicial: 4 parcelas (130/130/90/90).

### 10.10. Relatórios (`relatorios/index.tsx`)
- **Visão formativa:** consolida classes, especialidades e investiduras por situação
  (`pronto`, `pendente_aprovacao`, `entregue`).
- Geração de **PDF** (via `expo-print`) com opção de incluir/excluir diretoria.
- Registrar entrega formativa (marca especialidade/classe como concluída/investida).

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
  auto-saves do HTML, persistindo em `classe_biblica_respostas` (por usuário e clube). O
  HTML também guarda cópia em `localStorage` como fallback offline.

### 10.14. Perfil e aparência
- `perfil.tsx`: dados do usuário logado, troca de contexto, logout.
- `admin/aparencia.tsx`: identidade visual do clube (cores/logo) — preparada para
  white-label futuro.

---

## 11. Sincronização offline-first

Implementada em `src/lib/sync.ts`. **Mobile** opera offline; **web** vai direto ao Supabase.

### Pull (Supabase → SQLite)
`puxarDeSupabase()` baixa todas as tabelas relevantes e faz `INSERT OR REPLACE` no SQLite
local (unidades, desbravadores, documentos, classes, especialidades, pontuações, campori,
mensagens, atividades e relacionadas). É chamado após login e no boot do app (mobile).

### Push (SQLite → Supabase)
- Mudanças locais entram numa **fila** (`fila_sync`) via `adicionarFilaSync(tabela, op, dados)`.
- `sincronizarTudo()` processa a fila em ordem: `INSERT/UPDATE → upsert`, `DELETE → delete`.
- Operações com erro permanecem na fila para nova tentativa.

### Detecção de rede
`temConexao()` usa `navigator.onLine` (web) ou `NetInfo` (mobile).

> **Implicação de design:** IDs locais (SQLite) e remotos (Supabase) coexistem; tabelas
> espelhadas guardam `supabase_id` para reconciliar. A escrita é **otimista** na UI e
> confirmada pela sincronização.

---

## 12. Segurança: RLS, MFA, LGPD

### 12.1. Row Level Security (RLS)
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
- Nunca confiar só no cliente: a UI esconde ações, mas o banco **impede** o acesso indevido.

### 12.2. MFA (autenticação multifator)
- **TOTP** (Google Authenticator/Authy) **obrigatório para administradores**.
- O app força AAL2 (segundo fator) por sessão; sem isso, o admin não entra.

### 12.3. LGPD
- Termo de consentimento versionado (`lgpd_termos`); aceite registrado (`lgpd_aceites`).
- Bloqueio de acesso até o aceite do termo vigente.
- Admin gerencia termos em `admin/lgpd`.

### 12.4. Boas práticas de segredo
- Apenas **anon key** e **URL** ficam no cliente (`EXPO_PUBLIC_*`).
- **service_role** nunca vai ao app — só em scripts de servidor.
- Tokens de sessão no mobile usam **expo-secure-store** (keychain/keystore); no web,
  `localStorage` com `autoRefreshToken`.

---

## 13. Notificações e PWA

### Push (`src/lib/notifications.ts`, `_layout.tsx`)
- Registra o **token de push** por dispositivo ao logar.
- Toque na notificação faz **deep-link** para a tela (`calendario`, `ranking`, `mensagens`,
  `atividades`).

### PWA (`src/lib/pwa.ts`, `scripts/copy-pwa-assets.mjs`, `public/`)
- Service worker (`sw.js`) com `CACHE_NAME` versionado por timestamp a cada deploy
  (invalida cache automaticamente).
- Manifesto (`manifest.webmanifest`), ícones e fonte Ionicons injetados no `index.html` no
  passo de export.
- Instalável como app no celular/desktop.

---

## 14. Boas práticas de engenharia adotadas

1. **Single source of truth de permissões** — matriz central, sem espalhar `if` de perfil
   pelo código.
2. **Segurança em profundidade** — RLS no banco + checagem de permissão na UI + MFA + LGPD.
3. **Migrations versionadas e ordenadas** — histórico reproduzível do schema (`001…047`).
4. **Offline-first com fila de sync** — resiliência a conexões instáveis (realidade de
   acampamentos/igrejas).
5. **Código único multiplataforma** — React Native + RN Web; divergências isoladas por
   `Platform.OS` e arquivos `.web.ts`.
6. **Roteamento declarativo por arquivos** — estrutura de `app/` espelha a navegação.
7. **Estado desacoplado** — Zustand para estado global, getters puros para o contexto ativo.
8. **Multitenancy por `clube_id`** — um único banco isolado por clube, em vez de N bancos.
9. **Tema/identidade configurável** — caminho para white-label sem mexer no código.
10. **Tratamento de borda explícito** — fallbacks de perfil, falhas de rede silenciosas,
    verificação de linhas afetadas em updates sensíveis (ex.: reabrir atividade confirma
    que a linha foi atualizada antes de refletir na UI).
11. **CI/CD manual disciplinado** — toda mudança vira commit + deploy; nada fica solto.
12. **Separação de segredos** — `.env` e arquivo de credenciais fora do versionamento.

### Pontos de atenção / dívidas técnicas conhecidas
- Telas grandes (ex.: `atividades/index.tsx`) concentram muita lógica — candidatas a
  extração de hooks/componentes.
- Coexistência de tabelas legadas e novas (perfis, itens de pontuação) — manter o caminho de
  migração documentado.
- No web não há SQLite; algumas funcionalidades offline são exclusivas do mobile.

---

## 15. Como reconstruir este projeto com uma IA

Esta seção é um **briefing de especificação**: entregue-a a uma IA para gerar uma plataforma
equivalente.

### 15.1. Objetivo
> "Construa uma plataforma multiclube de gestão de Clubes de Desbravadores e Aventureiros,
> com app **Web (PWA)** e **Android**, compartilhando código. Backend serverless gratuito."

### 15.2. Stack obrigatória
- Expo (React Native) + Expo Router + React Native Web + TypeScript.
- Zustand (estado) + TanStack Query (queries).
- Supabase (PostgreSQL + Auth + Storage + RLS).
- SQLite local (expo-sqlite) com fila de sincronização para offline-first no mobile.
- Cloudflare Pages (deploy web) + Expo EAS (build mobile).

### 15.3. Modelo de dados mínimo
Implemente as tabelas das seções 5.1–5.7. Não negocie:
- `programas`, `clubes`, `usuarios`, `usuario_clubes`, `responsavel_membros` (multiclube).
- `desbravadores` (membros), `unidades`, `documentos` (+ anexos), `progresso_classes`,
  `especialidades`.
- `pontuacoes` + `pontuacao_itens` (itens configuráveis por clube).
- `atividades` + `atividades_alvos` + `atividades_respostas` + `atividades_mensagens` +
  `planos_formativos`.
- `eventos`, `mensagens_clube` (+ lidos/ocultos), `config_campori`/`pagamentos_campori`.
- `lgpd_termos`/`lgpd_aceites`, auditoria, `pre_cadastros`.
- **Toda tabela operacional tem `clube_id`.**

### 15.4. Regras de autorização (RLS) — implementar exatamente
- Papéis de clube filtram por `clube_id ∈ usuario_clubes(auth.uid())`.
- `admin_ti` = acesso global.
- Responsável só acessa `membro_id ∈ responsavel_membros(auth.uid())`.

### 15.5. Perfis e permissões
Replique a **matriz da seção 8** (perfil → permissões) e o conceito de **contexto ativo**
(seleção pós-login quando há múltiplos vínculos) com **permissões mescladas** no mesmo clube.

### 15.6. Fluxos de negócio críticos
1. **Login → MFA (admins) → LGPD → seleção de contexto → app.**
2. **Atividade:** criação → entrega → avaliação (aprovar/devolver) → reabertura; vínculo a
   classes/especialidades com geração de investidura; bloqueio por prazo.
3. **Pontuação:** itens configuráveis por clube + descontos; ranking por membro/unidade.
4. **Documentos:** modelos por programa, status + anexos, janela de edição por pais.
5. **Responsáveis:** convite por token → vínculo → visão restrita aos filhos.
6. **Offline-first:** ler/escrever local + fila de sync no mobile.

### 15.7. Telas mínimas (seção 9)
Login, MFA, Consentimento, Seleção de contexto, Dashboard, Ranking, Membros, Ficha do
membro, Pontuação, Extras, Atividades (com modais de detalhes/progresso/avaliação), Agenda,
Avisos, Unidades, Relatórios, Importar, Perfil, e telas admin (acessos, modelos, clubes,
aparência, mensagens, pré-cadastros, auditoria, LGPD, classificação).

### 15.8. Não funcionais
- Sessão: 48h admin / 7 dias membro.
- PWA instalável com service worker versionado.
- Push com deep-link por tela.
- Identidade visual configurável (white-label-ready).
- Deploy: `expo export` → Cloudflare Pages (branch `main` = produção); mobile via EAS.

### 15.9. Prompt-resumo para a IA
> "Implemente uma plataforma Expo (RN + RN Web) + Supabase, multiclube (programas
> Desbravadores e Aventureiros), com login + MFA TOTP para admins + consentimento LGPD +
> seleção de contexto. Modele membros, unidades, documentos com anexos, classes,
> especialidades, pontuação configurável por clube, ranking, atividades formativas com fluxo
> de entrega/avaliação/aprovação/reabertura vinculadas a classes e especialidades, agenda,
> avisos, financeiro de campori, e acesso de pais restrito aos filhos. Use RLS por `clube_id`,
> offline-first com SQLite + fila de sync no mobile, e deploy web no Cloudflare Pages e mobile
> via EAS. Permissões em matriz central; toda autorização real no banco via RLS."

---

*Fim da documentação. Para credenciais, ver `CREDENCIAIS_TOKENS_API.md` (não versionado).
Para hospedagem/setup, ver `GUIA_HOSPEDAGEM_E_SETUP.md`.*
