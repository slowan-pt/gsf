# 🏕️ App Fonseca DBV — Setup

## 1. Criar projeto no Supabase

1. Acesse https://supabase.com → **New Project**
2. Nome: `fonseca-dbv` | Senha segura | Região: South America (São Paulo)
3. Aguarde a criação (~2 min)

## 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Abra `.env` e preencha:
- `EXPO_PUBLIC_SUPABASE_URL` → Settings → API → Project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` → Settings → API → anon key

## 3. Criar as tabelas no Supabase

No painel do Supabase → **SQL Editor** → New Query:

1. Cole e execute: `supabase/migrations/001_schema.sql`
2. Cole e execute: `supabase/migrations/002_seed.sql`

## 4. Criar usuários no Supabase Auth

No painel → **Authentication** → **Users** → Invite:

| Email | Nome | Perfil | Observação |
|---|---|---|---|
| luciano@fonseca.app | Luciano (Diretor) | admin_geral | |
| cessia@fonseca.app | Cessia | admin_diretoria | unidade_id=1 |
| duda@fonseca.app | Duda | admin_diretoria | unidade_id=2 |
| dennis@fonseca.app | Dennis | admin_diretoria | unidade_id=3 |
| miller@fonseca.app | Miller | admin_diretoria | unidade_id=4 |

Após criar, execute no SQL Editor para vincular os perfis:
```sql
INSERT INTO usuarios (id, email, nome, perfil, unidade_id) VALUES
  ((SELECT id FROM auth.users WHERE email='luciano@fonseca.app'), 'luciano@fonseca.app', 'Luciano', 'admin_geral', NULL),
  ((SELECT id FROM auth.users WHERE email='cessia@fonseca.app'), 'cessia@fonseca.app', 'Cessia', 'admin_diretoria', 1),
  ((SELECT id FROM auth.users WHERE email='duda@fonseca.app'), 'duda@fonseca.app', 'Duda', 'admin_diretoria', 2),
  ((SELECT id FROM auth.users WHERE email='dennis@fonseca.app'), 'dennis@fonseca.app', 'Dennis', 'admin_diretoria', 3),
  ((SELECT id FROM auth.users WHERE email='miller@fonseca.app'), 'miller@fonseca.app', 'Miller', 'admin_diretoria', 4);
```

## 5. Rodar o app

```bash
npm start          # Expo Go (testar no celular)
npm run android    # Emulador Android
npm run ios        # Simulador iOS (requer Mac)
```

## 6. Publicar nas lojas (quando pronto)

```bash
npm install -g eas-cli
eas login
eas build --platform android   # Gera .apk/.aab para Play Store
eas build --platform ios       # Gera .ipa para App Store
```

## Estrutura do Projeto

```
fonseca-app/
├── app/
│   ├── auth/login.tsx          # Tela de login
│   ├── (tabs)/
│   │   ├── index.tsx           # Dashboard
│   │   ├── ranking.tsx         # Ranking gamificado
│   │   ├── membros.tsx         # Lista de membros
│   │   ├── pontuacao.tsx       # Lançar pontuação (admin)
│   │   ├── campori.tsx         # Gestão Campori DSA (admin)
│   │   └── calendario.tsx      # Agenda de eventos
│   └── membro/[id].tsx         # Ficha individual do DBV
├── src/
│   ├── lib/
│   │   ├── database.ts         # SQLite offline
│   │   ├── supabase.ts         # Cliente Supabase
│   │   ├── sync.ts             # Fila de sincronização
│   │   └── seed_local.ts       # Dados iniciais (planilhas)
│   ├── stores/
│   │   ├── authStore.ts        # Autenticação
│   │   ├── dbvStore.ts         # Desbravadores
│   │   ├── pontuacaoStore.ts   # Pontuação
│   │   └── camporiStore.ts     # Campori DSA
│   └── types/index.ts          # Tipos TypeScript
└── supabase/
    ├── migrations/001_schema.sql   # Estrutura das tabelas
    └── migrations/002_seed.sql     # Dados das planilhas
```
