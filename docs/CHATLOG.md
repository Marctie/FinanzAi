# Cronologia lavoro — FinanzAI

## 2026-08-25 — Sessione 1: analisi iniziale e fix critici

**Contesto**: richiesta di completare l'app FinanzAI (gestione finanze personali, Ionic/Angular/Capacitor) end-to-end e pubblicarla su Play Store, con lo stesso approccio usato per un progetto precedente ("Device Test Pro", non presente in memoria/contesto di questo progetto).

**Analisi effettuata** (agente Explore, sola lettura): report completo di 20 punti su modello dati, funzionalità, storage, config Android, riferimenti personali. Trovati 2 problemi critici:
1. `capacitor.config.ts` caricava l'app da un server remoto (`https://marctie.github.io/FinanzAi`) invece dei file locali della build — violazione del requisito "dati sempre in locale" e rischio Play Store policy.
2. Nome reale dello sviluppatore presente (ma già commentato/non renderizzato) in `settings.page.html/.ts` e `footer.component.html`.

**Decisioni prese con l'utente**:
- Rimuovere ogni riferimento personale → branding generico
- Niente integrazione Google Drive (troppo onerosa da mantenere per il valore) → export/import JSON locale
- Mantenere nome app "FinanzAI"

**Modifiche applicate**:
- `capacitor.config.ts`: rimosso blocco `server` remoto, l'app ora serve `www/` locale come da configurazione Capacitor standard
- `settings.page.html/.ts`, `footer.component.html`: rimossi blocchi commentati e metodi inutilizzati con nome/link personali
- `android/app/build.gradle`: `namespace`/`applicationId` cambiati da `com.finanzai.app` a `com.finanzai.app`
- `android/app/src/main/java/`: package Java rinominato da `com/finanzai/app/` a `com/finanzai/app/`, `MainActivity.java` aggiornato
- `package.json`: rimossi metadati boilerplate ("Ionic Framework" come author, link ionicframework.com), aggiornata versione a 1.0.0
- `.gitignore`: aggiunta eccezione `!docs/*.md` per poter versionare i file di tracciamento del progetto

**Nota importante per il futuro**: dato che lo storage è `localStorage` (per-origine), il cambio di config del server ha cambiato l'origine del WebView. Non è un problema ora (app mai pubblicata/installata da utenti reali), ma va tenuto a mente se in futuro si cambia ancora la configurazione dopo il rilascio — comporterebbe perdita dati per gli utenti esistenti.

**Prossimi passi**: vedi [STATO_PUBBLICAZIONE.md](./STATO_PUBBLICAZIONE.md) sezione "Ancora da fare".

## 2026-08-25 — Sessione 2: gestione categorie e backup JSON

**Decisione utente**: app solo in italiano, niente localizzazione EN per ora.

**Modifiche applicate**:
- Nuovo `src/app/services/category.service.ts`: merge categorie predefinite + personalizzate (persistite in `localStorage['finanzai_custom_categories']`), CRUD completo per le personalizzate. Sostituite le vecchie funzioni statiche `getCategoryById`/`getCategoriesByType` (rimosse da `categories.constants.ts`) in tutti gli usi esistenti: `ai.service.ts`, `dashboard.page.ts`, `add-transaction.page.ts`, `transaction-card.component.ts`, `budget-progress.component.ts`, `budget-form.component.ts`, `transactions.page.ts`.
- Nuova pagina `src/app/pages/categories/` (lista + form modale con nome/tipo/emoji/colore), route `/tabs/categories`, link da Impostazioni.
- Nuovo `src/app/services/backup.service.ts`: export/import JSON completo con checksum SHA-256 per verifica integrità. `StorageService.restoreAll()` e `CategoryService.restoreCustom()` aggiunti per supportare il ripristino. UI in Impostazioni → "Backup e dati" (export backup, ripristina da backup con conferma, export CSV mantenuto).
- Verificata build (`ng build --configuration development`) senza errori.

**Prossimi passi**: campo metodo di pagamento nel form transazioni, layout responsive per tablet, poi logo e privacy policy.

## 2026-08-25 — Sessione 3: completamento fino alla pubblicazione

Richiesta utente: continuare autonomamente fino al completamento di tutto quanto chiesto, senza check-in intermedi.

**Modifiche applicate**:
- Campo metodo di pagamento (contanti/carta debito/carta credito/bonifico/altro) su modello `Transaction`, form transazione, card transazione.
- Layout responsive: `ion-content`/`ion-header` centrano il contenuto su tablet/desktop (≥720px, ≥1024px) invece di stirarlo edge-to-edge.
- Nuovo logo (F + trend line ascendente) generato come SVG sorgente in `assets/`, poi rasterizzato con `@capacitor/assets` in tutte le icone Android (adaptive icon foreground/background, round, tutte le densità) e negli splash screen. Rimosso `src/assets/shapes.svg` (placeholder Ionic inutilizzato).
- Privacy policy IT+EN scritta (`src/assets/legal/privacy-it.html`, `privacy-en.html`), inclusa nella build Angular e pubblicata via il workflow GitHub Actions già esistente nel repo (push su `main`, deploy automatico su GitHub Pages). Verificata raggiungibile live.
- Keystore di release generato con `keytool` (PKCS12, 2048-bit RSA, validità 10000 giorni, subject generico senza dati personali) in `keystore/finanzai-release.jks`; password casuali generate con `openssl rand`, salvate in `keystore/.keystore-credentials.txt`. Entrambi esclusi da git tramite nuove regole in `.gitignore`.
- `android/app/build.gradle`: aggiunto `signingConfigs.release` esplicito che legge da `android/keystore.properties` (anch'esso gitignored), applicato al `buildType release`.
- Build AAB di release firmata con `./gradlew bundleRelease`, usando il JDK 21 di Android Studio (il JDK 25 di sistema non è compatibile con Gradle 8.14 — errore "Unsupported class file major version 69"). Firma verificata estraendo il certificato dal bundle con `unzip`/`openssl pkcs7` e confrontando l'impronta SHA-256 con quella del keystore: corrispondenza esatta.
- Asset store generati: icona 512×512 e feature graphic 1024×500 (da SVG via `sharp`), screenshot reali dell'app (tema chiaro e scuro) catturati con Playwright contro `ng serve` in esecuzione locale — non mockup, vera UI dell'app. Tutto in `store-assets/`. `playwright` e `sharp` disinstallati dopo l'uso (erano strumenti one-off, non dipendenze dell'app).
- Creata `docs/GUIDA_PUBBLICAZIONE_PLAY_STORE.md`: guida passo-passo per tutto ciò che resta da fare manualmente nella Play Console (creazione app, scheda store con testi pronti in italiano, content rating, Data Safety form, upload AAB, test chiuso, richiesta produzione).
- Due commit pushati su `main` con autore generico `FinanzAI <finanzai.app@gmail.com>`, innescando due deploy automatici su GitHub Pages.

**Aperto/da verificare con l'utente**:
- L'indirizzo `finanzai.app@gmail.com` usato come contatto pubblico (privacy policy + scheda store) è un placeholder nello stile del progetto precedente — va confermato che esista davvero o sostituito.
- Backup del keystore: attualmente esiste solo in locale, mai committato (corretto), ma non ancora copiato altrove dall'utente — rischio di perdita se non salvato.
- Tutti i passaggi Play Console restano manuali (nessun accesso browser/account disponibile).

## 2026-08-25 — Sessione 4: rifiniture, verifica su emulatore reale, avvio pubblicazione

**Verifica repository privato**: `Marctie/FinanzAi` è privato → GitHub Pages non poteva pubblicare la privacy policy pubblicamente. Creato repository pubblico dedicato `Marctie/FinanzAI-Privacy` (utente lo ha creato, io ho pushato `index.html`/`en.html`). L'utente ha attivato GitHub Pages manualmente (Settings → Pages → Deploy from branch → main/root, unico passaggio non automatizzabile senza token API). Verificato online (HTTP 200) su entrambe le lingue.

**Email di contatto**: su richiesta esplicita dell'utente, sostituito il placeholder `finanzai.app@gmail.com` con `marco.p.develop@gmail.com` (unico dato personale che l'utente ha scelto consapevolmente di esporre come contatto pubblico) in privacy policy IT/EN e guida Play Console. Rimossa la dicitura fuorviante "indirizzo distinto da contatto personale" dato che ora lo è di proposito.

**Controllo SDK Android**: richiesto dall'utente, verificato che `compileSdk`/`targetSdk` erano già alla versione 36 (più recente disponibile), impostati dal template Capacitor 8 di base — nessuna modifica necessaria.

**Bug trovato e corretto — Splash screen inerte**: `capacitor.config.ts` conteneva una configurazione per `@capacitor/splash-screen`, ma il plugin non era mai stato installato via npm (config "morta", senza alcun effetto). Installato correttamente, sincronizzato con Android, e collegato in `app.component.ts`: la splash nativa (con il nuovo logo) resta visibile finché `StorageService.init()` non è completo, poi si chiude con una dissolvenza di 250ms.

**Nuove funzionalità su richiesta esplicita dell'utente**:
- **Guida in-app**: nuova pagina `/tabs/guide` con FAQ ad accordion (6 sezioni: movimenti, categorie, budget, obiettivi, analisi, dati/backup), raggiungibile da Impostazioni.
- **Gestione dati dimostrativi**: banner in Home visibile quando sono ancora attivi i dati precaricati, con azione per rimuoverli e iniziare a usare l'app con dati reali (con backup di sicurezza automatico prima della cancellazione).
- **Backup automatico silenzioso**: eseguito ad ogni avvio dell'app (nessuna interazione utente, salvato in locale con verifica di integrità) e prima di ogni operazione distruttiva. Sopravvive anche a "Cancella tutti i dati". Visibile/ripristinabile da Impostazioni.

**Verifica reale su emulatore Android** (richiesta esplicita dell'utente, non solo screenshot da browser come nelle sessioni precedenti):
- Rilevato l'emulatore già avviato dall'utente (`emulator-5554`, Android via `adb devices`).
- Compilato `app-release.apk` (variante APK del bundle, per installazione diretta via adb — l'AAB non è installabile direttamente).
- Firma verificata con `apksigner verify --print-certs`: schema v2, impronta SHA-256 identica al keystore (`43:4D:95:18:FA:26:E8:C4:73:3F:50:7A:7E:25:58:AB:36:93:35:F3:E7:31:EA:92:12:A5:C3:3B:FA:CD:8B:2C`).
- Installato sull'emulatore, avviato, catturati screenshot reali (non browser): onboarding, dashboard con banner dati demo, grafici — tutto funzionante correttamente nel runtime Android nativo.

**Prossimi passi**: guida passo-passo alla pubblicazione su Google Play Console (vedi [GUIDA_PUBBLICAZIONE_PLAY_STORE.md](./GUIDA_PUBBLICAZIONE_PLAY_STORE.md)), avviata su richiesta dell'utente in questa sessione.

## 2026-08-25 — Sessione 4 (continua): test su emulatore reale + avvio pubblicazione guidata

**Test nativo su emulatore reale**: rilevato l'emulatore Android già avviato dall'utente (`emulator-5554`) tramite `adb devices`. Compilato `app-release.apk` (variante APK del bundle per installazione diretta), firma verificata con `apksigner verify --print-certs` (schema v2, impronta SHA-256 identica al keystore). Installato e avviato sull'emulatore: onboarding, dashboard con banner dati demo, navigazione tra le tab — tutto funzionante nel runtime Android nativo, non solo nel browser.

**Screenshot store rifatti da emulatore reale**: sostituiti i 5 screenshot precedenti (catturati via Playwright/browser) con catture reali dall'emulatore via `adb shell screencap`, navigando l'app con `adb shell input tap`: dashboard (con banner demo dismissato per un'immagine pulita), movimenti, budget, insights, nuova transazione. Rimossi i due screenshot dark-mode da browser (non sostituiti con equivalenti nativi, il set di 5 è comunque sopra il minimo richiesto da Google Play). Committati e pushati.

**Guida passo-passo Play Console avviata**: l'utente aveva già un account sviluppatore attivo. Percorso seguito insieme, schermata per schermata (screenshot forniti dall'utente, risposte fornite in tempo reale):
- Creazione app: nome pacchetto `com.finanzai.app` (deve combaciare esattamente con l'applicationId), lingua predefinita cambiata da inglese a italiano
- Creazione release di test: caricamento AAB da `android/app/build/outputs/bundle/release/app-release.aab`, nome release e note di rilascio (formato con tag `<it-IT>...</it-IT>`)
- Scheda store principale: nome, descrizione breve/completa, categoria "Finanza", contatti, grafica (icona 512, feature graphic, screenshot)
- Norme sulla privacy: URL `https://marctie.github.io/FinanzAI-Privacy/`
- Dettagli di accesso: "No" (nessuna parte dell'app soggetta a limitazioni — niente login/account/pagamenti)
- Annunci: "No" (nessuna pubblicità)
- Classificazione dei contenuti (questionario IARC completo): categoria "Tutti gli altri tipi di app", tutte le risposte "No" (nessun contenuto per adulti, condivisione contenuti utente, contenuto online dinamico, prodotti riservati adulti, posizione condivisa, acquisti di beni digitali, ricompense/criptovalute)
- Pubblico di destinazione: solo "18 o più" (evita deliberatamente le Play Families Policies, non pertinenti per un'app di finanza personale)
- Sicurezza dei dati: "No" (l'app non raccoglie né condivide alcun dato utente)
- App governative: "No"
- Funzionalità finanziarie: "La mia app non fornisce funzionalità finanziarie" (è un tracciamento personale manuale, non un servizio finanziario operativo)
- ID pubblicità: "No" (nessun SDK con AD_ID)
- App per la salute: "La mia app non ha funzionalità relative alla salute"
- Categoria app store: "Finanza"

**Chiarimento test interno vs test chiuso**: spiegato che il test chiuso (non quello interno) è il prerequisito obbligatorio di Google per account sviluppatore nuovi (minimo 12 tester per 14 giorni continuativi) prima di poter richiedere l'accesso alla produzione. L'utente aveva configurato solo il test interno per errore — soluzione data: usare "Promuovi release" nella pagina della release di Test interno per spostarla sul canale Test chiuso senza dover ricaricare l'AAB, oppure ricaricarlo direttamente in Test → Test chiuso.

**Memoria aggiornata**: il file di memoria `play_console_listing_qa.md` (fuori dal repository, in `~/.claude/projects/.../memory/`) è stato aggiornato progressivamente con tutte queste domande/risposte, pensato per essere riutilizzato in futuri progetti con lo stesso profilo (nessun account, dati locali, no pubblicità).

**Stato a fine sessione**: l'utente ha completato la configurazione (a suo dire) e sta ora aspettando/agendo lato Play Console. Nessuna modifica al codice in questa parte della sessione — solo assistenza sulla configurazione della Play Console. Nessun commit necessario oltre a quelli già fatti.

---

## 2026-11-17 — Fase 0: pulizia repository e segreti

- Verificato che la cartella collegata a `github.com/Marctie/FinanzAi` è `Play Store/FinanzAi/FinanzAi` (la copia in `Play Store/Finance` è più vecchia, senza Android, e non viene più usata).
- Creato un backup `.bundle` completo **solo in locale**, fuori dal repository.
- Cronologia riscritta con git-filter-repo: autori e committer unificati su un'identità neutra, rimossi email personali/aziendali e il vecchio package name dai contenuti e dai messaggi. Force push su GitHub.
- Creata `keystore-privato/` (ignorata da git): spostati keystore di firma e credenziali, aggiunti token Supabase e Telegram. `android/keystore.properties` ora punta lì.
- `.gitignore`: esclusi `keystore-privato/`, `.env*`, `*secrets*`; il README è ora tracciato.
- Aggiunto `README.md` come documentazione principale.
- Supabase: il token fornito ha permessi limitati (può leggere i progetti, non crearne). Creazione del progetto dedicato in sospeso.

## 2026-11-17 — Supabase collegato
- Generato un token di gestione con accesso completo all'organizzazione. Il piano gratuito ammette 2 progetti attivi: usato il progetto vuoto "FinanzAi" (UE, Irlanda) già creato dalla dashboard. Chiavi salvate solo in `keystore-privato/secrets.env`.

## 2026-11-17 — Fase 1: PWA per iPhone e GitHub Pages
- Manifest riscritto (standalone, percorsi relativi, icone PNG normali e maskable); rimosse le vecchie icone `.webp` dichiarate come PNG.
- Nuove icone dal logo dello store: versione a tutto campo con gradiente per apple-touch-icon e maskable (gli angoli trasparenti su iOS diventerebbero neri), favicon `.ico` multi-dimensione + PNG 16/32/64.
- Service worker `src/sw.js` registrato solo sul web (`!Capacitor.isNativePlatform()`), con funzionamento offline.
- Safe area: variabili Ionic collegate a `env(safe-area-inset-*)`, onboarding (unica schermata senza header) con padding dedicato.
- Workflow rinominato in `.github/workflows/pages.yml`, Node 22. Script `build:web` e `build:android` separati. Il vecchio branch `gh-pages` non è più usato (Pages pubblica tramite Actions).
- Test: build web con base `/FinanzAi/` verificata in Edge headless via CDP (service worker attivo sullo scope corretto, manifest e icona iOS raggiungibili, app funzionante anche offline). Build Android con base `/`, APK installato e avviato sull'emulatore: l'app si apre normalmente e il service worker non viene registrato.

## 2026-11-17 — Fase 2: account Supabase, schema e RLS (versione 1.1.0)
- `supabase/schema.sql` (rieseguibile), applicato con `scripts/apply-schema.mjs` via Management API: `profiles`, `personal_data`, `wallets`, `wallet_members`, `user_settings`, `push_subscriptions`, `recovery_codes`, `recovery_attempts`, `app_events`. RLS attiva su tutte le 9 tabelle; privilegi per colonna (i membri non possono cambiare codice invito o autore); funzioni `create_wallet`, `join_wallet`, `leave_wallet`, `regenerate_invite_code`, `remove_wallet_member`, `set_display_name`, `delete_my_account`.
- Supabase Auth: accesso immediato senza conferma email (nessun SMTP), password minima 8, URL della web app.
- Recupero password: su richiesta, niente email né bot ma **codice di recupero personale** creato al primo accesso (come Dispensina): mostrato una volta, salvato come hash bcrypt, verificato dalla Edge Function `recover-password` (max 5 errori/ora), sostituito dopo l'uso.
- App: `AuthService`, finestra Accedi/Registrati/Password dimenticata, finestra del codice di recupero, sezione Account nelle Impostazioni (nome visibile, nuovo codice, cambio password, esci, elimina account).

## 2026-11-17 — Fase 3: sincronizzazione offline-first
- `DocSync`: documento JSON con `version`, salvataggio `where version = N`, ripetizione in caso di conflitto, unione a tre vie (`core/merge.util.ts`: per elemento e per campo, vince `updatedAt` più recente sullo stesso campo, la modifica vince sulla cancellazione), base salvata in locale.
- `SyncService`: dati personali + preferenze personali separate (`user_settings`) + wallet; coda locale (le modifiche offline partono al ritorno della rete), Supabase Realtime su `personal_data`, `wallets`, `wallet_members`. Al primo login i dati locali vengono uniti all'account (dati di esempio esclusi); dati di un altro account sul dispositivo vengono scartati.
- 11 test di unità (`tests/logic.test.mts`) su unione, suddivisioni e saldi.

## 2026-11-17 — Fase 4: wallet condivisi e carte fedeltà
- Nuova scheda **Condivisi**: wallet (crea, entra con codice invito, membri, rinomina, esci) e dettaglio con Spese, Saldi ("chi deve a chi" semplificato, pulsante "Saldato" che registra il rimborso), Carte, Membri.
- Spese: chi ha pagato, importo, suddivisione in parti uguali / percentuale / importi con anteprima e controllo delle somme; arrotondamento ai centesimi con il metodo dei resti maggiori.
- Carte fedeltà (richiesta aggiunta durante il lavoro): personali o condivise con un wallet; codice a barre (JsBarcode) o QR mostrato a schermo intero; scansione con ML Kit (Android, senza permesso fotocamera) o zxing (web/iPhone).

## 2026-11-17 — Fase 5: notifiche
- Planner unico `src/app/notifications/planner.ts` (pagamenti ricorrenti, budget oltre soglia, obiettivi in scadenza, messaggi dei wallet), copiato nelle funzioni da `scripts/deploy-functions.mjs`.
- Edge Functions `notify-expense`, `push-test`, `daily-reminders` (pg_cron ogni 15 minuti, segreto nel Vault, orario e fuso dell'utente) + VAPID; service worker con gestione push e apertura della pagina giusta al tocco.
- Android: canali dedicati, icona di stato, promemoria pianificati, avviso locale quando un altro membro aggiunge spese/carte ad app in background, sempre `isExactNotification: false`; tolto dal manifest `SCHEDULE_EXACT_ALARM` aggiunto dal plugin (non serve e il Play Store lo limita).
- In app: avviso a comparsa con pulsante "Apri" quando un altro membro modifica un wallet.
- Permesso chiesto solo dal tocco, con richiesta guidata e interruttore legato allo stato reale del permesso; spiegazione per iPhone senza app nella schermata Home.

## 2026-11-17 — Fase 6: telemetria
- `TelemetryService` (da Dispensina): coda locale, ID casuale per installazione, eventi senza contenuti, tutti gli errori (ErrorHandler globale, `window.onerror`, promesse, `console.error`, errori di sincronizzazione, errori prima dell'avvio).
- `app_events`: i client possono solo inserire (verificato: lettura e `user_label` falsificato rifiutati con 401); nome utente aggiunto dal trigger; evento `nuovo_utente` creato da un trigger su `auth.users`.

## 2026-11-17 — Fase 7: bot Telegram FinanzAIBot
- Cartella `Bot Telegram/FinanzAIBot` (derivata da Dispence-Track): lettura ogni 15 s, risposta solo all'amministratore, comandi `/stato /oggi /utenti /errori /errore N /risolto N /ultimi N /notifiche on|off /aiuto`, **messaggio dedicato per ogni nuovo utente** (anche con avvisi spenti o in arretrato). 11 test offline superati.
- Registrato nel Bot Control Center (make_config.py, config.json e copia accanto all'.exe, con backup `.bak_prima_finanzai_bot`).
- Verificato: con il bot spento l'evento resta in coda e viene consegnato alla riaccensione.

## 2026-11-17 — Fase 8: test E2E, privacy, pubblicazione
- Web (Edge headless + CDP, due utenti): 12 passi superati, nessun errore in console. Trovati e corretti durante i test: proprietà `modal` riservata da Ionic nei componenti finestra (rinominata `modalCtrl`), testo "Tu deve" → "Devi", evento di recupero password registrato senza utente.
- Android (emulatore + DevTools della WebView): 7 passi superati, comprese le notifiche (permesso dopo il tocco, notifica di prova, promemoria pianificati, notifica in background per la spesa di un altro membro), ripetuti dopo la rimozione di `SCHEDULE_EXACT_ALARM`.
- Utenti di test `@example.org`, i loro wallet ed eventi cancellati (`tests/e2e/cleanup.mjs`).
- Privacy policy IT/EN riscritta e pubblicata (account, Supabase UE, wallet, notifiche, diagnostica con ID casuale di installazione, eliminazione account); testi della guida e della presentazione aggiornati.
- Numero di versione unico (`scripts/bump-version.mjs`): 1.1.0, Android versionCode 2. AAB e APK di release firmati con il keystore della 1.0; istruzioni per Play Console (note di rilascio, Sicurezza dei dati, accesso all'app) in `docs/AGGIORNAMENTO_PLAY_1.1.0.md`.

## 2026-11-17 — Attribuzione dei commit
- Su richiesta: da ora nessun commit o PR riporta righe di coautore/attribuzione dell'assistente.
- Scansione dei 24 repository pubblici dell'account: righe di attribuzione trovate in FinanzAi, Dispence, DispenceAi-privacy, ScoutSafe, Script-My-Nails-Professional e informatix-repair (qui anche commit con autore "Claude").
- FinanzAi: righe rimosse da tutta la cronologia (git-filter-repo) e force push. Gli altri repository restano in attesa di conferma (riscrittura + force push).
- AAB e APK 1.1.0 copiati in `Play Store/FinanzAi/release-1.1.0/` (fuori dal repository).

## 2026-11-17 — Preparazione Play Console (spunti dalla checklist di Dispensina)
- Privacy policy: sezione "eliminazione account" con ancora (URL richiesto da Play) e richiesta via email.
- Creato l'account per i revisori Google Play (credenziali solo in `keystore-privato/play-review-account.txt`) con codice di recupero e wallet di esempio; `tests/e2e/cleanup.mjs` ora cancella solo `e2e-*@example.org`.
- `docs/AGGIORNAMENTO_PLAY_1.1.0.md` completata: ordine dei passi, Sicurezza dei dati (con ID utente), Accesso all'app, URL eliminazione account, note di rilascio IT/EN, avviso per gli APK installati a mano.
- Cronologia dei 5 repository pubblici con righe di attribuzione riscritta (backup locali in `Archivio Progetti/Backup-cronologia-2026-11-17/`); i repository privati non sono stati toccati.

## 2026-11-17 — Invio a Google Play della 1.1.0
- Release 2 (1.1.0) caricata nel canale Test chiuso - Alpha con note di rilascio IT.
- Contenuti dell'app aggiornati: Sicurezza dei dati (8 tipi di dati, crittografia, URL eliminazione account, eliminazione dati senza eliminare l'account), Accesso all'app (account dei revisori), nuovo questionario di Classificazione dei contenuti.
- Inviate 3 modifiche per la revisione. Pubblicazione gestita attiva: dopo l'approvazione va premuto "Pubblica" in Panoramica delle pubblicazioni.

## 2026-11-17 — Chiusura sessione
- Domanda: forzare l'aggiornamento dei tester dalla Console non è possibile (servirebbero le In-app updates API: proposta non necessaria per ora).
- Riepilogo dettagliato della sessione salvato in locale (cartella privata esclusa da git) e memoria del progetto aggiornata.
- Da fare: revocare i token incollati in chat, premere "Pubblica" dopo l'approvazione di Google, avviare il bot dal Bot Control Center.

## 2026-11-17 — Versione 1.1.1: importazione da Money Manager e pulizia errori del bot
- Nuova voce **Altro → Backup e dati → Importa da Money Manager**: legge i backup `.mmbackup` (ZIP con prefisso e database SQLite `MyFinance.db`) direttamente sul dispositivo con fflate + sql.js (WebAssembly in `assets/sqljs`, caricato solo quando serve). Anteprima con numero di movimenti, periodo, totali e abbinamento modificabile delle categorie (predefinite dell'app di origine riconosciute dall'icona, quelle con lo stesso nome abbinate, le altre create come nuove). Importi da centesimi, movimenti cancellati esclusi, categoria/conto tramite `sync_link`, limiti di categoria → budget mensili, pagamenti periodici → movimenti ricorrenti, metodo di pagamento dal conto. I movimenti vengono aggiunti con id stabili `mm-…`: reimportare lo stesso file non crea doppioni. Backup automatico prima dell'importazione.
- Verifica su un backup reale fornito dall'utente, solo in locale (file e copie temporanee mai nel repository né su server, poi cancellate): numero di movimenti e totali identici all'origine, categorie, budget e ricorrenze corretti. Test di unità con database finto (5) e test E2E in Edge headless (import + reimportazione senza doppioni).
- Bot pieno di errori: 12 erano dei test locali (build su localhost collegata al Supabase vero) → eliminati e d'ora in poi le build locali non inviano telemetria. 1 vero dall'iPhone: `ChunkLoadError` dopo un nuovo deploy → ora la pagina si ricarica da sola una volta. 1 innocuo da Android (plugin Keyboard "UNIMPLEMENTED") → escluso.
- Versione 1.1.1 (Android versionCode 3).

## 2026-11-17 — Versione 1.1.2: pulsante + della barra in basso
- Sulla web app (GitHub Pages, base `/FinanzAi/`) il pulsante **+** portava a `marctie.github.io/tabs/add-transaction` (404): aveva solo un `href` assoluto e niente attributo `tab`. Ora tutti i pulsanti della barra usano `tab=…` (navigazione del router, che rispetta la base); tolti gli `href` assoluti. Su Android funzionava già (base `/`).
- Nuovo test `tests/e2e/tabs.e2e.mjs`: ogni pulsante della barra resta dentro `/FinanzAi/`.
- Versione 1.1.2 (Android versionCode 4).
