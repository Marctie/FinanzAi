import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';

/**
 * Telemetria anonima-per-contenuto dell'app: QUALI interazioni avvengono (e con quale utente) e TUTTI gli errori,
 * per il bot Telegram "FinanzAIBot" dell'amministratore.
 *
 * - Non invia mai contenuti: niente importi, descrizioni, nomi di spese/negozi/carte, codici invito o email digitate.
 *   Solo il nome dell'azione e al massimo un conteggio o un codice tecnico.
 * - L'identificativo del dispositivo è un ID casuale per installazione (nessun ID hardware o pubblicitario).
 * - Coda locale in localStorage (chiave `telemetry_queue`, NON `finanzai_*`, che viene cancellata al logout):
 *   se si è offline o Supabase non risponde gli eventi restano lì e partono appena possibile.
 * - Sul server finiscono nella tabella `app_events` (solo inserimento, vedi supabase/telemetry.sql), da cui il bot
 *   li legge anche se era spento.
 * - Non blocca mai l'interfaccia: tutto è asincrono, fuori dalla zona Angular, e ogni errore interno è ignorato.
 */

export type TelemetryPlatform = 'android' | 'ios-app' | 'ios-safari' | 'web';
export type TelemetryDetail = Record<string, string | number | boolean>;

export const TELEMETRY_QUEUE_KEY = 'telemetry_queue';
export const TELEMETRY_DEVICE_KEY = 'telemetry_device';

/** Riga in coda (stesso formato della tabella, più qualche campo locale che inizia con _). */
export interface QueuedEvent {
  _lid: string;              // id locale
  _tries: number;            // tentativi falliti per autenticazione
  client_at: string;
  kind: 'event' | 'error';
  name: string;
  platform: TelemetryPlatform;
  app_version: string;
  user_id: string | null;
  /** Non più usato: il nome utente lo aggiunge il server (trigger su app_events). */
  user_hint?: string | null;
  device_id: string;
  detail: TelemetryDetail;
}

interface SessionInfo { userId: string; hint: string; token: string }

export const TELEMETRY_LIMITS = {
  maxQueue: 200,             // righe massime in coda locale
  batch: 50,                 // righe per richiesta
  mergeMs: 60_000,           // eventi uguali entro 1 minuto diventano uno solo con conteggio
  eventsPerMinute: 30,       // oltre, gli eventi vengono contati ma non accodati
  errorsPerMinute: 20,
  errorDedupMs: 60_000,      // errori identici entro 1 minuto: solo il conteggio aumenta
  eventDelayMs: 5_000,       // attesa prima dell'invio (raggruppa le azioni ravvicinate)
  errorDelayMs: 1_500,
  requestTimeoutMs: 8_000,
  retryEveryMs: 60_000,
};

const NAME_RE = /^[a-z0-9_]{1,60}$/;
/** Errori di sistema innocui o non nostri: non vengono inviati. */
const IGNORED_ERRORS = [
  /ResizeObserver loop/i, /^Script error\.?$/i, /NG0100/,
  /UNIMPLEMENTED not implemented/i,                 // Ionic chiede al plugin Keyboard funzioni assenti su Android: innocuo
  /wasm streaming compile failed|falling back to ArrayBuffer instantiation/i, // sql.js: avviso, poi funziona comunque
  /ChunkLoadError|Loading chunk [\w-]+ failed/i,    // nuova versione pubblicata: gestito con un ricaricamento automatico
];

/**
 * Build provate in locale (server di test su localhost) NON inviano nulla, per non riempire il bot di eventi ed errori
 * dei test. L'app Android usa anch'essa https://localhost ma è nativa, quindi invia normalmente.
 * Per i test della telemetria: localStorage.setItem('finanzai_telemetry_local', '1').
 */
function isLocalTestBuild(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return false;
    if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return false;
    return localStorage.getItem('finanzai_telemetry_local') !== '1';
  } catch {
    return false;
  }
}

/** Esegue fuori dalla zona Angular (niente change detection per i timer della telemetria). */
function outsideAngular<T>(fn: () => T): T {
  const z = (globalThis as any).Zone;
  return z?.root ? z.root.run(fn) : fn();
}

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  /** Funzione di rete (sostituibile nei test). */
  fetchImpl: (url: string, init: RequestInit) => Promise<Response> = (u, i) => fetch(u, i);

  private queue: QueuedEvent[] = [];
  private session: SessionInfo | null = null;
  /** True quando la pagina si sta chiudendo o ricaricando. */
  private unloading = false;
  private installed = false;
  private sendTimer: any = null;
  private retryTimer: any = null;
  private sending: Promise<void> | null = null;
  private backoffMs = 0;
  private backoffUntil = 0;
  private recentEvents: number[] = [];
  private recentErrors: number[] = [];
  private droppedEvents = 0;
  private errorSeen = new Map<string, number>();
  private reporting = false;
  private startPending = false;
  private hiddenSince = 0;
  private origConsoleError: (...args: unknown[]) => void = console.error.bind(console);
  private readonly deviceId: string;
  readonly platform: TelemetryPlatform;

  constructor() {
    this.platform = TelemetryService.detectPlatform();
    this.deviceId = this.loadDeviceId();
    this.queue = this.loadQueue();
  }

  // ── Avvio ──────────────────────────────────────────────────────────────────

  /** Attiva cattura errori globale, invio e reinvio. Idempotente; chiamato all'avvio dell'app. */
  install(): void {
    if (this.installed) return;
    this.installed = true;
    try {
      // Pagina in chiusura/ricaricamento (es. "Esci", app chiusa): le richieste in corso vengono interrotte
      // dal browser. Non sono errori dell'app (i dati vengono reinviati alla riapertura): non vanno segnalati.
      const markUnloading = () => { this.unloading = true; };
      window.addEventListener('pagehide', markUnloading);
      window.addEventListener('beforeunload', markUnloading);
      window.addEventListener('error', (ev: ErrorEvent) => {
        // Errori di caricamento risorse (img/script) arrivano senza ev.error.
        this.captureError(ev.error ?? ev.message ?? 'Errore sconosciuto', 'window');
      });
      window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
        this.captureError(ev.reason ?? 'Promise rifiutata', 'promessa');
      });
      // Tutti i console.error già presenti nel codice (sync, notifiche, backup, app...) diventano errori tracciati.
      const orig = this.origConsoleError;
      console.error = (...args: unknown[]) => {
        orig(...args);
        if (!this.reporting) this.captureConsole(args);
      };
      window.addEventListener('online', () => this.flushSoon(500));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.hiddenSince = Date.now();
          this.flush();           // l'app va in background: si prova a svuotare la coda subito
        } else {
          if (this.hiddenSince && Date.now() - this.hiddenSince > 30 * 60_000) this.track('app_ripresa');
          this.hiddenSince = 0;
          this.flushSoon(1000);
        }
      });
      window.addEventListener('pagehide', () => this.flush());
    } catch { /* ambiente senza window/document */ }

    // "app_aperta" aspetta di sapere chi è l'utente (setSession) per al massimo 4 secondi.
    this.startPending = true;
    outsideAngular(() => setTimeout(() => this.emitStart(), 4000));
    this.retryTimer = outsideAngular(() => setInterval(() => {
      if (this.queue.length) this.flush();
    }, TELEMETRY_LIMITS.retryEveryMs));
    this.flushSoon(2000);
  }

  /** Aggiornato da AuthService a ogni cambio di sessione (login, logout, rinnovo del token). */
  setSession(user: { id: string; email?: string | null } | null, accessToken: string | null): void {
    const before = this.session?.userId;
    this.session = user && accessToken
      ? { userId: user.id, hint: (user.email ?? '').split('@')[0].slice(0, 40), token: accessToken }
      : null;
    if (this.startPending) this.emitStart();
    if (this.session && this.session.userId !== before) this.flushSoon(1000);
  }

  get currentUserId(): string | null {
    return this.session?.userId ?? null;
  }

  // ── Eventi ─────────────────────────────────────────────────────────────────

  /**
   * Registra un'interazione. `detail` deve contenere solo valori tecnici (conteggi, codici): le stringhe
   * vengono comunque troncate a 40 caratteri e ripulite da email/token.
   */
  track(name: string, detail: TelemetryDetail = {}): void {
    try {
      if (!NAME_RE.test(name)) return;
      const now = Date.now();
      const userId = this.session?.userId ?? null;
      const add = typeof detail['count'] === 'number' ? Math.max(1, Math.floor(detail['count'] as number)) : 1;

      // Stesso evento appena accodato e non ancora partito: si aumenta solo il conteggio.
      const last = this.findMergeable('event', name, userId, now, detail);
      if (last) {
        last.detail['count'] = (Number(last.detail['count']) || 1) + add;
        this.saveQueue();
        this.flushSoon(TELEMETRY_LIMITS.eventDelayMs);
        return;
      }

      this.recentEvents = this.recentEvents.filter(t => now - t < 60_000);
      if (this.recentEvents.length >= TELEMETRY_LIMITS.eventsPerMinute) {
        this.droppedEvents += add;
        return;
      }
      this.recentEvents.push(now);
      const clean = this.sanitizeDetail(detail);
      if (add > 1 || clean['count'] !== undefined) clean['count'] = add;
      this.enqueue('event', name, clean);
      this.flushSoon(TELEMETRY_LIMITS.eventDelayMs);
    } catch { /* la telemetria non deve mai rompere l'app */ }
  }

  /** Registra un errore (qualsiasi tipo di valore). `source` = dove è stato catturato. */
  captureError(err: unknown, source = 'app', extra: TelemetryDetail = {}): void {
    try {
      const { message, stack } = TelemetryService.describeError(err);
      if (IGNORED_ERRORS.some(re => re.test(message))) return;
      if (this.unloading && /failed to fetch|networkerror|load failed|aborted/i.test(message)) return;
      const name = 'errore_' + source.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
      const msg = TelemetryService.scrub(message).slice(0, 300);
      const page = this.currentPage();
      const fp = name + '|' + msg.slice(0, 200) + '|' + page;
      const now = Date.now();

      const seen = this.errorSeen.get(fp);
      if (seen && now - seen < TELEMETRY_LIMITS.errorDedupMs) {
        const pending = this.queue.find(e => e.kind === 'error' && e.detail['fp'] === this.hash(fp));
        if (pending) {
          pending.detail['count'] = (Number(pending.detail['count']) || 1) + 1;
          this.saveQueue();
        }
        return;
      }
      this.recentErrors = this.recentErrors.filter(t => now - t < 60_000);
      if (this.recentErrors.length >= TELEMETRY_LIMITS.errorsPerMinute) return;
      this.recentErrors.push(now);
      this.errorSeen.set(fp, now);
      if (this.errorSeen.size > 200) this.errorSeen.clear();

      const detail: TelemetryDetail = {
        msg,
        page,
        fp: this.hash(fp),
        count: 1,
        ...this.sanitizeDetail(extra),
      };
      if (stack) detail['stack'] = TelemetryService.scrub(stack).slice(0, 1500);
      try { if (!navigator.onLine) detail['offline'] = true; } catch { /* */ }
      this.enqueue('error', name, detail);
      this.flushSoon(TELEMETRY_LIMITS.errorDelayMs);
    } catch { /* mai propagare */ }
  }

  /** Scrive in console senza che l'errore venga ricatturato (usato dall'ErrorHandler globale). */
  consoleErrorRaw(...args: unknown[]): void {
    this.reporting = true;
    try { this.origConsoleError(...args); } catch { /* console non disponibile */ } finally { this.reporting = false; }
  }

  // ── Invio ──────────────────────────────────────────────────────────────────

  /** Programma un invio entro `delayMs` (le chiamate ravvicinate vengono raggruppate). */
  flushSoon(delayMs: number): void {
    if (!this.installed) return;
    if (this.sendTimer) return;
    this.sendTimer = outsideAngular(() => setTimeout(() => {
      this.sendTimer = null;
      this.flush();
    }, delayMs));
  }

  /**
   * Invia la coda. Non lancia mai errori. Con `maxWaitMs` non aspetta oltre (es. logout: si invia quello che si
   * può, il resto resta in coda e parte al prossimo avvio).
   */
  flush(maxWaitMs?: number): Promise<void> {
    if (!this.installed) return Promise.resolve();
    if (!this.sending) {
      this.sending = this.sendAll().catch(() => undefined).finally(() => { this.sending = null; });
    }
    if (!maxWaitMs) return this.sending;
    return Promise.race([this.sending, new Promise<void>(r => outsideAngular(() => setTimeout(r, maxWaitMs)))]);
  }

  /** Copia della coda (per test e diagnostica). */
  pending(): QueuedEvent[] {
    return this.queue.map(e => ({ ...e, detail: { ...e.detail } }));
  }

  private async sendAll(): Promise<void> {
    if (isLocalTestBuild()) { this.queue = []; this.saveQueue(); return; }
    if (this.droppedEvents > 0) {
      const n = this.droppedEvents;
      this.droppedEvents = 0;
      this.enqueue('event', 'eventi_limitati', { count: n });
    }
    for (let round = 0; round < 10 && this.queue.length; round++) {
      try { if (!navigator.onLine) return; } catch { /* */ }
      if (Date.now() < this.backoffUntil) return;
      const batch = this.queue.slice(0, TELEMETRY_LIMITS.batch);
      const result = await this.post(batch);
      if (result === 'ok' || result === 'drop') {
        this.remove(batch);
        this.backoffMs = 0;
        this.backoffUntil = 0;
      } else if (result === 'invalid' && batch.length > 1) {
        // Una riga non valida non deve bloccare le altre: si riprova una alla volta.
        for (const one of batch) {
          const r = await this.post([one]);
          if (r === 'ok' || r === 'invalid' || r === 'drop') this.remove([one]);
          else { this.retryLater(); return; }
        }
      } else if (result === 'invalid') {
        this.remove(batch);
      } else if (result === 'forbidden') {
        // L'utente della riga non è quello della sessione (logout, cambio account): si inviano senza account.
        // Se erano già senza account il server le rifiuta comunque: si scartano per non bloccare la coda.
        if (batch.every(e => e.user_id === null)) this.remove(batch);
        else { batch.forEach(e => { e.user_id = null; }); this.saveQueue(); }
      } else if (result === 'auth') {
        // Token scaduto: si aspetta il rinnovo; dopo 3 tentativi si invia senza account.
        batch.forEach(e => { e._tries++; if (e._tries >= 3) e.user_id = null; });
        this.saveQueue();
        this.retryLater(30_000);
        return;
      } else {
        this.retryLater();
        return;
      }
    }
  }

  private async post(batch: QueuedEvent[]): Promise<'ok' | 'invalid' | 'forbidden' | 'auth' | 'retry' | 'drop'> {
    const sess = this.session;
    const useToken = !!sess && batch.some(e => e.user_id === sess.userId);
    const rows = batch.map(e => {
      const verified = !!sess && e.user_id === sess.userId;
      return {
        client_at: e.client_at,
        kind: e.kind,
        name: e.name,
        platform: e.platform,
        app_version: e.app_version,
        user_id: verified ? e.user_id : null,
        device_id: e.device_id,
        detail: e.detail,
      };
    });
    const body = JSON.stringify(rows);
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = outsideAngular(() => setTimeout(() => ctrl?.abort(), TELEMETRY_LIMITS.requestTimeoutMs));
    try {
      const res = await outsideAngular(() => this.fetchImpl(environment.supabase.url + '/rest/v1/app_events', {
        method: 'POST',
        headers: {
          apikey: environment.supabase.publishableKey,
          Authorization: 'Bearer ' + (useToken ? sess!.token : environment.supabase.publishableKey),
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body,
        // keepalive: la richiesta sopravvive alla chiusura della pagina (limite browser ~64 KB).
        keepalive: body.length < 60_000,
        signal: ctrl?.signal,
      }));
      if (res.ok) return 'ok';
      if (res.status === 401) return useToken ? 'auth' : 'forbidden';
      if (res.status === 403) return 'forbidden';
      if (res.status === 404) return 'drop';      // tabella non ancora creata: niente da fare
      if (res.status === 400 || res.status === 409 || res.status === 413 || res.status === 422) return 'invalid';
      return 'retry';                              // 429, 5xx
    } catch {
      return 'retry';                              // rete assente, timeout
    } finally {
      clearTimeout(timer);
    }
  }

  private retryLater(min = 5_000): void {
    this.backoffMs = Math.min(Math.max(min, this.backoffMs * 2 || min), 5 * 60_000);
    this.backoffUntil = Date.now() + this.backoffMs;
    this.flushSoon(this.backoffMs + 50);
  }

  // ── Coda locale ────────────────────────────────────────────────────────────

  private enqueue(kind: 'event' | 'error', name: string, detail: TelemetryDetail): void {
    this.queue.push({
      _lid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      _tries: 0,
      client_at: new Date().toISOString(),
      kind,
      name,
      platform: this.platform,
      app_version: (environment as { appVersion?: string }).appVersion ?? '',
      user_id: this.session?.userId ?? null,
      device_id: this.deviceId,
      detail,
    });
    this.trimQueue();
    this.saveQueue();
  }

  private findMergeable(kind: 'event', name: string, userId: string | null, now: number,
                        detail: TelemetryDetail): QueuedEvent | undefined {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const e = this.queue[i];
      if (e.kind !== kind || e.name !== name || e.user_id !== userId) continue;
      if (now - Date.parse(e.client_at) > TELEMETRY_LIMITS.mergeMs) return undefined;
      // Unione solo se i dettagli (a parte il conteggio) coincidono.
      const a = { ...e.detail }; delete a['count'];
      const b = this.sanitizeDetail(detail); delete b['count'];
      return JSON.stringify(a) === JSON.stringify(b) ? e : undefined;
    }
    return undefined;
  }

  /** Oltre il limite si buttano prima gli eventi più vecchi, poi (solo se servisse) gli errori più vecchi. */
  private trimQueue(): void {
    while (this.queue.length > TELEMETRY_LIMITS.maxQueue) {
      const i = this.queue.findIndex(e => e.kind === 'event');
      this.queue.splice(i >= 0 ? i : 0, 1);
    }
  }

  private remove(batch: QueuedEvent[]): void {
    const ids = new Set(batch.map(e => e._lid));
    this.queue = this.queue.filter(e => !ids.has(e._lid));
    this.saveQueue();
  }

  private loadQueue(): QueuedEvent[] {
    try {
      const raw = localStorage.getItem(TELEMETRY_QUEUE_KEY);
      const q = raw ? JSON.parse(raw) : [];
      return Array.isArray(q) ? q.filter(e => e && NAME_RE.test(e.name)).slice(-TELEMETRY_LIMITS.maxQueue) : [];
    } catch {
      return [];
    }
  }

  private saveQueue(): void {
    try {
      if (this.queue.length) localStorage.setItem(TELEMETRY_QUEUE_KEY, JSON.stringify(this.queue));
      else localStorage.removeItem(TELEMETRY_QUEUE_KEY);
    } catch { /* spazio pieno o storage bloccato: la coda resta in memoria */ }
  }

  private loadDeviceId(): string {
    try {
      let id = localStorage.getItem(TELEMETRY_DEVICE_KEY);
      if (!id || id.length > 40) {
        id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(TELEMETRY_DEVICE_KEY, id);
      }
      return id;
    } catch {
      return 'd-sconosciuto';
    }
  }

  // ── Supporto ───────────────────────────────────────────────────────────────

  private emitStart(): void {
    if (!this.startPending) return;
    this.startPending = false;
    let standalone = false;
    try { standalone = TelemetryService.isStandalone(); } catch { /* */ }
    this.track('app_aperta', { installata: standalone, os: TelemetryService.detectOs() });
  }

  private captureConsole(args: unknown[]): void {
    const err = args.find(a => a instanceof Error) as Error | undefined;
    const text = args
      .filter(a => !(a instanceof Error))
      .map(a => (typeof a === 'string' ? a : TelemetryService.describeError(a).message))
      .join(' ')
      .trim();
    if (err) {
      const e = new Error((text ? text + ': ' : '') + err.message);
      e.stack = err.stack;
      this.captureError(e, 'console');
    } else {
      this.captureError(text || 'console.error', 'console');
    }
  }

  /** Solo valori brevi e tecnici: niente oggetti, stringhe max 40 caratteri, max 8 chiavi. */
  private sanitizeDetail(d: TelemetryDetail): TelemetryDetail {
    const out: TelemetryDetail = {};
    let n = 0;
    for (const [k, v] of Object.entries(d ?? {})) {
      if (n >= 8 || !/^[a-z_]{1,20}$/i.test(k)) continue;
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
      else if (typeof v === 'boolean') out[k] = v;
      else if (typeof v === 'string') out[k] = TelemetryService.scrub(v).slice(0, 40);
      else continue;
      n++;
    }
    return out;
  }

  /** Pagina corrente senza parametri (che potrebbero contenere codici invito o token). */
  private currentPage(): string {
    try {
      const base = new URL(document.baseURI).pathname;
      let p = location.pathname;
      if (p.startsWith(base)) p = '/' + p.slice(base.length);
      return p.replace(/\/[0-9a-f-]{16,}/gi, '/:id').slice(0, 80) || '/';
    } catch {
      return '';
    }
  }

  private hash(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /** Toglie dati personali/segreti: email, token JWT, chiavi, parametri degli URL. */
  static scrub(s: string): string {
    return String(s)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
      .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
      .replace(/sb_(publishable|secret)_[\w-]+/g, '[chiave]')
      .replace(/(https?:\/\/[^\s?#"']+)[?#][^\s"']*/g, '$1?…')
      .replace(/(invito|code|token|password)=([^&\s"']+)/gi, '$1=…');
  }

  static describeError(err: unknown): { message: string; stack: string } {
    try {
      if (err instanceof Error) {
        const stack = (err.stack ?? '').split('\n').slice(0, 10).join('\n');
        return { message: `${err.name && err.name !== 'Error' ? err.name + ': ' : ''}${err.message}`, stack };
      }
      if (typeof err === 'string') return { message: err, stack: '' };
      if (err && typeof err === 'object') {
        const o = err as Record<string, unknown>;
        // Errori Supabase/PostgREST: { message, code, details }
        const msg = [o['code'], o['message'] ?? o['error_description'] ?? o['error']]
          .filter(x => typeof x === 'string' || typeof x === 'number').join(' ');
        if (msg) return { message: msg, stack: '' };
        try { return { message: JSON.stringify(err).slice(0, 300), stack: '' }; } catch { /* circolare */ }
      }
      return { message: String(err), stack: '' };
    } catch {
      return { message: 'Errore non descrivibile', stack: '' };
    }
  }

  static detectPlatform(): TelemetryPlatform {
    try {
      const p = Capacitor.getPlatform();
      if (p === 'android') return 'android';
      if (p === 'ios') return 'ios-app';
      if (TelemetryService.isIos()) return TelemetryService.isStandalone() ? 'ios-app' : 'ios-safari';
    } catch { /* */ }
    return 'web';
  }

  static isIos(): boolean {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  static isStandalone(): boolean {
    return (navigator as { standalone?: boolean }).standalone === true
      || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);
  }

  static detectOs(): string {
    try {
      const ua = navigator.userAgent || '';
      if (TelemetryService.isIos()) return /iPad/.test(ua) || navigator.platform === 'MacIntel' ? 'iPad' : 'iPhone';
      if (/Android/.test(ua)) return 'Android';
      if (/Windows/.test(ua)) return 'Windows';
      if (/Mac OS X/.test(ua)) return 'Mac';
      if (/Linux/.test(ua)) return 'Linux';
    } catch { /* */ }
    return 'altro';
  }

  /** Errore prima dell'avvio di Angular (main.ts): si prova a inviarlo subito, altrimenti resta in coda. */
  static reportBootstrapError(err: unknown): void {
    try {
      const t = new TelemetryService();
      t.installed = true;          // solo invio: nessun hook globale
      t.captureError(err, 'avvio');
      t.flush();
    } catch { /* */ }
  }
}
