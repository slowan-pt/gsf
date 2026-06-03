# 🚀 Guia de Hospedagem, Banco de Dados e Migração de Dados (Web/PWA)

Este guia ensina, passo a passo, como colocar a plataforma no ar usando **apenas serviços
com plano gratuito**. A plataforma é um **PWA web puro** — não há build de APK/iOS, não há
módulos offline. Tudo roda no navegador, falando diretamente com o Supabase.

---

## 1. Arquitetura de hospedagem (visão geral)

```
┌──────────────────────────────────────────────────────────────────┐
│                          USUÁRIO FINAL                            │
│            ┌────────────────────────────────────────┐             │
│            │   App Web (PWA)                         │             │
│            │   navegador no celular / desktop        │             │
│            │   (instalável na tela inicial)          │             │
│            └────────────────────┬───────────────────┘             │
└─────────────────────────────────┼─────────────────────────────────┘
                                  │ HTTPS
                       ┌──────────▼──────────┐
                       │  CLOUDFLARE PAGES   │
                       │  (hospeda o PWA)    │
                       │  *.pages.dev        │
                       └──────────┬──────────┘
                                  │ API REST + Realtime + Auth
                       ┌──────────▼──────────────────┐
                       │        SUPABASE             │
                       │  ┌──────────────────────┐   │
                       │  │ PostgreSQL (dados)   │   │
                       │  │ Auth (login + MFA)   │   │
                       │  │ Storage (arquivos)   │   │
                       │  │ RLS (segurança)      │   │
                       │  └──────────────────────┘   │
                       └─────────────────────────────┘
```

**Camadas e custo:**

| Camada | Serviço | Plano grátis cobre? |
|---|---|---|
| Banco de dados + Auth + Storage | **Supabase** | Sim (até 500MB DB, 1GB storage, 50k MAU) |
| Hospedagem do app web (PWA) | **Cloudflare Pages** | Sim (builds e banda generosos) |

> Não há camada mobile. Não existe Expo EAS, Play Store, App Store, FCM nem keystore.

---

## 2. Passo a passo: criar o banco de dados (Supabase)

### 2.1. Criar o projeto
1. Acesse https://supabase.com → **Sign in** (pode usar conta GitHub).
2. **New Project**.
   - **Name:** o nome da sua plataforma/clube.
   - **Database Password:** gere uma senha forte e **guarde no arquivo de credenciais**.
   - **Region:** `South America (São Paulo)` — menor latência no Brasil.
3. Aguarde ~2 minutos até o provisionamento terminar.

### 2.2. Pegar as chaves de API
No painel do projeto → **Settings → API**:
- **Project URL** → vai para `EXPO_PUBLIC_SUPABASE_URL`.
- **anon / public key** → vai para `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **service_role key** → guarde no arquivo de credenciais (uso só em scripts de migração/
  export-import). **Nunca** vai para o app.

### 2.3. Criar o schema (tabelas, RLS, seeds)
No painel → **SQL Editor → New query**. Execute as migrations **na ordem numérica**,
uma por vez, copiando o conteúdo de cada arquivo de `supabase/migrations/`.

> A plataforma é **multiclube desde a primeira migration**: programas, clubes, vínculos e
> RLS por `clube_id` fazem parte da fundação. Garanta que ao final existam pelo menos:
> - um registro em `programas` (ex.: `desbravadores`);
> - um registro em `clubes` vinculado a esse programa;
> - as políticas RLS habilitadas em todas as tabelas operacionais.

### 2.4. Configurar o Storage (arquivos/anexos)
1. Painel → **Storage → Create bucket**.
2. Crie os buckets usados (ex.: `documentos`, `fotos`, `anexos`, `atividades`).
3. Aplique as políticas de acesso por **pasta de clube** (`supabase_storage_setup.sql`).

### 2.5. Configurar autenticação
1. Painel → **Authentication → Providers** → mantenha **Email** habilitado.
2. **MFA:** a plataforma exige MFA (TOTP) para perfis administrativos — o Supabase já
   suporta TOTP nativamente, não precisa configurar nada extra.

### 2.6. Criar os primeiros usuários e vínculos (multiclube)
- **Authentication → Users → Add user** (e-mail + senha).
- Vincule o usuário a um clube e perfil na tabela **`usuario_clubes`** (modelo multiclube):
```sql
-- 1) Perfil de aplicação
INSERT INTO usuarios (id, email, nome)
VALUES ((SELECT id FROM auth.users WHERE email='diretor@clube.app'),
        'diretor@clube.app', 'Diretor');

-- 2) Vínculo operacional com o clube (define o perfil naquele clube)
INSERT INTO usuario_clubes (usuario_id, clube_id, perfil, ativo)
VALUES ((SELECT id FROM auth.users WHERE email='diretor@clube.app'),
        1, 'admin_clube', true);
```

---

## 3. Passo a passo: rodar localmente (desenvolvimento)

### Pré-requisitos
- **Node.js** 18+ e **npm**.
- **Git**.
- Um navegador moderno.

### Comandos
```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env
# edite .env com a URL e a anon key do seu Supabase

# 3. Rodar (web)
npm run web        # abre no navegador em modo desenvolvimento

# 4. Checagem de tipos
npm run typecheck
```

---

## 4. Passo a passo: publicar o app WEB (Cloudflare Pages — grátis)

### 4.1. Primeira vez
1. Crie conta em https://dash.cloudflare.com.
2. Autentique o Wrangler: `npx wrangler login` (abre o navegador).

### 4.2. Deploy
```bash
npm run web:deploy
```
Este comando faz, em sequência:
1. `expo export --platform web` → gera o site estático em `dist/`.
2. `node scripts/copy-pwa-assets.mjs` → injeta manifesto PWA, service worker, fontes.
3. `wrangler pages deploy dist --project-name <SEU_PROJETO> --branch main` → publica.

> O `--branch main` define o deploy como **Produção**. Sem isso, vira um preview.

### 4.3. Domínio próprio (opcional)
- Cloudflare Pages → seu projeto → **Custom domains** → adicione seu domínio e ajuste o DNS.

### 4.4. Fluxo de trabalho de deploy (CI/CD manual adotado)
> Regra de ouro: **toda mudança de código vira commit + deploy**, sem deixar alterações soltas.
```bash
git add <arquivos relevantes>
git commit -m "tipo: descrição objetiva"
npm run web:deploy          # build web + deploy Cloudflare (branch main = Produção)
```
- O deploy sai no ar em ~1 min para todos os usuários do PWA.
- Não há nenhum passo de loja/app — a web **é** o produto.

---

## 5. Migração de dados entre projetos Supabase

A plataforma prevê **portabilidade de dados** (migrar, clonar, fazer backup). Duas abordagens.

### 5.1. Abordagem A — Dump completo (migração total)
Migra **todo** o schema + dados via ferramentas nativas do Postgres.

```bash
# Exportar (origem) — pegue a connection string em Settings → Database
supabase db dump \
  --db-url "postgresql://postgres:[SENHA]@db.[REF_ORIGEM].supabase.co:5432/postgres" \
  -f backup.sql

# Importar (destino) — aplique as migrations antes, depois os dados
psql "postgresql://postgres:[SENHA]@db.[REF_DESTINO].supabase.co:5432/postgres" -f backup.sql
```
- Para **apenas dados** (schema já aplicado no destino): `pg_dump --data-only`.

### 5.2. Abordagem B — Export/Import seletivo por clube (JSON)
Ideal para migrar **um clube específico** ou um subconjunto. Usa a `service_role key`.

```bash
# Exporta dados de um clube → arquivos JSON em ./export/
node scripts/export-data.mjs --clube-id 1

# Importa os JSON em outro projeto (env do destino configurado)
node scripts/import-data.mjs --dir ./export
```

**Como os scripts funcionam (especificação):**
- `export-data.mjs`: para cada tabela operacional, `SELECT * WHERE clube_id = ?` e grava
  `export/<tabela>.json`. Tabelas globais (`programas`) são exportadas inteiras.
- `import-data.mjs`: faz `upsert` em cada tabela do destino, **respeitando a ordem de
  dependências** (ver abaixo) e preservando IDs (destino vazio) ou remapeando FKs.
- **Storage:** copie os objetos (fotos/anexos) entre os buckets de origem e destino,
  mantendo a estrutura de pastas por clube.

**Ordem de importação (dependências):**
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

> ⚠️ A `service_role key` **ignora RLS** — rode os scripts **apenas localmente**, nunca no
> cliente. Veja `CREDENCIAIS_TOKENS_API.md`.

### 5.3. Quando usar cada abordagem
| Situação | Abordagem |
|---|---|
| Trocar de projeto/conta Supabase (tudo) | A — dump completo |
| Criar homologação a partir de produção | A — dump completo |
| Mover/duplicar **um clube** específico | B — JSON por `clube_id` |
| Backup lógico periódico | A (completo) ou B (por clube) |

---

## 6. Limites do plano gratuito (quando migrar para pago)

| Serviço | Limite grátis | Sinal de que precisa pagar |
|---|---|---|
| Supabase | 500 MB DB, 1 GB storage, 50k MAU, projeto "pausa" após 7 dias sem uso | Banco cheio, muitos usuários, ou pausas indesejadas |
| Cloudflare Pages | 500 builds/mês, banda ilimitada | Builds insuficientes (raro) |

Para produção séria, o gargalo costuma ser o **Supabase** (upgrade para Pro ~US$25/mês
remove a pausa por inatividade e amplia DB/storage).
