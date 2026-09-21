# Migracao do DBV+ para outro computador

Este pacote nao inclui APKs, AABs nem o historico da pasta `builds`.
O codigo, historico Git, configuracoes locais, `.env`, migracoes do Supabase,
chave Android de producao e JDK 17 estao preservados.

## 1. Extrair

Extraia o ZIP diretamente na Area de Trabalho. Devem aparecer:

- `fonseca-app-export-20260514-105910`: projeto principal.
- `jdk17`: Java portatil usado como alternativa no build Android.

Nao altere nem compartilhe publicamente o ZIP: ele contem configuracoes e a
chave privada usada para assinar o aplicativo Android.

## 2. Instalar no novo Windows

Instale:

1. Git para Windows.
2. Node.js (versao 22 ou superior; o computador antigo usava Node 25.8.1).
3. Android Studio, incluindo Android SDK, Platform Tools e Build Tools.
4. PowerShell 5.1 ou superior.

Depois abra PowerShell dentro da pasta do projeto e execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
npm install --legacy-peer-deps
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\testar-novo-pc.ps1
```

## 3. Testar a web local

```powershell
npm run web
```

O terminal mostrara o endereco local. O banco continua no Supabase e nao
precisa ser copiado para o computador novo.

## 4. Autenticar ferramentas de publicacao

As sessoes de login do computador antigo nao sao copiadas. Execute uma vez:

```powershell
npx wrangler login
npx supabase login
```

## 5. Gerar Android

O script usa `C:\dev\gsfdbv` como caminho curto de compilacao e copia os
resultados novos para `builds\apk` e `builds\aab`:

```powershell
npm run android:local
```

O arquivo `android\app\release.keystore` incluido e a chave registrada na
Google Play. Nao gere outra chave para publicar atualizacoes do mesmo app.

## 6. Conferencias importantes

```powershell
git status
git log -1 --oneline
npm test
```

O commit esperado no momento da exportacao esta registrado também no arquivo
`EXPORTACAO-INFO.txt`, criado junto do ZIP.
