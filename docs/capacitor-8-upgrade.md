# Upgrade Capacitor 6 → 8 (npm only)

Branch: `chore/capacitor-8` · Data: 2026-10-06

## Scope di questo upgrade

Aggiornamento dei **soli pacchetti npm** di Capacitor da **6 → 7 → 8**, senza toccare
logica applicativa, Supabase o Stripe. Deciso con l'owner:

- **NON** sono state generate le cartelle native `ios/` e `android/` (non esistevano prima e
  non esistono ora: `npx cap add` non è stato eseguito).
- **NON** sono state eseguite build native (Fase 4 saltata): l'ambiente non ha
  Xcode 26+, CocoaPods, Android Studio, JDK né Android SDK.
- **Nessuna modifica al codice JS** (nessuno dei plugin Capacitor è invocato nel codice —
  vedi "Lacune per l'app nativa iOS").

## Cosa è cambiato

Solo due file:

| File | Modifica |
|---|---|
| `package.json` | tutte le dipendenze `@capacitor/*` da `^6.x` a `^8.0.0`; CLI devDep `^6.2.0` → `^8.0.0` |
| `package-lock.json` | **nuovo** (rigenerato da `npm install` durante `cap migrate`) |

Versioni effettivamente installate dopo l'upgrade (`npx cap doctor` + lettura `package.json` dei moduli):

| Pacchetto | Prima | Dopo (installato) |
|---|---|---|
| @capacitor/core | 6.2.x | **8.5.2** |
| @capacitor/cli | 6.2.x | **8.5.2** |
| @capacitor/ios | 6.2.x | **8.5.2** |
| @capacitor/android | 6.2.x | **8.5.2** |
| @capacitor/app | 6.0.x | **8.1.2** |
| @capacitor/haptics | 6.0.x | **8.0.2** |
| @capacitor/push-notifications | 6.0.x | **8.1.3** |
| @capacitor/status-bar | 6.0.x | **8.0.4** |

### Procedura eseguita

1. **6 → 7**: `npm i -D @capacitor/cli@latest-7` (→ 7.6.9) + `npx cap migrate` (dep manager: NPM).
   `cap doctor` OK a 7.6.9. `cap sync` fallito solo sulla validazione `webDir` (vedi sotto).
2. **7 → 8**: `npm i -D @capacitor/cli@^8` (→ 8.5.2) + `npx cap migrate`.
   `cap doctor` OK a 8.5.2 (core/cli/ios/android). `cap sync` fallito solo su `webDir`.

### Punti della guida 7→8 / 8.5 non applicabili ora

Non essendoci la cartella `ios/`, questi passaggi della guida ufficiale sono **N/A finora**,
da applicare SE/QUANDO verrà generato il progetto iOS:

- **CocoaPods (non SPM)**: in Capacitor 8 la CLI crea progetti iOS come **SPM di default**.
  Se vuoi restare su CocoaPods come richiesto, andrà scelto esplicitamente alla generazione.
- **Deployment target iOS 15.0**: da impostare nel `Podfile` (`platform :ios, '15.0'`) e in
  `IPHONEOS_DEPLOYMENT_TARGET`. Capacitor 8 usa comunque **15.0 come minimo di default**.
- **UIScene / SceneDelegate (step "Updating to 8.5")**: la CLI è 8.5.2 (≥ 8.5), quindi lo step
  è applicabile, ma riguarda file iOS nativi (`AppDelegate`/`SceneDelegate`) inesistenti.

Fonte: <https://capacitorjs.com/docs/updating/8-0>.

## `webDir: "."` — scelta Opzione A (lasciato invariato)

`npx cap sync` fallisce con `"." is not a valid value for webDir`: è un breaking change reale
6→7 (la CLI v7+ rifiuta `webDir` uguale a `''`/`.`/`..`/`./`/`../` —
`node_modules/@capacitor/cli/dist/common.js:29`). L'app è vanilla JS servita dalla root, quindi
`webDir` era `"."`.

**Deciso di lasciarlo così** (Opzione A): `webDir` non influenza il deploy Vercel/PWA (conta solo
per `cap copy/sync` verso il nativo) e non esistono piattaforme native da sincronizzare, quindi
`cap sync` è di fatto N/A. `cap doctor` non valida `webDir` e funziona.

Quando genererai le cartelle native servirà un `webDir` valido: creare uno script/cartella
`www/` con dentro gli asset web (o un vero step di build) e puntare `webDir` lì. Da fare al
momento della generazione nativa, **non ora**.

## npm audit (sola lettura, nessun fix applicato)

3 vulnerabilità **moderate**, tutte nella stessa catena **solo-dev**:
`@capacitor/cli` (devDep) → `xcode` → `uuid` (<11.1.1, [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)).
`uuid` v3/v5/v6: missing buffer bounds check. **Non entra nel bundle dell'app** (CLI usata solo a
build-time per manipolare il progetto Xcode). `npm audit fix` NON eseguito (uscirebbe dallo scope
e dipende da un bump upstream della CLI).

## Cosa NON è stato testato (richiede build/dispositivo reale)

- Build iOS su simulatore/dispositivo (Xcode non installato).
- Build Android `./gradlew assembleDebug` (Android Studio/JDK/SDK non installati).
- Avvio app nativa, login, navigazione, back, haptics, status bar, permessi push in nativo.
- `npx cap sync` verso piattaforme native (nessuna piattaforma presente).

L'upgrade è verificato **solo** a livello di dipendenze npm + `cap doctor` (tutto 8.x coerente).

## Come tornare indietro (rollback)

1. **Metodo consigliato — `git checkout main`**: torna al branch `main`, che è intatto a
   Capacitor 6. Il branch `chore/capacitor-8` resta isolato e non distrugge nulla. Se vuoi anche
   eliminare il branch dell'upgrade: `git branch -D chore/capacitor-8`.
2. **Ripristinare i moduli**: dopo il checkout, `npm install` riallinea `node_modules` a quanto
   scritto in `package.json`/`package-lock.json` del branch su cui ti trovi.
3. **Ultima risorsa — `git reset --hard 4d74340`**: riporta il branch corrente al commit
   `chore: snapshot pre-capacitor-8` (pre-upgrade, Capacitor 6).
   ⚠️ **Attenzione: `git reset --hard` cancella definitivamente tutte le modifiche non
   committate** nel working tree. Usalo solo se sai di non avere lavoro in sospeso da perdere;
   nella maggior parte dei casi basta il metodo 1.

---

## Lacune per l'app nativa iOS

> Nessuna di queste è stata implementata (fuori scope). Sono i punti che impediranno all'app di
> funzionare correttamente come app **nativa iOS** finché non verranno affrontati. Tutti
> **da verificare su dispositivo**.

### 1. Haptics — `navigator.vibrate` non funziona su iOS
`workout.js` usa `navigator.vibrate(...)` in **11 punti** (es. righe 1141, 1252, 1309, 1341, 1386,
1416, 1543, 2094, 2153, 2199, 2210, 2274). Su iOS — anche dentro WKWebView — l'API web
`navigator.vibrate` **non è supportata**: nessun feedback aptico nell'app nativa.

**Piano (non implementare ora):** un helper unico, es. `haptic(pattern)`, che:
- se `Capacitor.isNativePlatform()` → usa `Capacitor.Plugins.Haptics` (`impact`/`notification`/`vibrate`);
- altrimenti → fallback a `navigator.vibrate`.

Poi sostituire le 11 chiamate dirette con l'helper.
**Da verificare su dispositivo** (feedback aptico reale su iPhone).

### 2. Push — oggi solo Web Push
Il flusso attuale è **Web Push**: `auth.js:1249-1277` fa `Notification.requestPermission()` +
`reg.pushManager.subscribe(...)` e invia la subscription alla edge function **`send-push`**.
In un'app **nativa iOS** servirebbe `@capacitor/push-notifications` con **APNs** (capability Push
Notifications + handler in `AppDelegate` + evento `registration` con token APNs) e una **nuova
funzione server** capace di inviare ad APNs (la `send-push` attuale parla Web Push, non APNs).

**Piano minimo (non implementare ora):** aggiungere in `auth.js` un guard
`if (Capacitor.isNativePlatform()) return;` (o equivalente) **prima** della registrazione Web Push,
così da **non** registrare Web Push dentro l'app nativa (dove non funziona). L'integrazione APNs
completa è un lavoro a parte.
**Da verificare su dispositivo** (comportamento permessi/registrazione su iPhone).

### 3. `@capacitor-community/health` — import non risolvibile
`wearable.js:384` fa, dietro `Capacitor.isNativePlatform()`, un
`await import('@capacitor-community/health')` (riga 389). Il pacchetto **non è in `package.json`**
e l'import "nudo" (bare specifier) **non è risolvibile senza bundler** (l'app è servita come
moduli ES statici, senza build step).

**Piano (non implementare ora):** sostituirlo con un plugin **verificato e compatibile con
Capacitor 8**, invocato via `Capacitor.Plugins.<Nome>` (così non serve un import risolvibile a
runtime dal browser), aggiungendo il pacchetto a `package.json`.
**Da verificare su dispositivo** (autorizzazione e lettura dati salute su iPhone).

### 4. `webDir: "."` + script `www/`
Come deciso (Opzione A), su `chore/capacitor-8` `webDir` era rimasto `"."`.
**Risolto su `feat/ios-native-shell`** (Fase 6, punto 3): aggiunto `scripts/build-web.mjs`
(allowlist di 38 asset → copia in `www/`, fallisce se un file manca), script npm `build:web`,
`www/` in `.gitignore` e `webDir: "www"` nel config. `www/` NON è committato (rigenerato da
`npm run build:web`) e non è servito da Vercel (nessun `vercel.json`, serve dalla root tracciata).
**Da verificare su dispositivo** (che l'app nativa carichi correttamente gli asset da `www/`).

---

## Prima della sottomissione (App Store / Play Store)

> Punti da chiudere **prima** di sottomettere l'app agli store. Non implementati ora.
> Oggi `index.html` carica 3 `<script>` da CDN (supabase-js, localforage, chart.js): è
> accettabile per sviluppo/simulatore, ma per una build di produzione va irrobustito.

- **Vendoring in `www/vendor/` con versioni pinnate** — scaricare localmente, con versione
  esatta (no range), le 3 librerie oggi da CDN e servirle da `www/vendor/`:
  - `@supabase/supabase-js` → pinnare la versione esatta (es. `supabase-js@2.x.y`), oggi è
    `@supabase/supabase-js@2` (range mobile: rischio build non riproducibili).
  - `localforage@1.10.0` (già pinnata nell'URL CDN) → copiare in `vendor/`.
  - `chart.js` → oggi `cdn.jsdelivr.net/npm/chart.js` senza versione: pinnare esatta.
  - Richiede di aggiornare i `<script src>` in `index.html` (fuori dallo scope attuale: in questa
    fase lo script `build-web.mjs` NON riscrive `index.html`) e di aggiungere i file alla
    allowlist di `build-web.mjs`.
- **Avvio offline** — avendo escluso `sw.js` dal bundle nativo, non c'è cache offline e i 3
  `<script>` CDN sono blocking in `<head>`: **senza rete l'app nativa non parte**. Il vendoring
  sopra rende l'avvio indipendente dalla rete (resta online solo la chiamata API a Supabase).
- **Lazy-load di `chart.js`** — non serve al boot (solo per i grafici di Analytics/Nutrition):
  caricarlo on-demand (import dinamico quando si apre una vista con grafici) riduce il costo
  d'avvio e una dipendenza di rete dal percorso critico login→dashboard.
- **CSP** — l'app non ha oggi alcuna Content-Security-Policy. Dopo il vendoring (niente più
  script da terze parti) si può aggiungere una CSP restrittiva via `<meta http-equiv>` o header,
  consentendo `self` + `capacitor:`/`https:` solo per gli endpoint realmente usati
  (`*.supabase.co`, eventuali embed YouTube). Da validare per non rompere gli `<iframe>` video.

- **Retry / coda per gli upsert Supabase falliti** — oggi le scritture verso Supabase sono
  best-effort e in caso di errore il locale (`coachOS_v3`) resta avanti al cloud senza recupero
  automatico (`updateCloudStatus('error')`). Introdurre un meccanismo di **retry** o una **coda di
  mutazioni pendenti** (persistita) che venga drenata al ritorno della connettività, così i dati
  di allenamento non restino bloccati solo sul dispositivo.
- **Lo storage della WebView non migra dalla PWA e può essere eliminato dal sistema** — su iOS la
  WebView ha origine `capacitor://localhost`, diversa da `https://coach-os-lime.vercel.app`:
  localStorage/localforage/IndexedDB **non** si trasferiscono dalla PWA all'app nativa. Inoltre lo
  storage della WebView **può essere eliminato dal sistema** (pulizia spazio/OS). Non va trattato
  come persistenza durevole: la fonte di verità deve restare Supabase (con la coda del punto
  precedente a coprire i dati non ancora sincronizzati).
- **`coachOS_v3` contiene dati degli atleti → citarlo nella revisione privacy** — la chiave
  localforage `coachOS_v3` è un mirror locale completo del DB (anagrafiche atleti, schede,
  sessioni, messaggi, inclusi dati salute art. 9). Da **citare esplicitamente nella revisione
  privacy** (dove risiedono i dati sul dispositivo, cancellazione al logout/reset, assenza di
  cifratura a riposo oltre a quella del sistema).
- **Valutare `android.allowMixedContent: false`** — oggi è `true`. Con tutti gli asset e le API in
  HTTPS (verificato: 0 occorrenze di `http://` nei 38 file), il contenuto misto non dovrebbe
  servire. Valutare di impostarlo a `false` per non permettere richieste in chiaro nell'app
  Android (non toccato ora per non alterare il comportamento runtime senza verifica su device).

Ciascun punto è **da verificare su dispositivo** dopo l'implementazione.
