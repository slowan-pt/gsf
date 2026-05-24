import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const publicDir = join(root, 'public');

function findFirstFile(dir, predicate) {
  if (!existsSync(dir)) return null;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      const found = findFirstFile(fullPath, predicate);
      if (found) return found;
      continue;
    }

    if (predicate(fullPath)) return fullPath;
  }

  return null;
}

if (!existsSync(dist)) {
  throw new Error('A pasta dist nao existe. Rode expo export antes de copiar os assets PWA.');
}

mkdirSync(dist, { recursive: true });

const buildTimestamp = Date.now();

for (const file of readdirSync(publicDir)) {
  const src = join(publicDir, file);
  const dest = join(dist, file);

  if (file === 'sw.js') {
    // Injeta timestamp no CACHE_NAME para invalidar o cache do browser a cada deploy
    let swContent = readFileSync(src, 'utf8');
    swContent = swContent.replace(
      /const CACHE_NAME = '[^']+'/,
      `const CACHE_NAME = 'dbv-fonseca-pwa-${buildTimestamp}'`
    );
    writeFileSync(dest, swContent);
    continue;
  }

  copyFileSync(src, dest);
}

const htmlPath = join(dist, 'index.html');
if (existsSync(htmlPath)) {
  let html = readFileSync(htmlPath, 'utf8');
  html = html.replace('<html lang="en">', '<html lang="pt-BR">');

  const ioniconsFont = findFirstFile(
    join(dist, 'assets'),
    (file) => /Ionicons\.[a-z0-9]+\.ttf$/i.test(file)
  );
  let ioniconsFontUrl = null;
  if (ioniconsFont) {
    const fontDest = join(dist, 'fonts', 'Ionicons.ttf');
    mkdirSync(dirname(fontDest), { recursive: true });
    copyFileSync(ioniconsFont, fontDest);
    ioniconsFontUrl = '/fonts/Ionicons.ttf';
  }

  if (!html.includes('manifest.webmanifest')) {
    html = html.replace(
      '</head>',
      [
        '  <meta name="description" content="Sistema de gestão do Clube de Desbravadores Fonseca." />',
        '  <meta name="apple-mobile-web-app-capable" content="yes" />',
        '  <meta name="apple-mobile-web-app-title" content="Fonseca" />',
        '  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
        '  <link rel="manifest" href="/manifest.webmanifest" />',
        '  <link rel="apple-touch-icon" href="/pwa-icon-192.png" />',
        '</head>',
      ].join('\n')
    );
  }

  if (ioniconsFontUrl && !html.includes('ionicons-font-face')) {
    html = html.replace(
      '</head>',
      [
        '  <style id="ionicons-font-face">',
        '    @font-face {',
        '      font-family: "Ionicons";',
        `      src: url("${ioniconsFontUrl}") format("truetype");`,
        '      font-weight: normal;',
        '      font-style: normal;',
        '      font-display: block;',
        '    }',
        '    @font-face {',
        '      font-family: "ionicons";',
        `      src: url("${ioniconsFontUrl}") format("truetype");`,
        '      font-weight: normal;',
        '      font-style: normal;',
        '      font-display: block;',
        '    }',
        '  </style>',
        '</head>',
      ].join('\n')
    );
  }

  writeFileSync(htmlPath, html);
}

console.log('PWA assets copiados para dist.');
