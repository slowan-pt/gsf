# 📚 Documentação — Plataforma DBV Fonseca

Índice da documentação do projeto.

## Documentos principais

| Documento | Conteúdo | Versionado no git? |
|---|---|---|
| **[DOCUMENTACAO_COMPLETA.md](./DOCUMENTACAO_COMPLETA.md)** | Documentação técnica completa: arquitetura, modelo de dados, perfis, permissões, telas, regras de negócio, boas práticas e guia para recriar o projeto com IA. | ✅ Sim |
| **[GUIA_HOSPEDAGEM_E_SETUP.md](./GUIA_HOSPEDAGEM_E_SETUP.md)** | Passo a passo para criar o banco (Supabase), hospedar o web (Cloudflare Pages), publicar o app (Expo EAS) — tudo em planos gratuitos. | ✅ Sim |
| **CREDENCIAIS_TOKENS_API.md** | 🔐 Chaves, tokens, segredos e acessos. **NÃO versionado** (`.gitignore`). | ❌ Não |

## Documentos de modelagem (históricos)

| Documento | Conteúdo |
|---|---|
| [modelagem-multiclube.md](./modelagem-multiclube.md) | Projeto detalhado da arquitetura multiclube |
| [plano-migracao-multiclube.md](./plano-migracao-multiclube.md) | Plano de migração para multiclube |
| [prioridades-5-12.md](./prioridades-5-12.md) | Prioridades de desenvolvimento |
| [PWA.md](./PWA.md) | Notas sobre o PWA |

## Por onde começar

- **Entender o projeto:** leia `DOCUMENTACAO_COMPLETA.md` (seções 1–3 para visão geral).
- **Colocar no ar / recriar:** siga `GUIA_HOSPEDAGEM_E_SETUP.md`.
- **Operar com segurança:** mantenha `CREDENCIAIS_TOKENS_API.md` fora do git e atualizado.
- **Recriar com IA:** use a seção 15 de `DOCUMENTACAO_COMPLETA.md` como especificação.
