// Test E2E reale dell'app Android (emulatore + DevTools della WebView via adb) contro il vero Supabase.
// Prerequisiti: emulatore avviato, APK di debug installato (la WebView è ispezionabile solo in debug).
// Uso: node tests/e2e/android.e2e.mjs <invite_code_wallet_esistente> <email_altro_membro> <password_altro_membro>
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { env } from '../../scripts/env.mjs';

const ADB = process.env.E2E_ADB ?? `${process.env.LOCALAPPDATA}\\Android\\Sdk\\platform-tools\\adb.exe`;
const PKG = 'com.finanzai.app';
const [invite, otherEmail, otherPassword] = process.argv.slice(2);
const SUPA = env('SUPABASE_URL'), KEY = env('SUPABASE_PUBLISHABLE_KEY');
const run = Date.now().toString(36);
const C = { name: 'Carla' + run.slice(-3), email: `e2e-c-${run}@example.org`, password: 'Prova-9012!' };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8' });
let step = 0;
const ok = m => console.log(`ok ${++step} - ${m}`);

/** Tocca un elemento dell'interfaccia di sistema (es. "Allow") trovato con uiautomator. */
function tapText(regex) {
  for (let i = 0; i < 10; i++) {
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
    const xml = adb('shell', 'cat', '/sdcard/ui.xml');
    for (const m of xml.matchAll(/<node [^>]*?text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)) {
      if (regex.test(m[1])) {
        adb('shell', 'input', 'tap', String((+m[2] + +m[4]) >> 1), String((+m[3] + +m[5]) >> 1));
        return m[1];
      }
    }
    execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},700)']);
  }
  throw new Error('Elemento di sistema non trovato: ' + regex);
}

/** Emulatore lento appena avviato: chiude l'eventuale finestra "System UI isn't responding". */
function dismissAnr() {
  try {
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
    const m = /text="Wait"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(adb('shell', 'cat', '/sdcard/ui.xml'));
    if (m) adb('shell', 'input', 'tap', String((+m[1] + +m[3]) >> 1), String((+m[2] + +m[4]) >> 1));
  } catch { /* nessuna finestra */ }
}

async function connectWebView() {
  for (let i = 0; i < 40; i++) {
    let pid = '';
    try { pid = adb('shell', 'pidof', PKG).trim(); } catch { /* app non ancora avviata */ }
    if (pid) {
      try {
        adb('forward', 'tcp:9223', `localabstract:webview_devtools_remote_${pid}`);
        const list = await (await fetch('http://127.0.0.1:9223/json')).json();
        const page = list.find(t => t.type === 'page' && t.url.startsWith('https://localhost'));
        if (page) {
          const ws = new WebSocket(page.webSocketDebuggerUrl);
          await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
          let id = 0; const pending = new Map();
          ws.onmessage = m => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
          const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
          const evalJs = async expr => {
            const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
            if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'errore');
            return r.result?.result?.value;
          };
          return { ws, evalJs };
        }
      } catch { /* WebView non ancora pronta */ }
    }
    await sleep(500);
  }
  throw new Error('WebView non raggiungibile');
}

let wv;
const evalJs = e => wv.evalJs(e);
const waitFor = async (expr, timeout = 25000, label = expr) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { const v = await evalJs(expr); if (v) return v; } catch { /* */ }
    await sleep(300);
  }
  throw new Error('timeout: ' + label);
};
const click = async sel => { await waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, 15000, sel); await evalJs(`document.querySelector(${JSON.stringify(sel)}).click()`); await sleep(500); };
const type = async (sel, v) => {
  await waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, 15000, sel);
  await evalJs(`(async () => { const h = document.querySelector(${JSON.stringify(sel)}); const i = h.querySelector('input') || await h.getInputElement();
    i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
};
const notifications = () => adb('shell', 'dumpsys', 'notification', '--noredact');

try {
  // ── Avvio pulito ─────────────────────────────────────────────────────────
  dismissAnr();
  adb('shell', 'pm', 'clear', PKG);
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  wv = await connectWebView();
  await waitFor(`!!document.querySelector('ion-app')`);
  await evalJs(`localStorage.setItem('finanzai_onboarded', '1'); location.href = '/tabs/shared'; true`);
  await sleep(3000);
  dismissAnr();
  wv.ws.close(); wv = await connectWebView();
  await waitFor(`!!document.querySelector('[data-testid=shared-signup]')`, 40000, 'pagina Condivisi');
  ok('app avviata sull\'emulatore, WebView collegata via DevTools');

  // ── Registrazione + codice di recupero ──────────────────────────────────
  await click('[data-testid=shared-signup]');
  await type('[data-testid=auth-name]', C.name);
  await type('[data-testid=auth-email]', C.email);
  await type('[data-testid=auth-password]', C.password);
  await type('[data-testid=auth-password2]', C.password);
  await click('[data-testid=auth-submit]');
  const code = await waitFor(`document.querySelector('[data-testid=recovery-code]')?.textContent.trim()`, 30000, 'codice');
  await click('[data-testid=recovery-saved]');
  await click('[data-testid=recovery-done]');
  ok(`registrazione su Android, codice di recupero ${code.slice(0, 4)}-…`);

  // ── Ingresso nel wallet creato sul web ──────────────────────────────────
  await click('[data-testid=wallet-join]');
  await waitFor(`!!document.querySelector('ion-alert .alert-input')`);
  await evalJs(`(() => { const i = document.querySelector('ion-alert .alert-input'); i.value = ${JSON.stringify(invite)}; i.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('ion-alert button')].find(b => b.textContent.trim() === 'Entra').click(); return true; })()`);
  await waitFor(`document.body.innerText.includes('Benzina')`, 30000, 'spese del wallet');
  ok('entrata nel wallet del web con il codice invito: spese sincronizzate');

  // ── Notifiche: interruttore spento finché non c'è il permesso, richiesta solo dal tocco ──
  await evalJs(`location.href = '/tabs/settings'; true`);
  await sleep(2500); wv.ws.close(); wv = await connectWebView();
  await waitFor(`!!document.querySelector('[data-testid=notify-enable]')`, 20000, 'pulsante Attiva notifiche');
  assert.equal(await evalJs(`document.querySelector('[data-testid=notify-toggle]').checked`), false);
  await click('[data-testid=notify-enable]');
  const allowed = tapText(/^(Allow|Consenti)$/i);
  await waitFor(`document.querySelector('[data-testid=notify-toggle]')?.checked === true`, 15000, 'interruttore acceso');
  ok(`permesso di sistema chiesto dopo il tocco ("${allowed}") e interruttore acceso solo a permesso concesso`);

  // ── Notifica di prova (isExactNotification: false → nessuna schermata di sistema bloccante) ──
  await click('[data-testid=notify-test]');
  await sleep(6000);
  assert.match(notifications(), /Le notifiche funzionano/);
  ok('notifica di prova mostrata da Android');

  // ── Promemoria pianificati: un movimento ricorrente mensile ─────────────
  const day = new Date(); day.setDate(day.getDate() - 30);
  const iso = day.toISOString().slice(0, 10);
  await evalJs(`(() => { const k = 'finanzai_transactions'; const l = JSON.parse(localStorage.getItem(k) || '[]');
    l.unshift({ id: 'e2e-ric', type: 'expense', amount: 650, currency: 'EUR', category: 'casa', date: '${iso}', title: 'Affitto', notes: '',
      isRecurring: true, recurringId: 'r-affitto', profileId: 'default' }); localStorage.setItem(k, JSON.stringify(l)); location.reload(); return true; })()`);
  await sleep(4000); wv.ws.close(); wv = await connectWebView();
  const pending = await waitFor(`Capacitor.Plugins.LocalNotifications.getPending().then(r => r.notifications.filter(n => n.extra?.kind === 'reminder').length || 0)`, 20000, 'promemoria pianificati');
  ok(`${pending} promemoria pianificati (pagamenti ricorrenti) con orario scelto`);

  // ── App in background: un altro membro aggiunge una spesa → notifica locale ──
  await evalJs(`location.href = '/tabs/shared'; true`);
  await sleep(2500);
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  await sleep(2000);
  const login = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: otherEmail, password: otherPassword }),
  })).json();
  const h = { apikey: KEY, Authorization: `Bearer ${login.access_token}`, 'Content-Type': 'application/json' };
  const [w] = await (await fetch(`${SUPA}/rest/v1/wallets?select=id,version,data&invite_code=eq.${invite}`, { headers: h })).json();
  const now = new Date().toISOString();
  const me = login.user.id;
  w.data.expenses.unshift({ id: 'e2e-bg-' + run, title: 'Supermercato', amount: 42, date: now.slice(0, 10), category: 'spesa', paidBy: me,
    splitMode: 'equal', shares: [{ userId: me, value: 0 }], createdBy: me, createdAt: now, updatedAt: now });
  const upd = await fetch(`${SUPA}/rest/v1/wallets?id=eq.${w.id}&version=eq.${w.version}`, {
    method: 'PATCH', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ data: w.data, version: w.version + 1 }),
  });
  assert.equal(upd.status, 200);
  let found = false;
  for (let i = 0; i < 30 && !found; i++) { await sleep(1000); found = /Supermercato/.test(notifications()); }
  assert.ok(found, 'notifica locale della spesa aggiunta da un altro membro');
  ok('app in background: notifica Android "ha aggiunto Supermercato" arrivata in tempo reale');

  console.log(JSON.stringify({ C: C.email }));
  console.log(`\nTUTTO OK (${step} passi)`);
} catch (e) {
  console.error('FALLITO al passo', step + 1, '-', e.message);
  process.exitCode = 1;
} finally {
  wv?.ws.close();
}
