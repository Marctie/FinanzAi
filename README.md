# FinanzAI

App di finanza personale (Angular 20 + Ionic 8 + Capacitor 8) per **Android** (Play Store, `com.finanzai.app`) e come
**web app installabile su iPhone** (PWA su GitHub Pages: https://marctie.github.io/FinanzAi/).

**Versione attuale: 1.1.1** (Android versionCode 3) · storico in [docs/CHATLOG.md](docs/CHATLOG.md)

## Funzioni

- Movimenti, budget, obiettivi, categorie personalizzate, statistiche e suggerimenti calcolati sul dispositivo.
- **Account facoltativo** (Supabase Auth) su web e Android, con **codice di recupero** della password (non serve email).
- **Sincronizzazione offline-first** tra dispositivi: coda locale, salvataggio con numero di versione, unione a tre vie
  in caso di conflitto, aggiornamenti in tempo reale (Supabase Realtime).
- **Wallet condivisi** con codice invito: chi ha pagato, importo, suddivisione in parti uguali / percentuale / importi,
  saldi e "chi deve a chi" con il minor numero di passaggi, rimborsi ("Saldato").
- **Carte fedeltà**: personali o condivise con un wallet, mostrate alla cassa con codice a barre/QR, scansione con la
  fotocamera (ML Kit su Android, zxing su web/iPhone).
- **Notifiche**: promemoria giornalieri all'orario scelto (pagamenti ricorrenti, budget quasi esaurito, obiettivi in
  scadenza) e avvisi quando un altro membro aggiunge/modifica spese o condivide carte. Android: notifiche locali;
  web/iPhone: Web Push (VAPID); dentro l'app: avviso a comparsa.
- **Importazione da Money Manager** (`.mmbackup`): Altro → Backup e dati → "Importa da Money Manager". Il file viene
  aperto sul dispositivo (fflate + sql.js/WebAssembly, caricati solo quando servono), con anteprima e abbinamento delle
  categorie modificabile; i movimenti vengono aggiunti (id stabili `mm-…`, nessun doppione reimportando), i limiti di
  categoria diventano budget e i pagamenti periodici movimenti ricorrenti. Logica in `src/app/core/mmbackup.ts`.
- **Telemetria senza contenuti** + **bot Telegram per l'amministratore** (`Bot Telegram/FinanzAIBot`).

## Stato dei lavori

| Fase | Contenuto | Stato |
|---|---|---|
| 0 | Pulizia repo e cronologia, cartella segreti | ✅ |
| 1 | PWA per iPhone + deploy GitHub Pages | ✅ |
| 2 | Supabase: account, schema, RLS, codice di recupero | ✅ |
| 3 | Sincronizzazione offline-first | ✅ |
| 4 | Wallet condivisi + carte fedeltà | ✅ |
| 5 | Notifiche (push web, locali Android, in app) | ✅ |
| 6 | Telemetria | ✅ |
| 7 | Bot Telegram amministratore | ✅ |
| 8 | Test E2E, privacy policy, Sicurezza dei dati | ✅ |

## Struttura

```
src/app/
  core/            merge.util.ts (unione a tre vie), balances.util.ts (suddivisioni e saldi), local-changes.ts
  notifications/   planner.ts  ← UNICO planner delle notifiche, copiato nelle Edge Functions dal deploy
  services/        auth, sync (+ doc-sync), wallet, notification, telemetry, barcode-scan, storage, category, …
  components/      auth, recovery-code, expense-form, loyalty-card-form/-view, barcode, pipes/money …
  pages/shared/    scheda "Condivisi" (wallet + carte) e dettaglio wallet
src/sw.js          service worker (cache offline + notifiche push), solo web
supabase/          schema.sql (tabelle, RLS, funzioni, recupero, telemetria), cron.sql, functions/
scripts/           apply-schema, deploy-functions, bump-version, env (legge keystore-privato/secrets.env)
tests/             logic.test.mts (unità), e2e/ (web con Edge+CDP, Android con emulatore+DevTools, cleanup)
android/           progetto nativo Capacitor
docs/              CHATLOG, guida e stato pubblicazione Play, sicurezza dei dati
keystore-privato/  ESCLUSA DA GIT: keystore di firma e tutti i segreti
```

## Dati e sincronizzazione

| Dove | Cosa | Chi lo vede |
|---|---|---|
| `localStorage` (`finanzai_*`) | tutto, anche senza account | solo il dispositivo |
| `personal_data` (1 documento JSON per utente, con `version`) | movimenti, budget, obiettivi, categorie, carte personali | solo l'utente (RLS) |
| `wallets` (documento JSON `{expenses, loyaltyCards}` con `version`) + `wallet_members` | spese e carte condivise | solo i membri (RLS) |
| `user_settings` | preferenze personali (tema, valuta, notifiche, orario, fuso) | solo l'utente |
| `profiles` | nome visibile agli altri membri | solo l'utente (gli altri lo vedono tramite `wallet_members`) |
| `push_subscriptions` | iscrizioni Web Push | solo l'utente |
| `recovery_codes`, `recovery_attempts` | hash del codice di recupero, tentativi | nessun client (solo funzioni server) |
| `app_events` | telemetria | i client possono **solo inserire** |

**Come si sincronizza** (`DocSync`): a ogni modifica locale (raggruppate in 1,2 s), al ritorno online, alla riapertura
e su evento Realtime si leggono server e "base" (ultima versione sincronizzata dal dispositivo), si uniscono con
`mergeDoc` (per elemento e poi per campo; stesso campo cambiato da entrambe le parti → vince `updatedAt` più recente)
e si salva con `update … where version = N` → `N+1`. Se nel frattempo qualcuno ha salvato, si ripete (max 5 volte).
Al primo login i dati già presenti sul telefono vengono uniti all'account (i dati di esempio vengono rimossi prima);
se sul dispositivo c'erano dati di un altro account vengono scartati.

## Account e recupero password (senza SMTP)

- Registrazione attiva subito (`mailer_autoconfirm`), password minima 8 caratteri.
- Al **primo accesso** l'app genera un **codice di recupero** (16 caratteri, `XXXX-XXXX-XXXX-XXXX`), mostrato una sola
  volta e salvato solo come hash bcrypt. Se ne può generare uno nuovo da Impostazioni → Account.
- "Password dimenticata?": email + codice + nuova password → Edge Function `recover-password` (max 5 errori/ora per
  email, stessa risposta per email inesistente o codice sbagliato) → nuovo codice mostrato all'utente.
- Elimina account: `delete_my_account()` esce da tutti i wallet (eliminando quelli rimasti vuoti) e cancella l'utente.

## Notifiche

- Permesso chiesto **solo dal tocco** dell'utente (pulsante "Attiva le notifiche" o interruttore), come iOS esige;
  l'interruttore è acceso solo se preferenza attiva **e** permesso di sistema concesso; su iPhone senza app nella
  schermata Home viene spiegato come installarla (iOS 16.4+).
- **Planner unico** `src/app/notifications/planner.ts`: usato da app (Android e riepilogo web) e, copiato da
  `scripts/deploy-functions.mjs`, dalle Edge Functions `daily-reminders` e `notify-expense`.
- Android (`@capacitor/local-notifications` 8): canali "Promemoria" e "Wallet condivisi", icona `ic_stat_notify`,
  promemoria pianificati per 30 giorni, **sempre `isExactNotification: false`** (con `true` il plugin apre le impostazioni
  di sistema e la chiamata resta bloccata).
- Web Push: chiavi VAPID (pubblica in `environment`, privata solo nei segreti delle funzioni); `daily-reminders` è
  chiamata da **pg_cron ogni 15 minuti** con `x-cron-secret` letto dal **Vault**, invia all'orario scelto nel fuso
  dell'utente una volta al giorno; `notify-expense` avvisa gli altri membri rispettando le loro preferenze;
  `push-test` per la prova.

## Telemetria e bot

- `TelemetryService`: azioni (login, nuovo utente, wallet creato/entrato, spesa aggiunta/modificata/eliminata, carte,
  notifiche…) **senza contenuti** (mai importi, descrizioni, nomi, numeri di carte, codici, email) e **tutti gli
  errori** (ErrorHandler globale, `window.onerror`, promesse non gestite, `console.error`, errori di sincronizzazione).
- Le build provate in locale (`localhost` sul web) non inviano telemetria (per i test: `localStorage.finanzai_telemetry_local = '1'`).
- Dopo un nuovo deploy, un `ChunkLoadError` (pezzo di codice della versione precedente) ricarica la pagina una volta.
- Coda locale `telemetry_queue` → tabella `app_events` (solo INSERT per i client). Il nome utente lo aggiunge il
  **trigger** `telemetry_before_insert`; l'evento `nuovo_utente` lo crea un trigger su `auth.users`.
- ID dispositivo: **ID casuale per installazione** (`telemetry_device`), nessun ID hardware o pubblicitario.
- Bot `Bot Telegram/FinanzAIBot` (vedi il suo README): legge `app_events` ogni 15 s con la chiave segreta, risponde
  solo all'amministratore, notifica dedicata per ogni nuovo utente, coda durevole se spento. Registrato nel Bot
  Control Center.

## Segreti

Mai nel repository. Tutto in `keystore-privato/` (ignorata da git):
- `finanzai-release.jks`, `.keystore-credentials.txt` – firma Android (riferita da `android/keystore.properties`, ignorato);
- `secrets.env` – `SUPABASE_ACCESS_TOKEN`, chiavi del progetto (`SUPABASE_SECRET_KEY`, `SERVICE_ROLE`), `VAPID_*`,
  `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`.

Nel codice ci sono solo valori pubblici per definizione (URL del progetto, chiave *publishable*, chiave VAPID pubblica).

## Comandi

```powershell
npm ci
npm start                          # sviluppo
npm run build:web                  # build web, base /FinanzAi/  (DA POWERSHELL: Git Bash storpia --base-href)
npm run build:android              # build Android, base /  + npx cap sync android
npm run version:patch              # nuova versione (package, app, versionName, versionCode+1) — a ogni intervento
npm run db:apply                   # applica supabase/schema.sql + configurazione Auth
npm run deploy:functions           # copia il planner, imposta i segreti, pubblica le Edge Functions, pianifica pg_cron
npm run test:logic                 # test di unità (unione a tre vie, suddivisioni, saldi, import Money Manager)
```

Build Android in locale (Gradle non supporta il JDK 25 di sistema):
```powershell
$env:JAVA_HOME = "$env:ProgramFiles\Android\Android Studio\jbr"
cd android; .\gradlew.bat bundleRelease assembleRelease    # AAB per il Play Store + APK firmato
```

### Test E2E reali

- **Web** (Edge headless + CDP, due utenti in contesti isolati): `npm run build:web`, poi
  `node tests/e2e/serve.mjs www 8765`, Edge con `--headless=new --remote-debugging-port=9333`, e
  `node tests/e2e/web.e2e.mjs` (registrazione + codice, wallet + invito, spese e saldi, avviso in tempo reale,
  carte, offline + unione, dati personali, recupero password, telemetria senza contenuti).
- **Android** (emulatore + DevTools della WebView, APK di debug): `node tests/e2e/android.e2e.mjs <invito> <email> <password>`
  (registrazione, ingresso nel wallet, permesso notifiche dopo il tocco, notifica di prova, promemoria pianificati,
  notifica in background per una spesa di un altro membro).
- Alla fine: `npm run test:cleanup` cancella gli utenti `@example.org`, i loro wallet ed eventi.

## Web app per iPhone (PWA)

Su iPhone: apri https://marctie.github.io/FinanzAi/ in **Safari** → Condividi → **Aggiungi a schermata Home**.
Manifest con `display: standalone` e percorsi relativi, icone normali e *maskable*, `apple-touch-icon` 180 px senza
trasparenza, meta `apple-mobile-web-app-*`, `viewport-fit=cover` e variabili `--ion-safe-area-*` su
`env(safe-area-inset-*)`. Il service worker (`src/sw.js`) è registrato solo se `!Capacitor.isNativePlatform()`.
Deploy automatico con `.github/workflows/pages.yml` a ogni push su `main`.
