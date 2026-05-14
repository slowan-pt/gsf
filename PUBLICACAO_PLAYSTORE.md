# Publicação Play Store - DBV Fonseca

## Status técnico atual

- TypeScript: OK (`npm run typecheck`)
- Expo Doctor: OK (`npm run doctor`)
- EAS CLI: instalado globalmente
- Android package: `com.clubefonseca.app`
- Versão: `1.0.0`
- Android versionCode: `1`
- Perfil de teste interno: `preview` gera APK
- Perfil de produção: `production` gera AAB

## Próximo passo obrigatório

Entrar na conta Expo/EAS neste computador:

```powershell
eas login
eas whoami
```

Depois gerar o APK de teste interno:

```powershell
npm run build:preview
```

Quando o teste estiver aprovado, gerar o AAB para Play Store:

```powershell
npm run build:android
```

## Ordem recomendada

1. Rodar `eas login`.
2. Rodar `npm run build:preview`.
3. Instalar o APK em alguns celulares Android da diretoria.
4. Testar:
   - Login.
   - Cadastro/edição de membros.
   - Fotos de perfil.
   - Fotos de documentos.
   - Pontuação e ranking.
   - Campori.
   - Atividades e anexos.
   - Notificações.
   - Uso offline e sincronização ao voltar internet.
5. Corrigir bugs encontrados.
6. Rodar `npm run build:android`.
7. Criar app no Google Play Console.
8. Subir o arquivo `.aab`.
9. Preencher Segurança dos Dados.
10. Publicar primeiro em teste fechado ou teste interno.

## Dados sensíveis e Segurança dos Dados

O app trata dados pessoais e possivelmente dados de menores:

- Nome.
- Data de nascimento.
- Unidade/cargo.
- Fotos de perfil.
- Imagens de documentos.
- Informações de responsáveis.
- Dados de saúde/documentos cadastrais, quando preenchidos.
- Pontuação/ranking.
- Atividades e respostas.

Na Play Store, declarar coleta/uso desses dados no formulário de Segurança dos Dados.

## Risco técnico conhecido

O pacote `xlsx` aponta vulnerabilidades no `npm audit` e não possui correção oficial na versão usada. Para a v1, o risco fica limitado ao uso administrativo de importação de planilhas. Antes de escalar para uso público amplo, considerar trocar por outro parser de planilha ou importar no backend.

