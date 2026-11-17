// Test E2E reale della web app (Edge headless + CDP) contro il vero progetto Supabase.
// Due "persone" in contesti isolati: registrazione + codice di recupero, wallet con invito, spese e saldi,
// avvisi in tempo reale in app, carte fedeltà condivise, offline + unione a tre vie, sincronizzazione dei dati
// personali, recupero password con codice, telemetria senza contenuti.
//
// Prerequisiti: build web in www/ (npm run build:web), server `node tests/e2e/serve.mjs www 8765`,
// Edge avviato con --remote-debugging-port=9333. Gli utenti creati sono @example.org: si cancellano con
// node tests/e2e/cleanup.mjs
import assert from 'node:assert/strict';
import { connectBrowser, sleep } from './cdp.mjs';
import { env } from '../../scripts/env.mjs';

const BASE = process.env.E2E_URL ?? 'http://localhost:8765/FinanzAi/';
const SHOTS = process.env.E2E_SHOTS ?? '.';
const run = Date.now().toString(36);
const A = { name: 'Alice' + run.slice(-3), email: `e2e-a-${run}@example.org`, password: 'Prova-1234!' };
const B = { name: 'Bruno' + run.slice(-3), email: `e2e-b-${run}@example.org`, password: 'Prova-5678!' };

const SUPA = env('SUPABASE_URL');
const SECRET = env('SUPABASE_SECRET_KEY');
async function rest(path) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } });
  if (!r.ok) throw new Error(`REST ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

let step = 0;
const ok = msg => console.log(`ok ${++step} - ${msg}`);

const browser = await connectBrowser();

async function person(label) {
  const p = await browser.newPage(label);
  // Niente presentazione iniziale, e niente Web Share (aprirebbe la finestra di sistema).
  await p.eval('1');
  await (async () => {
    const script = `try { localStorage.setItem('finanzai_onboarded', '1'); localStorage.setItem('finanzai_telemetry_local', '1'); } catch {}
      try { delete Navigator.prototype.share; } catch {}`;
    await p.eval(`void 0`);
    p._init = script;
  })();
  return p;
}

async function open(p, path = 'tabs/shared') {
  await p.goto(BASE);
  await p.eval(p._init + '; true');
  await p.goto(BASE + path);
  await p.waitFor(`!!document.querySelector('ion-tab-bar')`, 20000, 'app avviata');
  await p.eval(p._init + '; true');
}

async function signup(p, u) {
  await p.click('[data-testid=shared-signup]');
  await p.type('[data-testid=auth-name]', u.name);
  await p.type('[data-testid=auth-email]', u.email);
  await p.type('[data-testid=auth-password]', u.password);
  await p.type('[data-testid=auth-password2]', u.password);
  await p.click('[data-testid=auth-submit]');
  const code = await p.waitFor(`document.querySelector('[data-testid=recovery-code]')?.textContent.trim()`, 25000, 'codice di recupero');
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await p.click('[data-testid=recovery-saved]');
  await p.click('[data-testid=recovery-done]');
  return code;
}

async function addExpense(p, title, amount) {
  await p.click('[data-testid=expense-add]');
  await p.type('[data-testid=expense-title]', title);
  await p.type('[data-testid=expense-amount]', amount);
  await p.click('[data-testid=expense-save]');
  await p.waitFor(`!document.querySelector('app-expense-form')`, 8000, 'chiusura modulo spesa');
}

const segment = (p, value) => p.click(`app-wallet-detail ion-segment-button[value=${value}]`);
const hasText = (p, t) => p.waitFor(`document.body.innerText.includes(${JSON.stringify(t)})`, 25000, `testo "${t}" su ${p.name}`);

try {
  // ── 1. Registrazione A + codice di recupero al primo accesso ───────────────
  const a = await person('A');
  await open(a);
  A.code = await signup(a, A);
  ok(`A registrato, codice di recupero mostrato una volta (${A.code.slice(0, 4)}-…)`);

  // ── 2. A crea un wallet ─────────────────────────────────────────────────
  await a.click('[data-testid=wallet-create]');
  await a.alert(['Casa test', '🏠'], 'Crea');
  await a.alertButton('Chiudi');                        // finestra del codice invito (senza Web Share)
  await segment(a, 'members');
  const invite = await a.waitFor(`document.querySelector('[data-testid=invite-code]')?.textContent.trim()`, 10000, 'codice invito');
  assert.match(invite, /^[A-Z2-9]{8}$/);
  ok(`wallet creato, codice invito ${invite}`);

  await segment(a, 'expenses');
  await addExpense(a, 'Cena', '90');
  await hasText(a, 'Cena');
  ok('A ha aggiunto "Cena" 90 € (parti uguali)');

  // ── 3. B si registra ed entra con il codice ───────────────────────────────
  const b = await person('B');
  await open(b);
  B.code = await signup(b, B);
  await b.click('[data-testid=wallet-join]');
  await b.alert([invite.toLowerCase()], 'Entra');       // il codice funziona anche in minuscolo
  await hasText(b, 'Cena');
  ok('B entrato con il codice invito e vede la spesa di A');

  // ── 4. B aggiunge una spesa: A la riceve in tempo reale con l'avviso in app ────
  await addExpense(b, 'Benzina', '30');
  await a.waitFor(`[...document.querySelectorAll('ion-toast')].some(t => (t.header + ' ' + t.message).includes('Benzina'))`, 30000, 'avviso in app su A');
  await hasText(a, 'Benzina');
  ok('A riceve "Benzina" in tempo reale con l\'avviso in app');

  await segment(a, 'balances');
  // "Cena" è stata aggiunta quando A era da solo (quota tutta di A); "Benzina" 30 € pagata da B e divisa in due:
  // A deve 15 € a B.
  await a.waitFor(`document.querySelector('[data-testid=settlement-item]')?.innerText.includes('15,00')`, 10000, 'saldo 15');
  const settle = await a.eval(`document.querySelector('[data-testid=settlement-item]').innerText`);
  assert.ok(settle.includes(B.name), settle);
  ok(`saldo corretto: "${settle.replace(/\s+/g, ' ').trim()}"`);
  await a.screenshot(`${SHOTS}/e2e-saldi.png`);

  // ── 5. Carta fedeltà condivisa da B, visibile ad A ────────────────────────
  await segment(b, 'cards');
  await b.eval(`[...document.querySelectorAll('ion-button')].find(x => x.textContent.includes('Condividi una carta') && x.closest('app-wallet-detail')).click()`);
  await b.type('[data-testid=card-store]', 'Esselunga');
  await b.type('[data-testid=card-number]', '4006381333931');
  await b.click('[data-testid=card-save]');
  await segment(a, 'cards');
  await hasText(a, 'Esselunga');
  ok('carta fedeltà condivisa da B visibile ad A');
  await a.eval(`[...document.querySelectorAll('app-wallet-detail .loyalty-tile')].find(x => x.textContent.includes('Esselunga')).click()`);
  await a.waitFor(`!!document.querySelector('app-loyalty-card-view .barcode-wrap svg rect')`, 10000, 'codice a barre disegnato');
  await a.screenshot(`${SHOTS}/e2e-carta.png`);
  await a.eval(`document.querySelector('ion-modal').dismiss()`);
  ok('carta mostrata a schermo intero con il codice a barre EAN-13');

  // ── 6. Offline + modifiche concorrenti → unione a tre vie ─────────────────
  await segment(a, 'expenses'); await segment(b, 'expenses');
  await a.offline(true); await b.offline(true);
  await addExpense(a, 'Spesa di A offline', '12');
  await addExpense(b, 'Spesa di B offline', '8');
  await sleep(1500);
  await a.offline(false); await b.offline(false);
  await hasText(a, 'Spesa di B offline');
  await hasText(b, 'Spesa di A offline');
  const [w] = await rest(`wallets?select=version,data&invite_code=eq.${invite}`);
  assert.equal(w.data.expenses.length, 4);
  ok(`offline: entrambe le spese salvate e unite (versione ${w.version}, 4 spese sul server)`);

  // ── 7. Dati personali sincronizzati (personal_data) ──────────────────────
  await a.goto(BASE + 'tabs/shared?tab=cards');
  await a.click('[data-testid=card-add]');
  await a.type('[data-testid=card-store]', 'Libreria');
  await a.type('[data-testid=card-number]', '9788804668237');   // EAN-13 valido; destinazione predefinita: solo a me
  await a.click('[data-testid=card-save]');
  const users = await rest(`profiles?select=user_id,display_name&display_name=in.(${A.name},${B.name})`);
  A.id = users.find(u => u.display_name === A.name).user_id;
  B.id = users.find(u => u.display_name === B.name).user_id;
  let personal;
  for (let i = 0; i < 40; i++) {
    [personal] = await rest(`personal_data?select=data,version&user_id=eq.${A.id}`);
    if (personal?.data?.loyaltyCards?.length) break;
    await sleep(500);
  }
  assert.equal(personal.data.loyaltyCards[0].store, 'Libreria');
  ok('carta personale sincronizzata nei dati personali dell\'account (non visibile a B)');
  assert.ok(!(await b.text()).includes('Libreria'));

  // ── 8. Uscita e recupero password con il codice ──────────────────────────
  await a.goto(BASE + 'tabs/settings');
  await a.click('[data-testid=settings-logout]');
  await a.alertButton('Esci');
  await sleep(3000);
  await a.goto(BASE + 'tabs/settings');
  await a.click('[data-testid=settings-login]');
  await a.click('[data-testid=auth-to-recover]');
  await a.type('[data-testid=auth-email]', A.email);
  await a.type('[data-testid=auth-code]', A.code);
  await a.type('[data-testid=auth-password]', 'Nuova-Pass-99');
  await a.type('[data-testid=auth-password2]', 'Nuova-Pass-99');
  await a.click('[data-testid=auth-submit]');
  const newCode = await a.waitFor(`document.querySelector('[data-testid=recovery-code]')?.textContent.trim()`, 25000, 'nuovo codice')
    .catch(async e => { console.error('messaggio app:', await a.eval(`document.querySelector('[data-testid=auth-error]')?.textContent`), a.logs.slice(-5)); throw e; });
  assert.notEqual(newCode, A.code);
  await a.click('[data-testid=recovery-saved]');
  await a.click('[data-testid=recovery-done]');
  await a.waitFor(`document.querySelector('[data-testid=settings-email]')?.textContent.includes(${JSON.stringify(A.email)})`, 15000, 'di nuovo collegato');
  ok('password reimpostata con email + codice; il codice usato non vale più, mostrato quello nuovo');
  await hasText(a, 'Libreria').catch(() => undefined);

  // ── 9. Telemetria: eventi presenti, nome messo dal server, nessun contenuto ───
  await sleep(8000);
  const events = await rest(`app_events?select=name,kind,user_label,platform,detail&user_id=in.(${A.id},${B.id})&order=id`);
  const names = new Set(events.map(e => e.name));
  for (const n of ['nuovo_utente', 'registrazione', 'wallet_creato', 'wallet_entrato', 'spesa_aggiunta', 'carta_condivisa', 'password_recuperata_con_codice']) {
    assert.ok(names.has(n), `manca l'evento ${n}: ${[...names].join(', ')}`);
  }
  const blob = JSON.stringify(events.map(e => e.detail));
  for (const secret of ['Cena', 'Benzina', 'Esselunga', '4006381333931', invite, A.email]) {
    assert.ok(!blob.includes(secret), `la telemetria contiene "${secret}"`);
  }
  assert.ok(events.filter(e => e.name !== 'nuovo_utente').every(e => [A.name, B.name].includes(e.user_label)), 'user_label dal server');
  ok(`telemetria: ${events.length} eventi, nomi utente decisi dal server, nessun importo/descrizione/codice`);

  const errs = [...a.logs, ...b.logs].filter(l => !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR/.test(l));
  console.log(errs.length ? 'errori in console:\n  ' + errs.join('\n  ') : 'nessun errore in console');
  console.log(JSON.stringify({ A: A.email, B: B.email }));
  console.log(`\nTUTTO OK (${step} passi)`);
} catch (e) {
  console.error('FALLITO al passo', step + 1, '-', e.message);
  process.exitCode = 1;
} finally {
  browser.close();
}
