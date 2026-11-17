// Mini client CDP (Node 22: WebSocket globale) per Edge/Chrome headless, con più contesti isolati
// (come due persone su due telefoni diversi).
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function connectBrowser(port = 9333) {
  let info;
  for (let i = 0; i < 60; i++) {
    try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; }
    catch { await sleep(250); }
  }
  if (!info) throw new Error('Browser non raggiungibile');
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();          // sessionId -> [fn]
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
    (listeners.get(d.sessionId) ?? []).forEach(fn => fn(d));
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, d => (d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result)));
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });

  /** Nuova "persona": contesto isolato (cookie e localStorage separati) con una scheda. */
  async function newPage(name) {
    const { browserContextId } = await send('Target.createBrowserContext', { disposeOnDetach: true });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const s = (method, params) => send(method, params, sessionId);
    const logs = [];
    listeners.set(sessionId, [d => {
      if (d.method === 'Runtime.exceptionThrown') logs.push('ECCEZIONE ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text));
      if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push('console.error ' + d.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }]);
    await s('Runtime.enable'); await s('Page.enable'); await s('Network.enable');
    await s('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

    const page = {
      name, logs,
      async goto(url) { await s('Page.navigate', { url }); await sleep(2500); },
      async eval(expr) {
        const r = await s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(`[${name}] ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
        return r.result.value;
      },
      /** Aspetta che l'espressione sia vera (o restituisca un valore). */
      async waitFor(expr, timeout = 20000, label = expr) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
          try { const v = await page.eval(expr); if (v) return v; } catch { /* non ancora */ }
          await sleep(250);
        }
        throw new Error(`[${name}] timeout: ${label}`);
      },
      async click(sel) {
        await page.waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, 15000, 'click ' + sel);
        await page.eval(`document.querySelector(${JSON.stringify(sel)}).click()`);
        await sleep(400);
      },
      /** Scrive in un ion-input (o input normale) e fa partire gli eventi che Angular ascolta. */
      async type(sel, value) {
        await page.waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, 15000, 'type ' + sel);
        await page.eval(`(async () => {
          const host = document.querySelector(${JSON.stringify(sel)});
          const inp = host.tagName === 'INPUT' ? host : (host.querySelector('input') || (await host.getInputElement?.()));
          inp.focus(); inp.value = ${JSON.stringify(String(value))};
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })()`);
        await sleep(150);
      },
      /** Compila gli input di un ion-alert e preme il pulsante con il testo indicato. */
      async alert(values, button) {
        await page.waitFor(`!!document.querySelector('ion-alert .alert-input')`, 10000, 'alert');
        await sleep(300);
        await page.eval(`(() => {
          const inputs = [...document.querySelectorAll('ion-alert .alert-input')];
          ${JSON.stringify(values)}.forEach((v, i) => { inputs[i].value = v; inputs[i].dispatchEvent(new Event('input', { bubbles: true })); });
          [...document.querySelectorAll('ion-alert button')].find(b => b.textContent.trim() === ${JSON.stringify(button)}).click();
          return true;
        })()`);
        await sleep(800);
      },
      async alertButton(button) {
        await page.waitFor(`[...document.querySelectorAll('ion-alert button')].some(b => b.textContent.trim() === ${JSON.stringify(button)})`, 10000, 'alert ' + button);
        await page.eval(`[...document.querySelectorAll('ion-alert button')].find(b => b.textContent.trim() === ${JSON.stringify(button)}).click()`);
        await sleep(800);
      },
      /** Imposta un file in un <input type=file> (come se l'utente lo scegliesse) e fa partire "change". */
      async setFile(sel, path) {
        const { root } = await s('DOM.getDocument', { depth: -1, pierce: true });
        const { nodeId } = await s('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
        await s('DOM.setFileInputFiles', { files: [path], nodeId });
        await sleep(300);
      },
      async offline(on) {
        await s('Network.emulateNetworkConditions', { offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
        await page.eval(`window.dispatchEvent(new Event(${JSON.stringify(on ? 'offline' : 'online')}))`);
      },
      async screenshot(file) {
        const r = await s('Page.captureScreenshot', { format: 'png' });
        (await import('node:fs')).writeFileSync(file, Buffer.from(r.data, 'base64'));
      },
      text: () => page.eval('document.body.innerText'),
    };
    return page;
  }
  return { newPage, close: () => ws.close() };
}
