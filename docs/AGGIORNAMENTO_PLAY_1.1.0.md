# Play Console — aggiornamento FinanzAI 1.1.0 (versionCode 2)

La 1.1.0 introduce **account facoltativo, sincronizzazione, wallet condivisi, carte fedeltà, notifiche e
diagnostica di utilizzo ed errori**. Le risposte date per la 1.0 ("nessun dato raccolto", "nessun accesso limitato")
non sono più valide: vanno aggiornate **prima** di inviare la release, altrimenti Google può rifiutare l'aggiornamento.

Ordine consigliato: 1) privacy policy online ✅ → 2) caricare l'AAB → 3) Sicurezza dei dati → 4) Accesso all'app →
5) Eliminazione account → 6) Classificazione contenuti → 7) invio della release.

File (fuori dal repository): `Play Store/FinanzAi/release-1.1.0/`
- **`FinanzAI-1.1.0-vc2.aab`** → da caricare in Play Console
- `FinanzAI-1.1.0-vc2.apk` → firmato, per installazione diretta / prova

Firma: stesso keystore della 1.0 (`keystore-privato/finanzai-release.jks`).

## 1. Privacy policy ✅
Pubblicata allo stesso URL già registrato: `https://marctie.github.io/FinanzAI-Privacy/` (IT) e `en.html` (EN),
aggiornata il 17/11/2026. Contiene la sezione con ancora per l'eliminazione dell'account.

## 2. Nuova release
Note di rilascio (it-IT):
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
Note di rilascio (en-US), se la scheda ha anche l'inglese:
```
<en-US>
What's new in 1.1.0:
• Optional account: your data syncs between phone and web (offline too)
• Shared wallets: split expenses with friends, roommates or partner and see who owes whom
• Loyalty cards: keep them all on your phone, scan them and share them with your wallet
• Notifications: reminders for recurring payments, budgets and goals, plus shared expense alerts
• Password recovery with a personal code
</en-US>
```

## 3. Contenuti dell'app → Sicurezza dei dati

| Domanda | Risposta |
|---|---|
| L'app raccoglie o condivide dati utente? | **Sì** |
| Tutti i dati sono crittografati in transito? | **Sì** |
| Gli utenti possono chiedere l'eliminazione dei dati? | **Sì** (punto 5) |

Tipi di dati: per tutti *Raccolti* **sì**, *Condivisi* **no** (Supabase e Telegram sono fornitori che trattano i dati
per conto dello sviluppatore; la condivisione di spese e carte con i membri di un wallet è avviata dall'utente ed è
esente), *Trattati in modo temporaneo* **no**.

| Categoria Play | Tipo | Obbligatorio? | Finalità |
|---|---|---|---|
| Informazioni personali | **Indirizzo email** | Facoltativo (solo con account) | Funzionalità dell'app, Gestione dell'account |
| Informazioni personali | **Nome** (nome visibile nei wallet) | Facoltativo | Funzionalità dell'app, Gestione dell'account |
| Informazioni personali | **ID utente** | Facoltativo | Funzionalità dell'app, Gestione dell'account |
| Informazioni finanziarie | **Altre informazioni finanziarie** (movimenti, budget, obiettivi, spese condivise, carte fedeltà) | Facoltativo | Funzionalità dell'app |
| Attività nelle app | **Interazioni con le app** (solo il tipo di azione, senza contenuti) | Obbligatorio | Analisi |
| Informazioni e prestazioni delle app | **Log degli arresti anomali** | Obbligatorio | Analisi |
| Informazioni e prestazioni delle app | **Diagnostica** | Obbligatorio | Analisi |
| ID dispositivo o altri ID | **ID dispositivo o altri ID** (ID casuale dell'installazione, `telemetry_device`) | Obbligatorio | Analisi |

Non raccolti: posizione, contatti, foto/video (la fotocamera legge solo il codice della carta, l'immagine non viene
salvata né inviata), audio, file, calendario, messaggi, cronologia web, salute, ID pubblicità (le iscrizioni push
riguardano solo la web app).

## 4. Contenuti dell'app → Accesso all'app
Scegli **"L'accesso a tutte le funzionalità o ad alcune è limitato"** e aggiungi:
- Nome: `Account di revisione`
- Nome utente / password: da `keystore-privato/play-review-account.txt` (file locale, non versionato)
- Istruzioni:
  `L'app funziona anche senza account. Per le funzioni con account: Altro → Account → Accedi con le credenziali indicate (nessuna verifica email o codice richiesti). Scheda "Condivisi": wallet di esempio "Casa (esempio)" con spese, saldi e una carta fedeltà condivisa.`

L'account ha già il codice di recupero e un wallet di esempio. **Non eliminarlo** finché l'app è pubblicata:
`tests/e2e/cleanup.mjs` cancella solo `e2e-*@example.org`.

## 5. Eliminazione dell'account
Play richiede sia l'eliminazione dall'app sia un link web.
- Nell'app: **Altro → Account → Elimina account** (cancella account, dati sincronizzati, preferenze, iscrizioni
  push; esce da tutti i wallet, eliminando quelli senza altri membri).
- **URL per la richiesta di eliminazione**: `https://marctie.github.io/FinanzAI-Privacy/#eliminazione-account`
  (spiega come farlo dall'app o via email).
- Dati eliminati: account, email, nome, dati personali sincronizzati, preferenze, iscrizioni push, appartenenza ai
  wallet. Dati conservati: eventi tecnici di utilizzo ed errori fino a 90 giorni; le spese già registrate in un
  wallet con altri membri restano visibili a loro.

## 6. Classificazione dei contenuti
Riaprire il questionario: ora gli utenti possono **condividere contenuti** (spese e carte fedeltà) ma solo con i
membri di un wallet invitati con codice; nessuna chat, nessun contenuto pubblico.

## 7. Funzionalità finanziarie
Invariato: "La mia app non fornisce funzionalità finanziarie" (dividere le spese è un calcolo: nessun denaro passa
dall'app, niente pagamenti, prestiti o conti).

## Permessi nell'AAB
- `POST_NOTIFICATIONS`: chiesto solo dopo il tocco dell'utente su "Attiva le notifiche".
- `SCHEDULE_EXACT_ALARM` aggiunto dal plugin delle notifiche è **rimosso** dal manifest (`tools:node="remove"`): le
  notifiche usano sempre `isExactNotification: false`, quindi non serve la dichiarazione "sveglie esatte".
- Scanner delle carte: modulo Google Code Scanner di Play Services, **nessun** permesso fotocamera all'app.

## Attenzione: APK installati a mano
Chi ha installato l'APK a mano può aggiornare installando quello nuovo sopra (stessa chiave). Non può passare agli
aggiornamenti del Play Store senza disinstallare, perché Google firma con una chiave diversa (Play App Signing):
prima di disinstallare conviene accedere con un account, così i dati restano sincronizzati.
