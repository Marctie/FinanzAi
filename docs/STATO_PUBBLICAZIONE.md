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

### Ancora da fare (in ordine di priorità)
1. **Campo "metodo di pagamento"** nel form transazioni
2. **Responsive tablet**: layout adattivo per schermi grandi (attualmente mobile-only)
3. **Logo app**: creare un logo dedicato originale (assets/icon attuale sembra già generato ma da verificare/rifinire); verificare favicon
4. **Test**: aggiungere copertura minima sui service critici (storage, analytics, budget, backup)
5. **Storage service**: valutare se passare da `localStorage` grezzo a `@capacitor/preferences`/SQLite (bassa priorità, localStorage funziona)
6. **Privacy policy IT+EN** da pubblicare su GitHub Pages (repo pubblico dedicato, branding generico) — deve menzionare backup JSON locale, nessun uso di Google Drive
7. **Keystore + build firmata `.aab`**, verifica firma con openssl
8. **Play Console**: Data Safety form, scheda store IT (lingua unica), content rating, categoria, contatti, test chiuso, richiesta produzione

## Prossimi passi immediati
- Campo metodo di pagamento + responsive tablet
- Poi logo dedicato e privacy policy
