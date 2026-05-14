# Exportação DBV Fonseca para nova conta Expo/EAS

Esta pasta é uma cópia limpa do projeto, sem node_modules, caches locais, APKs/AABs e sem vínculo com o projeto EAS antigo.

## 1. Entrar na nova conta Expo

```powershell
eas logout
eas login
eas whoami
```

## 2. Instalar dependências

```powershell
npm install --legacy-peer-deps
```

## 3. Criar novo projeto EAS na nova conta

```powershell
eas init
```

O comando vai criar um novo `extra.eas.projectId` no `app.json`.

## 4. Gerar APK de teste

```powershell
eas build --profile preview --platform android
```

## 5. Gerar AAB para Play Store

```powershell
eas build --profile production --platform android
```

## Observações importantes

- O pacote Android continua `com.clubefonseca.app`.
- Se esse pacote já estiver cadastrado/publicado em uma conta Google Play, outra conta Google Play não poderá publicar o mesmo pacote sem transferência do app.
- O arquivo `.env` foi mantido para o app continuar apontando para o Supabase atual. Se for compartilhar com terceiros, revise esse arquivo antes.
