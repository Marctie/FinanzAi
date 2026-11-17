// Verifica che tutti i pulsanti della barra in basso restino dentro il sito con la base /FinanzAi/ (GitHub Pages).
import assert from 'node:assert/strict';
import { connectBrowser, sleep } from './cdp.mjs';
const BASE = process.env.E2E_URL ?? 'http://localhost:8765/FinanzAi/';
const browser = await connectBrowser();
try {
  const p = await browser.newPage('tabs');
  await p.goto(BASE);
  await p.eval(`localStorage.setItem('finanzai_onboarded','1'); true`);
  await p.goto(BASE + 'tabs/dashboard');
  await p.waitFor(`!!document.querySelector('ion-tab-bar')`, 20000, 'barra');
  for (const tab of ['add-transaction', 'transactions', 'budgets', 'shared', 'settings', 'dashboard']) {
    await p.eval(`document.querySelector('ion-tab-button[tab="${tab}"]').click(); true`);
    await sleep(1200);
    const path = await p.eval('location.pathname');
    assert.equal(path, `/FinanzAi/tabs/${tab}`, `il pulsante ${tab} porta a ${path}`);
    console.log('ok', tab, '→', path);
  }
  assert.ok(await p.eval(`!!document.querySelector('app-add-transaction, ion-router-outlet')`));
  console.log('TUTTO OK');
} catch (e) { console.error('FALLITO:', e.message); process.exitCode = 1; } finally { browser.close(); }
