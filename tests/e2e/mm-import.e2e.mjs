// Test E2E dell'importazione Money Manager nella web app (Edge headless + CDP), con un file .mmbackup locale.
// Uso: node tests/e2e/mm-import.e2e.mjs <percorso_file.mmbackup>   (il file non va mai nel repository)
import assert from 'node:assert/strict';
import { connectBrowser, sleep } from './cdp.mjs';

const BASE = process.env.E2E_URL ?? 'http://localhost:8765/FinanzAi/';
const file = process.argv[2];
const browser = await connectBrowser();
try {
  const p = await browser.newPage('import');
  await p.goto(BASE);
  await p.eval(`localStorage.setItem('finanzai_onboarded','1'); true`);
  await p.goto(BASE + 'tabs/settings');
  await p.waitFor(`!!document.querySelector('[data-testid=mm-file]')`, 20000, 'pagina impostazioni');
  const before = await p.eval(`JSON.parse(localStorage.getItem('finanzai_transactions') || '[]').length`);
  await p.setFile('[data-testid=mm-file]', file);
  await p.waitFor(`document.querySelectorAll('[data-testid=mm-category]').length > 0`, 30000, 'anteprima')
    .catch(async e => { console.error('console:', p.logs, 'avvisi:', await p.eval(`[...document.querySelectorAll('ion-toast')].map(t => t.message)`)); throw e; });
  const preview = await p.eval(`document.querySelector('app-mm-import .import-summary').innerText`);
  console.log('anteprima:', preview.split('\n')[0]);
  await p.click('[data-testid=mm-confirm]');
  await p.waitFor(`!document.querySelector('app-mm-import')`, 20000, 'chiusura anteprima');
  const after = await p.eval(`JSON.parse(localStorage.getItem('finanzai_transactions') || '[]').filter(t => t.id.startsWith('mm-')).length`);
  const cats = await p.eval(`JSON.parse(localStorage.getItem('finanzai_custom_categories') || '[]').filter(c => c.id.startsWith('custom-mm-')).length`);
  const budgets = await p.eval(`JSON.parse(localStorage.getItem('finanzai_budgets') || '[]').filter(b => b.id.startsWith('mm-')).length`);
  console.log(`importati: ${after} movimenti (prima ${before}), ${cats} categorie, ${budgets} budget`);
  assert.ok(after > 0);
  // Seconda importazione dello stesso file: nessun doppione
  await p.setFile('[data-testid=mm-file]', file);
  await p.waitFor(`document.querySelectorAll('[data-testid=mm-category]').length > 0`, 30000, 'anteprima 2');
  await p.click('[data-testid=mm-confirm]');
  await p.waitFor(`!document.querySelector('app-mm-import')`, 20000, 'chiusura 2');
  const again = await p.eval(`JSON.parse(localStorage.getItem('finanzai_transactions') || '[]').filter(t => t.id.startsWith('mm-')).length`);
  assert.equal(again, after);
  console.log('reimportazione: nessun doppione');
  await p.goto(BASE + 'tabs/transactions');
  await sleep(2000);
  console.log('errori console:', p.logs.length ? p.logs : 'nessuno');
  console.log('TUTTO OK');
} catch (e) {
  console.error('FALLITO:', e.message); process.exitCode = 1;
} finally { browser.close(); }
