# Stato pubblicazione FinanzAI — riepilogo operativo

> Ultimo aggiornamento: 2026-08-25. Questo file va tenuto aggiornato ad ogni sessione di lavoro, così se la conversazione si interrompe si può ripartire senza perdere contesto. Vedi anche [CHATLOG.md](./CHATLOG.md) per la cronologia dettagliata.

## Decisioni prese con l'utente

- **Nome sviluppatore in-app**: rimosso ogni riferimento personale (era già commentato/inutilizzato, ora eliminato dal codice).
- **Google Drive**: **NON implementato**. Motivazione: nessuna base OAuth/Google Cloud esistente, richiederebbe client ID, consenso Google, gestione token e manutenzione continua — sproporzionato per il valore aggiunto. Si procede con **export/import JSON locale** (file scaricabile/condivisibile via share sheet Android, con verifica integrità tramite checksum).
- **Nome app**: mantenuto **"FinanzAI"**.
- **App ID Android**: cambiato da `com.finanzai.app` a **`com.finanzai.app`** (rimosso riferimento personale dal package name). Rinominato anche il package Java (`MainActivity`).
- **Lingua**: solo italiano per ora, niente i18n/EN.

## Stato del codice (aggiornato dopo analisi iniziale)

### Fatto e funzionante
- Tracciamento transazioni (importo, data, categoria, titolo, note) — manca "metodo di pagamento"
- Categorie predefinite con icone/colori — **NON personalizzabili dall'utente** (da implementare)
- Dashboard con grafici Chart.js, insights con euristiche locali, mini-chart SVG custom
- Budget mensili con soglie/avvisi (80%/100%)
- Obiettivi di risparmio con contributi manuali
- Ricerca e filtri sui movimenti (tipo, mese, categoria, testo libero)
- Onboarding a 4 step
- Tema chiaro/scuro (system/light/dark) via classi CSS + `prefers-color-scheme`
- Export CSV transazioni

### Corretto in questa sessione (fix critici)
- ✅ Rimosso `server.url` remoto da `capacitor.config.ts` (l'app caricava l'HTML da GitHub Pages invece dei file locali della build — violava sia il requisito "dati locali" che le policy Play Store sul codice eseguito)
- ✅ Rimossi riferimenti al nome personale dello sviluppatore da `settings.page.html/.ts` e `footer.component.html`
- ✅ Cambiato appId/namespace Android da `com.finanzai.app` a `com.finanzai.app`
- ✅ Ripulito `package.json` da metadati boilerplate ("Ionic Framework", link ionicframework.com)
- ✅ `.gitignore`: aggiunta eccezione per `docs/*.md` per poter versionare questi file di tracciamento

### Aggiunto in sessione 2 (2026-08-25)
- ✅ **`CategoryService`**: nuovo service che unisce categorie predefinite (`DEFAULT_CATEGORIES`, invariate) e categorie personalizzate (salvate in `localStorage['finanzai_custom_categories']`). Sostituisce le vecchie funzioni statiche `getCategoryById`/`getCategoriesByType` in tutti gli 8 punti dell'app che le usavano (ai.service, dashboard, add-transaction, transaction-card, budget-progress, budget-form, transactions).
- ✅ **Pagina "Categorie"** (`pages/categories`, route `/tabs/categories`, raggiungibile da Impostazioni → "Gestisci categorie"): lista categorie predefinite (sola lettura, etichetta "Predefinita") e personalizzate (modificabili/eliminabili), form modale con scelta nome, tipo (entrata/uscita), emoji (griglia predefinita) e colore (palette predefinita).
- ✅ **`BackupService`**: backup/restore JSON completo (transazioni, budget, obiettivi, preferenze, categorie personalizzate) con checksum SHA-256 per verifica integrità. Export scarica un file `.json`; import legge un file scelto dall'utente, verifica checksum e struttura, chiede conferma (sovrascrive tutto) e poi ripristina via `StorageService.restoreAll()` / `CategoryService.restoreCustom()`. Integrato in Impostazioni → "Backup e dati" (accanto all'export CSV esistente, mantenuto per uso spreadsheet).
- ✅ Build di verifica (`ng build --configuration development`) completata senza errori dopo tutte le modifiche.

### Aggiunto in sessione 3 (2026-08-25) — completamento fino alla pubblicazione
- ✅ **Metodo di pagamento**: campo aggiunto al modello `Transaction`, al form di inserimento/modifica e mostrato nella card transazione.
- ✅ **Responsive tablet/desktop**: `ion-content`/`ion-header` centrano il contenuto con larghezza massima (680px ≥720px, 840px ≥1024px) invece di stirarlo — grid esistenti (dashboard, budget) si adattano di conseguenza.
- ✅ **Logo e icone**: nuovo logo originale (lettera "F" + linea di tendenza ascendente, coerente con la palette blu/verde dell'app) generato come icona adattiva Android a tutte le densità + splash screen, tramite `@capacitor/assets` da sorgenti SVG in `assets/`. Rimosso `shapes.svg` (residuo del template Ionic di default).
- ✅ **Privacy policy IT+EN — LIVE**: dato che il repository principale `Marctie/FinanzAi` è privato (GitHub Pages non può pubblicare pubblicamente da un repo privato), è stato creato un repository pubblico dedicato **`Marctie/FinanzAI-Privacy`** con solo `index.html` (IT) e `en.html` (EN). URL verificati raggiungibili (HTTP 200): https://marctie.github.io/FinanzAI-Privacy/ (IT) e https://marctie.github.io/FinanzAI-Privacy/en.html (EN). Rimossa la copia precedente da `src/assets/legal/` nell'app principale (ridondante).
- ✅ **Keystore di release**: generato in `keystore/finanzai-release.jks` (PKCS12, validità fino al 2054, subject generico "FinanzAI" senza dati personali), password in `keystore/.keystore-credentials.txt` — **entrambi esclusi da git**, vedi avviso sotto.
- ✅ **Signing config esplicito** in `android/app/build.gradle`, letto da `android/keystore.properties` (anch'esso escluso da git).
- ✅ **Build firmata verificata**: `app-release.aab` generato con `./gradlew bundleRelease` (JDK 21 di Android Studio, non JDK 25 di sistema — incompatibile con Gradle 8.14). Firma verificata con `openssl`: l'impronta SHA-256 del certificato nel bundle corrisponde esattamente a quella del keystore.
- ✅ **Asset store**: icona 512×512, feature graphic 1024×500, e screenshot reali (catturati con Playwright dall'app in esecuzione, non mockup) in tema chiaro e scuro, tutti in `store-assets/`.
- ✅ **Guida pubblicazione Play Console**: creata in `docs/GUIDA_PUBBLICAZIONE_PLAY_STORE.md` con testi pronti per la scheda store, risposte al Data Safety form e al content rating, e procedura passo-passo per test chiuso → produzione.

### ⚠️ Cose che restano da fare (richiedono te, non automatizzabili)
1. **Backup del keystore**: `keystore/finanzai-release.jks` e la password in `keystore/.keystore-credentials.txt` non sono su git (giustamente). **Devi copiarli tu in un posto sicuro (password manager + backup offline) prima di continuare** — se li perdi non potrai più pubblicare aggiornamenti della stessa app.
2. ~~Email di contatto~~ — risolto: l'utente ha scelto `marco.p.develop@gmail.com` come unico dato di contatto da esporre pubblicamente (privacy policy + scheda store).
3. **Tutti i passaggi nella Play Console stessa**: account, creazione app, upload AAB, Data Safety, content rating, test chiuso, richiesta produzione — guida completa in `docs/GUIDA_PUBBLICAZIONE_PLAY_STORE.md`. Non ho accesso a un browser per farlo al posto tuo.

### Facoltativo / a bassa priorità (non bloccante per la pubblicazione)
- Test automatici sui service critici (storage, analytics, budget, backup) — l'app funziona ed è stata verificata manualmente via build e screenshot reali, ma manca una suite di test.
- Passaggio da `localStorage` a `@capacitor/preferences`/SQLite — localStorage funziona correttamente, non è un blocco.
- Favicon web (`src/assets/favicon.png`) non rigenerata con il nuovo logo — irrilevante per la pubblicazione Android, riguarda solo l'eventuale build web/PWA su GitHub Pages.
