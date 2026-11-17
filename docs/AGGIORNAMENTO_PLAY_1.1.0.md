# Aggiornamento Play Store — FinanzAI 1.1.0 (versionCode 2)

File da caricare (generati in locale, non nel repository; copia pronta in `Play Store/FinanzAi/release-1.1.0/`):
- **AAB per la Play Console**: `android/app/build/outputs/bundle/release/app-release.aab`
- APK firmato (per installazione diretta / prova): `android/app/build/outputs/apk/release/app-release.apk`

Firma: stesso keystore della 1.0 (`keystore-privato/finanzai-release.jks`).

## Note di rilascio (da incollare)

```
<it-IT>
Novità della versione 1.1.0:
• Account facoltativo: i tuoi dati si sincronizzano tra telefono e web (anche offline)
• Wallet condivisi: dividi le spese con amici, coinquilini o partner e scopri chi deve a chi
• Carte fedeltà: tienile tutte nel telefono, scansionale e condividile con il tuo wallet
• Notifiche: promemoria per pagamenti ricorrenti, budget e obiettivi, e avvisi sulle spese condivise
• Recupero password con codice personale
</it-IT>
```

## Cosa cambia nella Play Console (obbligatorio prima di inviare)

### 1. Norme sulla privacy
URL invariato: `https://marctie.github.io/FinanzAI-Privacy/` — già aggiornato al 17/11/2026 (account, Supabase UE,
wallet condivisi, notifiche, diagnostica con ID casuale, eliminazione account).

### 2. Accesso all'app (App content → App access)
Prima: "Nessuna parte dell'app è soggetta a limitazioni". Ora le funzioni condivise richiedono un account
→ scegliere **"Tutte le funzionalità o alcune sono soggette a limitazioni"** e fornire un account di prova per la
revisione (creare un account dedicato dall'app, non usare dati personali; conservare le credenziali in
`keystore-privato/`).

### 3. Sicurezza dei dati (App content → Data safety)

Domande generali:
| Domanda | Risposta |
|---|---|
| L'app raccoglie o condivide dati utente? | **Sì** |
| Tutti i dati sono crittografati in transito? | **Sì** (HTTPS) |
| Gli utenti possono chiedere l'eliminazione dei dati? | **Sì** — dall'app (Impostazioni → Account → Elimina account) e via email |

Tipi di dati **raccolti** (nessuno è "condiviso" con terze parti: Supabase è un fornitore che tratta i dati per conto
dello sviluppatore, quindi non conta come condivisione):

| Categoria → tipo | Raccolto | Obbligatorio? | Finalità |
|---|---|---|---|
| Informazioni personali → **Indirizzo email** | Sì | Facoltativo (solo con account) | Funzionalità app, Gestione account |
| Informazioni personali → **Nome** (nome visibile) | Sì | Facoltativo | Funzionalità app, Gestione account |
| Informazioni finanziarie → **Altre informazioni finanziarie** (movimenti, budget, spese condivise, carte fedeltà) | Sì | Facoltativo (solo con account) | Funzionalità app |
| Attività nelle app → **Interazioni con l'app** (azioni, senza contenuti) | Sì | Obbligatorio | **Analisi** |
| Informazioni e prestazioni dell'app → **Log degli arresti anomali** / **Diagnostica** (errori) | Sì | Obbligatorio | **Analisi** |
| ID dispositivo o altri ID → **ID casuale per installazione** | Sì | Obbligatorio | **Analisi** |

Non raccolti: posizione, contatti, foto/video (la fotocamera legge solo il codice della carta, l'immagine non viene
salvata né inviata), audio, file, calendario, messaggi, cronologia web, ID pubblicità.

I dati raccolti sono "elaborati in modo temporaneo"? **No** (vengono conservati: dati dell'account finché esiste,
telemetria max 90 giorni).

### 4. Funzionalità finanziarie
Invariato: l'app non fornisce servizi finanziari (niente pagamenti, prestiti, conti): dividere le spese tra amici è
un semplice calcolo, nessun denaro passa dall'app.

### 5. Permessi nuovi nell'AAB
- `POST_NOTIFICATIONS` (notifiche, chiesto solo dopo il tocco dell'utente).
- `SCHEDULE_EXACT_ALARM` aggiunto dal plugin delle notifiche viene **rimosso** dal manifest (`tools:node="remove"`):
  le notifiche usano sempre `isExactNotification: false`, quindi non serve la dichiarazione "sveglie esatte".
- Scanner delle carte: usa il modulo Google Code Scanner di Play Services, che **non** richiede il permesso fotocamera
  all'app.

### 6. Classificazione dei contenuti
Rivedere il questionario: ora esiste **condivisione di contenuti tra utenti** limitata ai membri di un wallet invitati
con codice (spese e carte fedeltà, nessuna chat o contenuto pubblico).
