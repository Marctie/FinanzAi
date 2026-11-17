// Valori PUBBLICI per definizione (URL del progetto e chiave "publishable", protetta dalle regole RLS).
// Le chiavi segrete (service_role, secret, VAPID privata) stanno solo in keystore-privato/ e nelle Edge Functions.
export const environment = {
  production: true,
  appVersion: '1.1.0',
  webUrl: 'https://marctie.github.io/FinanzAi/',
  supabase: {
    url: 'https://asjdvcdvbtiphizjjhzm.supabase.co',
    publishableKey: 'sb_publishable_T9Cp6GxucYMh4rYqAtbo1Q_IAlBl11C',
  },
  /** Chiave pubblica VAPID per le notifiche push web (la privata è un segreto delle Edge Functions). */
  vapidPublicKey: 'BPvv2qlSAGP4pbuxRrogO62fMEo5d10wkFhTumJJ2QMdW4Pci1Rz683ogotgMYypTGVG1ouXZ0FGI6WKjb2QRyI',
};
