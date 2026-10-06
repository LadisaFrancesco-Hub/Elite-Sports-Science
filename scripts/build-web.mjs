#!/usr/bin/env node
// build-web.mjs — copia SOLO gli asset web realmente usati dall'app in www/,
// che è la webDir del progetto Capacitor (app nativa iOS/Android).
//
// Lista di INCLUSIONE (allowlist) concordata: 38 file. Lo script FALLISCE (exit 1)
// se uno qualunque dei file elencati manca, e stampa il numero esatto di file copiati.
//
// NON trasforma index.html: i 3 <script> CDN (supabase-js, localforage, chart.js)
// restano com'è in questa fase. Il vendoring è pianificato in docs/capacitor-8-upgrade.md.

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import fs from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'www');

// --- Allowlist (percorsi relativi alla root del repo) ---
const HTML = ['index.html', 'privacy.html', 'terms.html', 'cookie.html'];

const JS = [
  'main.js', 'state.js', 'utils.js', 'app.js', 'auth.js', 'wellness.js',
  'workout.js', 'analytics.js', 'billing.js', 'badges.js', 'nutrition.js',
  'team.js', 'branding.js', 'wearable.js', 'library.js',
];

const CSS = ['styles.css'];

const FONTS = [
  'fonts/fonts.css',
  'fonts/archivo.woff2', 'fonts/syne.woff2', 'fonts/bebas-neue.woff2',
  'fonts/ibm-plex-mono-400.woff2', 'fonts/ibm-plex-mono-500.woff2', 'fonts/ibm-plex-mono-600.woff2',
  'fonts/dm-mono-300.woff2', 'fonts/dm-mono-400.woff2', 'fonts/dm-mono-500.woff2', 'fonts/dm-mono-italic.woff2',
];

const ICONS = [
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-1024.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png',
];

const PWA = ['manifest.json'];

const FILES = [...HTML, ...JS, ...CSS, ...FONTS, ...ICONS, ...PWA];
const EXPECTED = 38;

// --- 1) Pre-check: tutti i file della lista devono esistere ---
const missing = FILES.filter((rel) => !fs.existsSync(join(ROOT, rel)));
if (missing.length) {
  console.error(`✖ build:web FALLITO — ${missing.length} file della lista mancano:`);
  for (const m of missing) console.error(`   - ${m}`);
  process.exit(1);
}

if (FILES.length !== EXPECTED) {
  console.error(`✖ build:web FALLITO — la lista ha ${FILES.length} voci ma ne attendo ${EXPECTED}.`);
  process.exit(1);
}

// --- 2) Pulisci www/ e ricrea (niente file stantii tra una build e l'altra) ---
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// --- 3) Copia preservando la struttura di sottocartelle (fonts/, icons/) ---
let copied = 0;
for (const rel of FILES) {
  const src = join(ROOT, rel);
  const dst = join(OUT, rel);
  fs.mkdirSync(dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  copied++;
}

if (copied !== EXPECTED) {
  console.error(`✖ build:web FALLITO — copiati ${copied} file, attesi ${EXPECTED}.`);
  process.exit(1);
}

console.log(`✔ build:web OK — ${copied} file copiati in www/`);
console.log(`   HTML ${HTML.length} · JS ${JS.length} · CSS ${CSS.length} · fonts ${FONTS.length} · icons ${ICONS.length} · pwa ${PWA.length}`);
