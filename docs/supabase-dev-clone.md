# Clone do Supabase para desenvolvimento

Este projeto usa dois ambientes:

- Producao: Supabase atual do `gsf-clubes.pages.dev`.
- Desenvolvimento: um Supabase separado para testar sem mexer nos dados reais.

## 1. Criar/aplicar a estrutura no projeto dev

Crie um projeto Supabase novo, por exemplo `gsf-clubes-dev`, e pegue:

- `SUPABASE_PROJECT_REF` do projeto dev.
- `EXPO_PUBLIC_SUPABASE_URL` do projeto dev.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` do projeto dev.
- `DEV_SUPABASE_SERVICE_ROLE_KEY` do projeto dev.

Depois gere um Supabase Access Token em:

`Supabase Dashboard -> Account -> Access Tokens`

No PowerShell:

```powershell
cd C:\Users\adm.sloannascimento\Downloads\puppin\exports\fonseca-app-export-20260514-105910
$env:SUPABASE_ACCESS_TOKEN="cole_o_pat_aqui"
$env:SUPABASE_PROJECT_REF="ref_do_projeto_dev"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-supabase-dev.ps1 -ApplyMigrations
```

## 2. Copiar dados publicos do projeto atual para dev

Use `service_role` nos dois lados. O script copia as tabelas publicas que nao dependem diretamente de `auth.users`.
Ele cria um usuario admin de dev com senha temporaria.

```powershell
cd C:\Users\adm.sloannascimento\Downloads\puppin\exports\fonseca-app-export-20260514-105910
$env:PROD_SUPABASE_URL="https://enoacjmlcznsrvynnamf.supabase.co"
$env:PROD_SUPABASE_SERVICE_ROLE_KEY="service_role_do_projeto_atual"
$env:DEV_SUPABASE_URL="https://ref_do_dev.supabase.co"
$env:DEV_SUPABASE_SERVICE_ROLE_KEY="service_role_do_dev"
$env:DEV_ADMIN_EMAIL="seu_email_de_teste"
$env:DEV_ADMIN_PASSWORD="uma_senha_de_teste_com_6_ou_mais_caracteres"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-supabase-dev.ps1 -CloneData
```

## 3. Configurar o app para o Supabase dev

Crie `.env.development.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://ref_do_dev.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=anon_key_do_dev
```

Deploy de desenvolvimento:

```powershell
npm run web:deploy:dev
```

## Alternativa: aplicar migrations pela senha do banco

Se preferir nao usar PAT, use a connection string Postgres do projeto dev:

```powershell
cd C:\Users\adm.sloannascimento\Downloads\puppin\exports\fonseca-app-export-20260514-105910
$env:DATABASE_URL="postgresql://postgres:SENHA_DO_BANCO@db.ejrzaoitfyjvzdkvfkkx.supabase.co:5432/postgres"
npm run supabase:dev:migrate
```

## Observacao sobre Auth

As senhas reais dos usuarios nao sao clonadas. Isso e intencional: as senhas ficam no Supabase Auth e nao devem ser exportadas. Para dev, use o admin temporario criado pelo script ou crie usuarios de teste.
