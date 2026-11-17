// Legge i segreti da keystore-privato/secrets.env (mai committato). Le variabili d'ambiente hanno la precedenza.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(ROOT, 'keystore-privato', 'secrets.env');
const vars = {};
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) vars[m[1]] = m[2].trim();
  }
}
export const env = name => process.env[name] ?? vars[name];
export const need = name => {
  const v = env(name);
  if (!v) { console.error(`Manca ${name} (keystore-privato/secrets.env)`); process.exit(1); }
  return v;
};

/** Esegue SQL sul progetto tramite la Management API. */
export async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${need('SUPABASE_PROJECT_REF')}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${need('SUPABASE_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : null;
}

export async function mgmt(method, path, body) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${need('SUPABASE_PROJECT_REF')}${path}`, {
    method,
    headers: { Authorization: `Bearer ${need('SUPABASE_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
