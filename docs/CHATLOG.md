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
