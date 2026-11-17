# FinanzAI

App di finanza personale (Angular 20 + Ionic 8 + Capacitor 8) disponibile come app Android (Play Store, `com.finanzai.app`) e come web app installabile su iPhone tramite GitHub Pages.

## Stato
| Fase | Contenuto | Stato |
|---|---|---|
| 0 | Pulizia repo e cronologia, cartella segreti | ✅ |
| 1 | PWA per iPhone + deploy GitHub Pages | ✅ |
| 2 | Supabase: account, schema, RLS, recupero password con codice | in corso |
| 3 | Sincronizzazione offline-first | da fare |
| 4 | Gruppi e spese condivise | da fare |
| 5 | Notifiche push / locali | da fare |
| 6 | Telemetria | da fare |
| 7 | Bot Telegram amministratore | da fare |
| 8 | Test E2E, privacy policy, Sicurezza dei dati | da fare |

## Struttura
- `src/` – codice Angular/Ionic
- `android/` – progetto nativo Capacitor
- `docs/` – documentazione e `CHATLOG.md` (una voce per ogni passo)
- `store-assets/` – grafica per il Play Store
- `keystore-privato/` – **esclusa da git**: keystore di firma, token e chiavi (Supabase, Telegram, VAPID, CRON_SECRET)

## Segreti
Nessun segreto entra nel repository. Tutto sta in `keystore-privato/` (ignorata da `.gitignore`):
- `finanzai-release.jks`, `.keystore-credentials.txt` – firma Android (riferita da `android/keystore.properties`, anch'esso ignorato)
- `secrets.env` – token e chiavi di servizio

## Comandi
```powershell
npm ci
npm start                 # sviluppo
npm run build             # build Android (base "/") in www/
npx cap sync android      # copia www/ nel progetto Android
```
> La build web per GitHub Pages va lanciata da **PowerShell**: Git Bash trasforma `--base-href /FinanzAi/` in un percorso Windows.

## Web app per iPhone (PWA)
Indirizzo: **https://marctie.github.io/FinanzAi/**

Su iPhone: apri il link in **Safari** → pulsante Condividi → **Aggiungi a schermata Home**. L'app si apre a schermo intero (modalità standalone), con icona propria, e funziona anche offline.

Come è fatta:
- `src/manifest.webmanifest`: nome, colori, `display: standalone`, `start_url`/`scope` relativi (funzionano con qualunque base-href), icone normali e *maskable*.
- `src/sw.js`: service worker scritto a mano (non `@angular/service-worker`, perché nella Fase 5 deve gestire anche le notifiche push). Pagine: prima la rete, poi la cache; file statici: prima la cache; Supabase mai in cache.
- `src/main.ts`: registra il service worker **solo** se `!Capacitor.isNativePlatform()` e in produzione.
- `src/index.html`: manifest, `apple-touch-icon` (180 px, senza trasparenza), favicon `.ico` + PNG 16/32, meta `apple-mobile-web-app-*`, `viewport-fit=cover`.
- `src/global.scss`: variabili `--ion-safe-area-*` collegate a `env(safe-area-inset-*)` per notch e Dynamic Island.
- Icone generate da `store-assets/icon-512.png` in `src/assets/icons/`.

## Due build separate
| Build | Comando | Base href | Uscita |
|---|---|---|---|
| Android | `npm run build:android` | `/` | `www/` → `npx cap sync android` |
| Web (GitHub Pages) | `npm run build:web` (**da PowerShell**) | `/FinanzAi/` | `www/` |

Il deploy web è automatico: `.github/workflows/pages.yml` compila a ogni push su `main` (base-href calcolato dal nome del repo), copia `index.html` in `404.html` per le rotte dell'app e pubblica con GitHub Actions.

Build Android in locale: Gradle non supporta il JDK 25 di sistema, quindi usare il JDK di Android Studio:
```powershell
$env:JAVA_HOME = "$env:ProgramFiles\Android\Android Studio\jbr"
cd android; .\gradlew.bat assembleDebug    # oppure bundleRelease
```
