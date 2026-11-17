// Pubblica le Edge Functions su Supabase (Management API), imposta i loro segreti e pianifica pg_cron.
// Uso: node scripts/deploy-functions.mjs      (segreti letti da keystore-privato/secrets.env)
//
// Prima del deploy copia src/app/notifications/planner.ts in supabase/functions/_shared/planner.ts e genera
// _shared/category-names.ts dalle categorie dell'app: app e server usano così la stessa identica logica.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, need, mgmt, sql } from './env.mjs';

const FUNCTIONS = ['notify-expense', 'push-test', 'daily-reminders', 'recover-password'];
const fnDir = join(ROOT, 'supabase', 'functions');

// 1. Planner condiviso + nomi delle categorie predefinite
const header = '// GENERATO da scripts/deploy-functions.mjs: non modificare qui.\n';
writeFileSync(join(fnDir, '_shared', 'planner.ts'),
  header + '// Sorgente: src/app/notifications/planner.ts\n' + readFileSync(join(ROOT, 'src/app/notifications/planner.ts'), 'utf8'));
const cats = readFileSync(join(ROOT, 'src/app/core/categories.constants.ts'), 'utf8');
const names = {};
for (const m of cats.matchAll(/id:\s*'([^']+)',\s*\n\s*name:\s*'([^']+)'/g)) names[m[1]] = m[2];
writeFileSync(join(fnDir, '_shared', 'category-names.ts'),
  header + '// Sorgente: src/app/core/categories.constants.ts\n'
  + `export const CATEGORY_NAMES: Record<string, string> = ${JSON.stringify(names, null, 2)};\n`);
console.log(`OK   planner copiato, ${Object.keys(names).length} categorie`);

// 2. Segreti delle funzioni (SUPABASE_URL e SERVICE_ROLE_KEY sono già forniti da Supabase)
await mgmt('POST', '/secrets', ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'CRON_SECRET']
  .map(name => ({ name, value: need(name) })));
console.log('OK   segreti impostati');

// 3. Deploy
const shared = readdirSync(join(fnDir, '_shared')).filter(f => f.endsWith('.ts'));
for (const name of FUNCTIONS) {
  const form = new FormData();
  form.append('metadata', JSON.stringify({ name, entrypoint_path: `${name}/index.ts`, verify_jwt: false }));
  const add = rel => form.append('file', new Blob([readFileSync(join(fnDir, rel))]), rel);
  add(`${name}/index.ts`);
  shared.forEach(f => add(`_shared/${f}`));
  const res = await fetch(`https://api.supabase.com/v1/projects/${need('SUPABASE_PROJECT_REF')}/functions/deploy?slug=${name}`,
    { method: 'POST', headers: { Authorization: `Bearer ${need('SUPABASE_ACCESS_TOKEN')}` }, body: form });
  const text = await res.text();
  console.log(`${res.ok ? 'OK  ' : 'ERRORE'} ${name} (${res.status}) ${res.ok ? '' : text.slice(0, 500)}`);
  if (!res.ok) process.exitCode = 1;
}

// 4. pg_cron (segreto nel Vault)
await sql(readFileSync(join(ROOT, 'supabase', 'cron.sql'), 'utf8')
  .replaceAll('__CRON_SECRET__', need('CRON_SECRET'))
  .replaceAll('__PROJECT_URL__', need('SUPABASE_URL')));
console.log('OK   pg_cron pianificato');
