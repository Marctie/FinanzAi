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
