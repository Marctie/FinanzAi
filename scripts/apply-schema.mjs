// Applica supabase/schema.sql e la configurazione di Supabase Auth.
// Uso: node scripts/apply-schema.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, sql, mgmt } from './env.mjs';

await sql(readFileSync(join(ROOT, 'supabase', 'schema.sql'), 'utf8'));
console.log('OK   schema.sql applicato');

await mgmt('PATCH', '/config/auth', {
  site_url: 'https://marctie.github.io/FinanzAi/',
  uri_allow_list: 'https://marctie.github.io/FinanzAi/**,https://localhost/**,http://localhost:8100/**',
  mailer_autoconfirm: true,          // nessun SMTP: accesso immediato senza conferma email
  password_min_length: 8,
  external_email_enabled: true,
  disable_signup: false,
});
console.log('OK   configurazione Auth aggiornata');

const check = await sql(`
  select c.relname as tabella, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' order by 1`);
console.table(check);
