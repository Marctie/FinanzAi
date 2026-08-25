# Guida alla pubblicazione di FinanzAI su Google Play Console

Questa guida copre tutti i passaggi che devi fare **tu manualmente** nella Play Console (non posso operarla al posto tuo: richiede il tuo account Google e non ho accesso a un browser). Tutto il resto (codice, build, keystore, privacy policy, asset grafici) è già pronto — trovi il riepilogo in [STATO_PUBBLICAZIONE.md](./STATO_PUBBLICAZIONE.md).

## 0. Cosa hai già pronto

| Cosa | Dove |
|---|---|
| File AAB firmato | `android/app/build/outputs/bundle/release/app-release.aab` |
| Keystore di release | `keystore/finanzai-release.jks` (⚠️ **non è su git, fai subito un backup altrove** — se lo perdi non potrai più aggiornare l'app) |
| Password keystore | `keystore/.keystore-credentials.txt` (⚠️ **non è su git**, spostala in un password manager e poi cancella il file) |
| Privacy policy IT | https://marctie.github.io/FinanzAi/assets/legal/privacy-it.html |
| Privacy policy EN | https://marctie.github.io/FinanzAi/assets/legal/privacy-en.html |
| Icona store 512×512 | `store-assets/icon-512.png` |
| Feature graphic 1024×500 | `store-assets/feature-graphic.png` |
| Screenshot (chiaro e scuro) | `store-assets/screenshots/*.png` |

**Impronta SHA-256 del certificato di firma** (verificata con openssl): `43:4D:95:18:FA:26:E8:C4:73:3F:50:7A:7E:25:58:AB:36:93:35:F3:E7:31:EA:92:12:A5:C3:3B:FA:CD:8B:2C` — puoi ricontrollarla in qualsiasi momento con:
```
openssl pkcs12 -in keystore/finanzai-release.jks -nodes -passin pass:LA_TUA_PASSWORD | openssl x509 -noout -fingerprint -sha256
```

## 1. Account Play Console

1. Vai su https://play.google.com/console e accedi con l'account Google che vuoi usare per pubblicare (può essere il tuo personale — non è un problema, non compare pubblicamente se non lo vuoi).
2. Se non hai già un account sviluppatore, paga la quota una tantum di 25$ e completa la verifica identità richiesta da Google (può richiedere 1-2 giorni).

## 2. Crea l'app

1. "Crea app" → Nome: **FinanzAI** → Lingua predefinita: **Italiano** → App gratuita → conferma le dichiarazioni richieste.
2. Nella dashboard che si apre, segui la checklist "Imposta la tua app" — i punti sotto la ricalcano in ordine.

## 3. Presenza sullo store — Scheda store principale (italiano)

**Nome app**: FinanzAI

**Descrizione breve** (80 caratteri max):
```
Gestisci spese, entrate, budget e obiettivi di risparmio — tutto in locale
```

**Descrizione completa**:
```
FinanzAI ti aiuta a tenere sotto controllo le tue finanze personali in modo semplice e completo.

TRACCIAMENTO SPESE ED ENTRATE
Registra ogni movimento in pochi secondi: importo, categoria, metodo di pagamento e note opzionali.

CATEGORIE PERSONALIZZABILI
Usa le categorie predefinite (casa, spesa, trasporti, svago, stipendio...) o creane di nuove con icona e colore a tua scelta.

BUDGET MENSILI
Imposta un budget per ogni categoria e ricevi un avviso quando ti stai avvicinando al limite.

OBIETTIVI DI RISPARMIO
Fissa obiettivi (fondo emergenza, vacanza, acquisto importante) e monitora i progressi.

ANALISI CHIARE
Grafici su andamento mensile, ripartizione per categoria e confronto tra periodi, per capire a colpo d'occhio dove vanno i tuoi soldi.

RICERCA E FILTRI
Trova rapidamente qualsiasi movimento per testo, categoria, tipo o mese.

I TUOI DATI RESTANO TUOI
Tutti i dati sono salvati esclusivamente sul tuo dispositivo. Nessun account richiesto, nessun server esterno, nessuna pubblicità. Puoi esportare un backup completo in qualsiasi momento e ripristinarlo quando vuoi.

TEMA CHIARO E SCURO
Si adatta automaticamente al tema del tuo dispositivo.
```

**Categoria**: Finanza
**Dettagli di contatto**: email finanzai.app@gmail.com (vedi nota sotto)
**Privacy policy URL**: https://marctie.github.io/FinanzAi/assets/legal/privacy-it.html

**Grafica da caricare**:
- Icona app: `store-assets/icon-512.png`
- Feature graphic: `store-assets/feature-graphic.png`
- Screenshot telefono (minimo 2, consigliati 4-8): tutti i file in `store-assets/screenshots/`

> ⚠️ **Nota sull'email di contatto**: nella privacy policy e nella scheda store ho usato `finanzai.app@gmail.com` come indirizzo dedicato all'app (non personale), sullo stesso modello usato per Device Test Pro. **Verifica che questa casella esista davvero e sia raggiungibile da te**, oppure dimmi quale indirizzo dedicato preferisci usare e aggiorno privacy policy e scheda store di conseguenza.

## 4. Content rating (classificazione dei contenuti)

1. Vai su "Classificazione dei contenuti" → compila il questionario IARC.
2. Categoria: **Utility/produttività** (o "Finanza" se proposta).
3. Rispondi "No" a tutte le domande su violenza, contenuti sessuali, sostanze, gioco d'azzardo, ecc. — l'app non ne contiene.
4. Otterrai una classificazione bassa (PEGI 3 / tutti).

## 5. Data safety (sicurezza dei dati)

Questo form deve rispecchiare esattamente quanto scritto nella privacy policy. Le risposte corrette per FinanzAI:

- **L'app raccoglie o condivide dati utente?** → **No** (tutti i dati restano sul dispositivo, non vengono mai trasmessi).
- Se il form obbliga comunque a dichiarare i tipi di dato *gestiti* dall'app anche se solo in locale (alcune versioni del form lo richiedono per i dati "elaborati sul dispositivo"): dichiara **"Informazioni finanziarie" (transazioni, importi)** con:
  - Raccolti: No
  - Condivisi con terzi: No
  - Elaborati solo sul dispositivo: Sì
  - Scopo: funzionalità dell'app
  - Cancellabili dall'utente: Sì
  - Trasmessi in modo cifrato: non applicabile (non lasciano il dispositivo)
- **L'app richiede la cancellazione dei dati dell'account?** → Non applicabile, non esiste un account. Se richiesto, indica che l'utente può cancellare tutti i dati direttamente dall'app (Impostazioni → Cancella tutti i dati).
- **Pratiche di sicurezza**: dati non trasmessi → non serve dichiarare crittografia in transito.

## 6. Contenuti dell'app (App content)

- **Pubblico target**: adulti (o "13+" se preferisci includere adolescenti — l'app non ha contenuti inadatti in ogni caso).
- **Annunci**: **No**, l'app non contiene pubblicità.
- **App per notizie**: No.
- **Dichiarazione COVID-19 / contenuti governativi**: No.
- **Accesso ai contenuti**: nessun account richiesto, tutte le funzioni sono accessibili subito.

## 7. Build e release — Test chiuso

1. Vai su "Test" → "Test chiuso" (o "Internal testing" se preferisci partire da lì per una verifica ancora più rapida prima del closed test).
2. Crea un nuovo rilascio, carica `android/app/build/outputs/bundle/release/app-release.aab`.
3. Note della versione (italiano):
   ```
   Prima versione di FinanzAI: tracciamento spese/entrate, categorie personalizzabili, budget, obiettivi di risparmio, grafici e backup dati.
   ```
4. Aggiungi te stesso (e altri tester se vuoi) come tester via email nella lista tester del canale.
5. Salva e pubblica sul canale di test. Attendi che Google completi la revisione automatica/manuale (di solito minuti-ore per il primo caricamento).
6. Installa l'app dal link di opt-in del test chiuso su un tuo dispositivo Android reale e verifica che tutto funzioni (specialmente: inserimento transazioni, grafici, backup/ripristino, tema scuro).

## 8. Passaggio in produzione

Dopo aver testato in test chiuso per il periodo minimo richiesto da Google (attualmente Google richiede che le nuove app passino da un test chiuso con almeno 12 tester per 14 giorni prima di poter richiedere l'accesso alla produzione — verifica i requisiti aggiornati nella dashboard, possono cambiare):

1. Vai su "Panoramica" → dovresti vedere l'opzione "Prepara per la produzione" o "Promuovi release" una volta soddisfatti i requisiti.
2. Promuovi la release testata alla produzione.
3. Compila l'eventuale questionario finale di conformità.
4. Invia per la revisione finale di Google (tipicamente da poche ore a qualche giorno).

## 9. Dopo la pubblicazione

- Aggiorna `docs/STATO_PUBBLICAZIONE.md` con la data di pubblicazione e il link store.
- Per i futuri aggiornamenti: incrementa `versionCode`/`versionName` in `android/app/build.gradle`, ricompila con `JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew bundleRelease` dentro `android/`, verifica sempre la firma con openssl (comando sopra) prima di caricare, poi carica il nuovo AAB su un canale di test o direttamente in produzione a seconda del tipo di modifica.

## Aiuto

Se ti blocchi su un punto specifico (es. un messaggio d'errore della Play Console, un campo che non capisci), incollami lo screenshot o il testo dell'errore e ti aiuto a interpretarlo — quello che non posso fare è cliccare i pulsanti al posto tuo.
