# FinanzAI

App di finanza personale (Angular 20 + Ionic 8 + Capacitor 8) disponibile come app Android (Play Store, `com.finanzai.app`) e come web app installabile su iPhone tramite GitHub Pages.

## Stato
| Fase | Contenuto | Stato |
|---|---|---|
| 0 | Pulizia repo e cronologia, cartella segreti | ✅ |
| 1 | PWA per iPhone + deploy GitHub Pages | in corso |
| 2 | Supabase: account, schema, RLS, recupero password con codice | da fare |
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
