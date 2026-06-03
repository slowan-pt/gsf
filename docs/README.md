# 📚 Documentação — Plataforma DBV Fonseca

Índice da documentação do projeto.

## Documentos principais

| Documento | Conteúdo | Versionado no git? |
|---|---|---|
| **[DOCUMENTACAO_COMPLETA.md](./DOCUMENTACAO_COMPLETA.md)** | Documentação técnica completa da plataforma **web (PWA) multiclube**: arquitetura, modelo de dados, perfis, permissões, telas, regras de negócio, export/import de dados, boas práticas e guia para construir o projeto com IA. | ✅ Sim |
| **[GUIA_HOSPEDAGEM_E_SETUP.md](./GUIA_HOSPEDAGEM_E_SETUP.md)** | Passo a passo para criar o banco (Supabase), hospedar o web (Cloudflare Pages) e **migrar dados entre projetos Supabase** — tudo em planos gratuitos. Sem build mobile. | ✅ Sim |
| **CREDENCIAIS_TOKENS_API.md** | 🔐 Chaves, tokens, segredos e acessos. **NÃO versionado** (`.gitignore`). | ❌ Não |

## Documentos de modelagem (históricos)

| Documento | Conteúdo |
|---|---|
| [modelagem-multiclube.md](./modelagem-multiclube.md) | Projeto detalhado da arquitetura multiclube |
| [plano-migracao-multiclube.md](./plano-migracao-multiclube.md) | Plano de migração para multiclube |
| [prioridades-5-12.md](./prioridades-5-12.md) | Prioridades de desenvolvimento |
| [PWA.md](./PWA.md) | Notas sobre o PWA |

## Premissas canônicas da plataforma

A documentação descreve a plataforma **alvo**, com estas decisões fechadas:
1. **PWA web puro** — sem app Android/iOS, sem APK/AAB, sem lojas.
2. **Sem módulos offline** — fala direto com o Supabase (sem SQLite/sync local).
3. **Multiclube desde a origem** — multitenant por `clube_id` na fundação.
4. **Dados portáveis** — export/import entre projetos Supabase.

## Por onde começar

- **Entender o projeto:** leia `DOCUMENTACAO_COMPLETA.md` (seções 1–3 para visão geral).
- **Colocar no ar / migrar dados:** siga `GUIA_HOSPEDAGEM_E_SETUP.md`.
- **Operar com segurança:** mantenha `CREDENCIAIS_TOKENS_API.md` fora do git e atualizado.
- **Construir com IA:** use a **seção 16** de `DOCUMENTACAO_COMPLETA.md` como especificação.
