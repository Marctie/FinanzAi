// Prepara un wallet di prova per il test Android: crea un utente @example.org, un wallet e una spesa "Benzina".
// Stampa: <codice_invito> <email> <password>  (da passare a android.e2e.mjs). Si cancella con cleanup.mjs.
import { env } from '../../scripts/env.mjs';

const SUPA = env('SUPABASE_URL'), KEY = env('SUPABASE_PUBLISHABLE_KEY');
const email = `e2e-seed-${Date.now().toString(36)}@example.org`, password = 'Prova-Seed-1!';
const json = { 'Content-Type': 'application/json' };

let r = await fetch(`${SUPA}/auth/v1/signup`, { method: 'POST', headers: { ...json, apikey: KEY }, body: JSON.stringify({ email, password }) });
const s = await r.json();
if (!s.access_token) throw new Error('registrazione: ' + JSON.stringify(s));
const h = { ...json, apikey: KEY, Authorization: `Bearer ${s.access_token}` };
const me = s.user.id;

await fetch(`${SUPA}/rest/v1/rpc/set_display_name`, { method: 'POST', headers: h, body: JSON.stringify({ p_name: 'Seed' }) });
r = await fetch(`${SUPA}/rest/v1/rpc/create_wallet`, { method: 'POST', headers: h, body: JSON.stringify({ p_name: 'Casa test', p_display_name: 'Seed' }) });
const [{ wallet_id, invite_code }] = await r.json();
const now = new Date().toISOString();
const data = { loyaltyCards: [], expenses: [{ id: 'seed-1', title: 'Benzina', amount: 30, date: now.slice(0, 10), category: 'trasporti',
  paidBy: me, splitMode: 'equal', shares: [{ userId: me, value: 0 }], createdBy: me, createdAt: now, updatedAt: now }] };
r = await fetch(`${SUPA}/rest/v1/wallets?id=eq.${wallet_id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ data, version: 1 }) });
if (!r.ok) throw new Error('salvataggio wallet: ' + r.status);
console.log(invite_code, email, password);
