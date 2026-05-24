# PWA Fonseca

Este projeto agora pode ser publicado como PWA online-first.

## Gerar build web

```powershell
npm run web:export
```

O resultado fica em:

```text
dist/
```

## Publicar com custo minimo

Recomendado: Cloudflare Pages.

- Framework preset: None
- Build command: `npm run web:export`
- Output directory: `dist`
- Variaveis de ambiente:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Observacao

A PWA usa Supabase como fonte principal de dados no navegador. O SQLite fica reservado para o app nativo.

