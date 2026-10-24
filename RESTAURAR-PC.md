# Restaurar o projeto em um computador novo

Este repositório (público) tem todo o código, as migrations do Supabase e a configuração dos builds.
Os arquivos secretos (`.env`, chave de assinatura do Android, tokens) ficam no repositório PRIVADO `slowan-pt/gsf-segredos`,
que tem o passo a passo completo no `RESTAURAR.md` dele.

## Resumo

1. Instale Git, Node.js 22+, Android Studio (SDK), JDK 17 e o GitHub CLI; faça `gh auth login` com a conta `slowan-pt`.
2. `git clone https://github.com/slowan-pt/gsf.git fonseca-app-export-20260514-105910`
3. `gh repo clone slowan-pt/gsf-segredos` e copie `projeto\*` (inclusive os arquivos que começam com ponto) para dentro da pasta do projeto.
4. `npm install --legacy-peer-deps`, depois `npx tsc --noEmit` e `npm run web`.
5. `npx wrangler login` e `npx supabase login`.
6. Android: `npm run android:local`. iPhone: Codemagic. Web: `npm run web:deploy:prod` (na branch `main`).

## Estado quando este backup foi feito

- Versão exibida: 1.0.25. Android versionCode 160. iPhone: o número do build vem do Codemagic.
- Migrations aplicadas no Supabase: até a 152.
- Opcional, só depois de publicar nas lojas: `UPDATE app_versao_minima SET build_minimo = <N> ...` (atualização obrigatória).

## Não está no backup

APK, AAB, IPA, `node_modules`, a pasta `builds`, a pasta `android` gerada e o histórico das conversas com o Claude. Tudo isso se gera de novo.
