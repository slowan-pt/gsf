# 🚀 Guia de Hospedagem, Banco de Dados e Setup — do zero ao ar

Este guia ensina, passo a passo, como colocar **uma cópia nova** deste projeto no ar usando
**apenas serviços com plano gratuito**. Serve tanto para recriar o ambiente atual quanto
para um novo clube/plataforma baseado neste código.

---

## 1. Arquitetura de hospedagem (visão geral)

```
┌──────────────────────────────────────────────────────────────────┐
│                          USUÁRIO FINAL                            │
│  ┌────────────────────┐         ┌──────────────────────────────┐  │
│  │  App Web (PWA)     │         │  App Android (APK/AAB)       │  │
│  │  navegador/celular │         │  instalado no celular        │  │
│  └─────────┬──────────┘         └──────────────┬───────────────┘  │
└────────────┼───────────────────────────────────┼──────────────────┘
             │ HTTPS                              │ HTTPS
   ┌─────────▼──────────┐              ┌──────────▼─────────────┐
   │  CLOUDFLARE PAGES  │              │  (assets servidos via  │
   │  (hospeda o PWA)   │              │   bundle do app)       │
   │  gsf-clubes.pages  │              └──────────┬─────────────┘
   └─────────┬──────────┘                         │
             │                                    │
             └──────────────┬─────────────────────┘
                            │ API REST + Realtime + Auth
                  ┌─────────▼──────────────────┐
                  │        SUPABASE            │
                  │  ┌──────────────────────┐  │
                  │  │ PostgreSQL (dados)   │  │
                  │  │ Auth (login + MFA)   │  │
                  │  │ Storage (arquivos)   │  │
                  │  │ RLS (segurança)      │  │
                  │  └──────────────────────┘  │
                  └────────────────────────────┘
```

**Camadas e custo:**

| Camada | Serviço | Plano grátis cobre? |
|---|---|---|
| Banco de dados + Auth + Storage | **Supabase** | Sim (até 500MB DB, 1GB storage, 50k MAU) |
| Hospedagem do app web (PWA) | **Cloudflare Pages** | Sim (builds e banda generosos) |
| Build do app mobile | **Expo EAS** | Sim (builds limitados/mês) |
| Push notifications | **Expo Push / FCM** | Sim |

---

## 2. Passo a passo: criar o banco de dados (Supabase)

### 2.1. Criar o projeto
1. Acesse https://supabase.com → **Sign in** (pode usar conta GitHub).
2. **New Project**.
   - **Name:** `fonseca-dbv` (ou o nome do seu clube).
   - **Database Password:** gere uma senha forte e **guarde no arquivo de credenciais**.
   - **Region:** `South America (São Paulo)` — menor latência no Brasil.
3. Aguarde ~2 minutos até o provisionamento terminar.

### 2.2. Pegar as chaves de API
No painel do projeto → **Settings → API**:
- **Project URL** → vai para `EXPO_PUBLIC_SUPABASE_URL`.
- **anon / public key** → vai para `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **service_role key** → guarde no arquivo de credenciais (uso só em scripts de migração).

### 2.3. Criar o schema (tabelas, RLS, seeds)
No painel → **SQL Editor → New query**. Execute as migrations **na ordem numérica**,
uma por vez, copiando o conteúdo de cada arquivo de `supabase/migrations/`:

```
001_schema.sql                 → tabelas base (usuarios, desbravadores, etc.)
002_seed.sql                   → dados iniciais
003_storage_policies.sql       → políticas do Storage
004 … 047                      → evoluções (multiclube, atividades, LGPD, etc.)
```

> 💡 **Atalho:** o script `setup_supabase.mjs` (na raiz) automatiza parte disso. Configure
> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` como variáveis de ambiente e rode
> `node setup_supabase.mjs`. Ainda assim, revise as migrations mais recentes manualmente.

**Ordem recomendada de leitura/aplicação das migrations principais:**

| Faixa | Domínio que habilita |
|---|---|
| 001–005 | Estrutura base + RLS inicial |
| 006, 011, 022, 023 | Documentos dinâmicos + regras de pais/anexos |
| 008, 009 | Auditoria de acessos + consentimento LGPD |
| 010, 012, 016, 018 | **Multiclube** (programas, clubes, vínculos, onboarding) |
| 013, 014, 019, 020, 032 | Pré-cadastro + responsáveis + WhatsApp |
| 015, 024, 031, 033, 037–044 | **Atividades** (fluxo de avaliação, formativos, prazos) |
| 017, 036 | Catálogo MDA + classificação SGC |
| 021 | Pontuação customizável + histórico |
| 039, 040 | Personalização visual das atividades |
| 045, 046 | Correções de vínculo de responsável + sync pontuação |
| 047 | Classe Bíblica |

### 2.4. Configurar o Storage (arquivos/anexos)
1. Painel → **Storage → Create bucket**.
2. Crie os buckets usados pelo app (ex.: `documentos`, `fotos`, `anexos`, `atividades`).
3. Execute `supabase_storage_setup.sql` (na raiz) no SQL Editor para aplicar as políticas de
   acesso por pasta de clube.

### 2.5. Configurar autenticação
1. Painel → **Authentication → Providers** → mantenha **Email** habilitado.
2. **Authentication → Policies / Settings:**
   - Desabilite "Confirm email" se quiser criar usuários sem confirmação (ou mantenha e use
     o fluxo de convite).
3. **MFA:** o app exige MFA (TOTP) para perfis administrativos — o Supabase já suporta TOTP
   nativamente, não precisa configurar nada extra.

### 2.6. Criar os primeiros usuários
- **Authentication → Users → Add user** (e-mail + senha).
- Depois, vincule o perfil na tabela `usuarios` (ou `usuario_clubes` no modelo multiclube),
  via SQL Editor. Exemplo no modelo legado:
```sql
INSERT INTO usuarios (id, email, nome, perfil, unidade_id) VALUES
  ((SELECT id FROM auth.users WHERE email='diretor@clube.app'),
   'diretor@clube.app', 'Diretor', 'admin_clube', NULL);
```

---

## 3. Passo a passo: rodar localmente (desenvolvimento)

### Pré-requisitos
- **Node.js** 18+ e **npm**.
- **Git**.
- (Opcional p/ mobile) App **Expo Go** no celular, ou emulador Android/iOS.

### Comandos
```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env
# edite .env com a URL e a anon key do seu Supabase

# 3. Rodar
npm run web        # abre no navegador (desenvolvimento web)
npm start          # Expo (escaneie o QR com o Expo Go)
npm run android    # emulador/dispositivo Android
npm run ios        # simulador iOS (requer macOS)

# 4. Checagem de tipos
npm run typecheck
```

---

## 4. Passo a passo: publicar o app WEB (Cloudflare Pages — grátis)

### 4.1. Primeira vez
1. Crie conta em https://dash.cloudflare.com.
2. Instale o Wrangler (já vem como dependência; use `npx wrangler`).
3. Autentique: `npx wrangler login` (abre o navegador).

### 4.2. Deploy
```bash
npm run web:deploy
```
Este comando faz, em sequência:
1. `expo export --platform web` → gera o site estático em `dist/`.
2. `node scripts/copy-pwa-assets.mjs` → injeta manifesto PWA, service worker, fontes.
3. `wrangler pages deploy dist --project-name gsf-clubes --branch main` → publica.

> O `--branch main` define o deploy como **Produção**. Sem isso, vira um preview.
> O nome do projeto (`gsf-clubes`) pode ser trocado para o seu.

### 4.3. Domínio próprio (opcional)
- Cloudflare Pages → seu projeto → **Custom domains** → adicione seu domínio e ajuste o DNS.

---

## 5. Passo a passo: publicar o app ANDROID (Expo EAS)

```bash
# 1. Instalar a CLI
npm install -g eas-cli

# 2. Login
eas login

# 3. Build de teste (APK — instala direto no celular)
npm run build:preview      # eas build --profile preview --platform android

# 4. Build de produção (AAB — para a Play Store)
npm run build:android      # eas build --profile production --platform android
```
- Os perfis estão em `eas.json`: `preview` gera **APK**, `production` gera **App Bundle (AAB)**.
- O `app.json` já define `package: com.clubefonseca.app`, ícones, splash e permissões.
- ⚠️ Faça **backup do keystore** gerado pela EAS — sem ele você não consegue atualizar o app.

### Publicação na Play Store
Veja `PUBLICACAO_PLAYSTORE.md` e `PLAYSTORE_LISTING_RASCUNHO.md` na raiz.

---

## 6. Fluxo de trabalho de deploy (CI/CD manual adotado no projeto)

> Regra de ouro do projeto: **toda mudança de código vira commit + deploy**, sem deixar
> alterações soltas.

```bash
git add <arquivos relevantes>
git commit -m "tipo: descrição objetiva"
npm run web:deploy          # build web + deploy Cloudflare (branch main = Produção)
```

- O deploy web é **independente** das lojas. Mudanças saem no ar em ~1 min para todos os
  usuários do PWA.
- O app Android só recebe a mudança ao gerar um **novo build** (EAS) e publicar.

---

## 7. Limites do plano gratuito (quando migrar para pago)

| Serviço | Limite grátis | Sinal de que precisa pagar |
|---|---|---|
| Supabase | 500 MB DB, 1 GB storage, 50k MAU, projeto "pausa" após 7 dias sem uso | Banco cheio, muitos usuários, ou pausas indesejadas |
| Cloudflare Pages | 500 builds/mês, banda ilimitada | Builds insuficientes (raro) |
| Expo EAS | ~30 builds/mês (varia) | Builds frequentes de produção |

Para produção séria, o gargalo costuma ser o **Supabase** (upgrade para Pro ~US$25/mês
remove a pausa por inatividade e amplia DB/storage).
