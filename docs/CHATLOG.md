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
