// Cancella gli utenti di test (@example.org) e tutto ciò che hanno lasciato: wallet rimasti senza membri,
// eventi di telemetria (anche quelli senza utente generati dai dispositivi dei test), tentativi di recupero.
// Uso: node tests/e2e/cleanup.mjs
import { env, sql } from '../../scripts/env.mjs';

const SUPA = env('SUPABASE_URL'), SECRET = env('SUPABASE_SECRET_KEY');
const h = { apikey: SECRET, Authorization: `Bearer ${SECRET}` };

const users = await sql(`select id, email from auth.users where email like '%@example.org'`);
const ids = users.map(u => u.id);
console.log(`utenti di test: ${users.length}`);

if (ids.length) {
  const list = ids.map(i => `'${i}'`).join(',');
  // Dispositivi usati dai test: tutti i loro eventi (anche quelli prima del login) vanno via.
  const devs = await sql(`select distinct device_id from public.app_events where user_id in (${list}) and device_id is not null`);
  const devList = devs.map(d => `'${String(d.device_id).replace(/'/g, "''")}'`).join(',') || "''";
  const walletsOf = await sql(`select distinct wallet_id from public.wallet_members where user_id in (${list})`);

  for (const u of users) {
    const r = await fetch(`${SUPA}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: h });
    if (!r.ok) console.error('eliminazione non riuscita', u.email, r.status, await r.text());
  }
  if (walletsOf.length) {
    const wl = walletsOf.map(w => `'${w.wallet_id}'`).join(',');
    await sql(`delete from public.wallets w where w.id in (${wl}) and not exists (select 1 from public.wallet_members m where m.wallet_id = w.id)`);
  }
  const ev = await sql(`with d as (delete from public.app_events where user_id in (${list}) or device_id in (${devList}) or device_id like 'e2e-%' returning 1) select count(*) n from d`);
  await sql(`delete from public.recovery_attempts where email like '%@example.org'`);
  console.log(`eliminati: ${users.length} utenti, ${walletsOf.length} wallet controllati, ${ev[0].n} eventi`);
}

const left = await sql(`select
  (select count(*) from auth.users where email like '%@example.org') as utenti_test,
  (select count(*) from public.wallets w where not exists (select 1 from public.wallet_members m where m.wallet_id = w.id)) as wallet_orfani,
  (select count(*) from public.app_events where device_id like 'e2e-%') as eventi_test`);
console.log('rimasti:', left[0]);
