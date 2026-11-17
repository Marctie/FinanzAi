import { Injectable, NgZone } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserPreferences } from '../models/user-preferences.model';
import {
  PlannerInput, hash, localDayKey, notificationsForDay, parseTime, planNotifications, walletChangeMessage,
} from '../notifications/planner';
import { AuthService } from './auth.service';
import { TelemetryService } from './telemetry.service';
import { RemoteWalletChange } from './wallet.service';

const WEB_LAST_NOTIFIED_KEY = 'finanzai_web_last_reminder';
const PUSH_ENDPOINT_KEY = 'finanzai_push_endpoint';
const HORIZON_DAYS = 30;
const MAX_SCHEDULED = 60;

export const CHANNEL_REMINDERS = 'finanzai-reminders';
export const CHANNEL_WALLETS = 'finanzai-wallets';

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

/**
 * Notifiche.
 * - Android: notifiche locali pianificate (ricorrenze, budget, obiettivi) che arrivano anche ad app chiusa,
 *   più l'avviso delle spese/carte aggiunte da altri membri quando l'app è in secondo piano.
 * - Web/iPhone: push dal server (Supabase) anche ad app chiusa, se c'è un account e su iPhone l'app è nella
 *   schermata Home (iOS 16.4+). Senza push si mostra un riepilogo all'apertura.
 * - In app (tutte le piattaforme): avviso a comparsa quando un altro membro modifica un wallet.
 * Il permesso si chiede SOLO dal tocco dell'utente (iOS lo esige).
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  /** Stato reale del permesso di sistema (l'interruttore nelle impostazioni lo rispecchia). */
  readonly permission$ = new BehaviorSubject<PermissionState>('unsupported');

  private lastInput: { input: PlannerInput; prefs: UserPreferences } | null = null;
  private nativeQueue: Promise<void> = Promise.resolve();
  private channelsReady = false;

  constructor(
    private auth: AuthService,
    private telemetry: TelemetryService,
    private toast: ToastController,
    private router: Router,
    private zone: NgZone,
  ) {}

  get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  get isWebSupported(): boolean {
    return !this.isNative && typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  }

  get isPushSupported(): boolean {
    return this.isWebSupported && 'PushManager' in window && !!environment.vapidPublicKey
      && this.auth.enabled && !!this.auth.user;
  }

  get isPushActive(): boolean {
    try { return !!localStorage.getItem(PUSH_ENDPOINT_KEY); } catch { return false; }
  }

  /** iPhone/iPad in Safari senza l'app nella schermata Home: le notifiche non sono disponibili. */
  get needsHomeScreenInstall(): boolean {
    if (this.isNative || typeof navigator === 'undefined') return false;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = (navigator as any).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
    return isIos && !standalone;
  }

  /** Da chiamare all'avvio: canali Android, tocco sulle notifiche, stato del permesso. */
  async init(): Promise<void> {
    if (this.isNative) {
      await this.ensureChannels();
      LocalNotifications.addListener('localNotificationActionPerformed', a => {
        const route = (a.notification.extra as { route?: string } | undefined)?.route;
        if (route) this.zone.run(() => this.router.navigateByUrl(route));
      });
    }
    await this.refreshPermission();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.refreshPermission();
    });
  }

  async refreshPermission(): Promise<PermissionState> {
    let state: PermissionState = 'unsupported';
    try {
      if (this.isNative) {
        const { display } = await LocalNotifications.checkPermissions();
        state = display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
      } else if (this.isWebSupported && !this.needsHomeScreenInstall) {
        state = Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'prompt';
      }
    } catch { /* plugin non disponibile */ }
    this.permission$.next(state);
    return state;
  }

  /**
   * Chiede il permesso e attiva tutto. DEVE essere chiamata direttamente dal tocco dell'utente:
   * su iPhone la richiesta di sistema compare solo così.
   */
  async activate(): Promise<'granted' | 'denied' | 'needs-home-screen' | 'unsupported'> {
    if (this.needsHomeScreenInstall) return 'needs-home-screen';
    let granted = false;
    try {
      if (this.isNative) {
        const cur = await LocalNotifications.checkPermissions();
        granted = cur.display === 'granted' || (await LocalNotifications.requestPermissions()).display === 'granted';
      } else if (this.isWebSupported) {
        granted = Notification.permission === 'granted'
          || (Notification.permission !== 'denied' && (await Notification.requestPermission()) === 'granted');
      } else {
        return 'unsupported';
      }
    } catch (e) {
      console.error('Richiesta permesso notifiche non riuscita', e);
    }
    await this.refreshPermission();
    this.telemetry.track('notifiche_permesso', { esito: granted ? 'concesso' : 'negato' });
    if (!granted) return 'denied';
    if (this.isPushSupported) await this.enablePush();
    await this.refresh();
    return 'granted';
  }

  async refresh(): Promise<void> {
    if (this.lastInput) await this.reschedule(this.lastInput.input, this.lastInput.prefs);
  }

  /** Ripianifica a partire dai dati e dalle preferenze attuali (chiamata a ogni modifica, raggruppata). */
  reschedule(input: PlannerInput, prefs: UserPreferences): Promise<void> {
    this.lastInput = { input, prefs };
    if (!this.isNative) return this.checkWeb();
    const run = this.nativeQueue.then(() => this.rescheduleNative(input, prefs));
    this.nativeQueue = run.catch(e => console.error('Pianificazione notifiche non riuscita', e));
    return this.nativeQueue;
  }

  private async rescheduleNative(input: PlannerInput, prefs: UserPreferences): Promise<void> {
    const { display } = await LocalNotifications.checkPermissions();
    const pending = await LocalNotifications.getPending();
    const old = pending.notifications
      .filter(n => (n.extra as { kind?: string } | undefined)?.kind === 'reminder')
      .map(n => ({ id: Number(n.id) }));
    if (old.length) {
      try { await LocalNotifications.cancel({ notifications: old }); }
      catch (e) { console.warn('Cancellazione notifiche non riuscita', e); }
    }
    if (!prefs.notificationsEnabled || display !== 'granted') return;

    const now = new Date();
    const { hour, minute } = parseTime(prefs.notifyTime);
    const todayAt = new Date(now); todayAt.setHours(hour, minute, 0, 0);
    const planned = planNotifications(input, prefs, localDayKey(now), HORIZON_DAYS, todayAt <= now).slice(0, MAX_SCHEDULED);

    const notifications: LocalNotificationSchema[] = planned.map(n => {
      const [y, m, d] = n.day.split('-').map(Number);
      return {
        id: n.id, title: n.title, body: n.body, largeBody: n.body,
        schedule: { at: new Date(y, m - 1, d, hour, minute), allowWhileIdle: true },
        channelId: CHANNEL_REMINDERS,
        smallIcon: 'ic_stat_notify',
        extra: { kind: 'reminder', route: n.kind === 'budget' ? '/tabs/budgets' : n.kind === 'goal' ? '/tabs/goals' : '/tabs/transactions' },
        // Sempre false: con il default (true) il plugin v8, senza il permesso "Sveglie e promemoria",
        // apre le impostazioni di Android a ogni pianificazione e la chiamata resta bloccata.
        isExactNotification: false,
      };
    });
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  }

  /** Spese/carte aggiunte da un altro membro: avviso in app se visibile, notifica locale (Android) se in background. */
  async onRemoteWalletChange(c: RemoteWalletChange, prefs: UserPreferences): Promise<void> {
    const msg = walletChangeMessage({
      walletName: c.walletName, by: c.by, currency: prefs.defaultCurrency,
      added: c.added, changed: c.changed, cards: c.cards,
    }, prefs);
    if (!msg) return;
    const route = `/tabs/shared/wallet/${c.walletId}`;

    if (document.visibilityState === 'visible') {
      const t = await this.toast.create({
        header: msg.title, message: msg.body, duration: 5000, position: 'top', color: 'dark',
        buttons: [{ text: 'Apri', handler: () => { this.zone.run(() => this.router.navigateByUrl(route)); } }],
      });
      await t.present();
      return;
    }
    if (!prefs.notificationsEnabled) return;
    try {
      if (this.isNative) {
        if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
        await LocalNotifications.schedule({
          notifications: [{
            id: hash('wallet|' + Date.now()), title: msg.title, body: msg.body, largeBody: msg.body,
            channelId: CHANNEL_WALLETS, smallIcon: 'ic_stat_notify', extra: { kind: 'wallet', route },
            isExactNotification: false,
          }],
        });
      }
      // Sul web con push attive ci pensa il server (notify-expense); senza push si vede l'avviso alla riapertura.
    } catch (e) {
      console.error('Notifica wallet non riuscita', e);
    }
  }

  /** Web senza push: riepilogo una volta al giorno all'apertura, dopo l'orario scelto. */
  private async checkWeb(): Promise<void> {
    if (this.isNative || !this.lastInput) return;
    const { input, prefs } = this.lastInput;
    if (!prefs.notificationsEnabled || !this.isWebSupported || Notification.permission !== 'granted') return;
    if (this.isPushActive) return;
    const { hour, minute } = parseTime(prefs.notifyTime);
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() < hour * 60 + minute) return;
    const today = localDayKey(now);
    try { if (localStorage.getItem(WEB_LAST_NOTIFIED_KEY) === today) return; } catch { /* */ }
    const list = notificationsForDay(input, prefs, today);
    if (!list.length) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      for (const n of list.slice(0, 3)) {
        await reg.showNotification(n.title, { body: n.body, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png', tag: `daily-${today}-${n.id}` });
      }
      localStorage.setItem(WEB_LAST_NOTIFIED_KEY, today);
    } catch (e) {
      console.error('Notifica web non riuscita', e);
    }
  }

  // ── Push dal server (web) ────────────────────────────────────────────────

  async enablePush(): Promise<boolean> {
    if (!this.isPushSupported || Notification.permission !== 'granted') return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: this.base64UrlToBytes(environment.vapidPublicKey) });
      }
      const json = sub.toJSON();
      await this.auth.supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      const { error } = await this.auth.supabase.from('push_subscriptions').insert({
        endpoint: sub.endpoint, p256dh: json.keys?.['p256dh'], auth: json.keys?.['auth'],
      });
      if (error) throw error;
      localStorage.setItem(PUSH_ENDPOINT_KEY, sub.endpoint);
      this.telemetry.track('push_attivate');
      return true;
    } catch (e) {
      console.error('Iscrizione alle notifiche push non riuscita', e);
      return false;
    }
  }

  async disablePush(): Promise<void> {
    if (!this.isWebSupported) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        if (this.auth.user) await this.auth.supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
    } catch (e) {
      console.error('Disattivazione push non riuscita', e);
    } finally {
      try { localStorage.removeItem(PUSH_ENDPOINT_KEY); } catch { /* */ }
    }
  }

  /** Notifica di prova: sul web passa dal server (verifica tutta la catena), su Android è locale. */
  async sendTest(): Promise<string> {
    if (this.isNative) {
      if ((await this.activate()) !== 'granted') return 'Permesso notifiche negato';
      await LocalNotifications.schedule({
        notifications: [{
          id: hash('test|' + Date.now()), title: 'FinanzAI', body: 'Le notifiche funzionano 👍',
          channelId: CHANNEL_REMINDERS, smallIcon: 'ic_stat_notify', extra: { kind: 'test' },
          schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true }, isExactNotification: false,
        }],
      });
      this.telemetry.track('notifica_prova');
      return 'Notifica di prova tra qualche secondo';
    }
    if (this.isPushActive && this.auth.user) {
      const { data, error } = await this.auth.supabase.functions.invoke('push-test', { body: {} });
      this.telemetry.track('notifica_prova');
      if (error) return 'Invio non riuscito, riprova più tardi';
      return (data as { sent?: number })?.sent ? 'Notifica di prova inviata' : 'Nessun dispositivo iscritto: riattiva le notifiche';
    }
    if (this.isWebSupported && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('FinanzAI', { body: 'Le notifiche funzionano 👍', icon: 'assets/icons/icon-192.png' });
      return 'Notifica di prova mostrata';
    }
    return 'Attiva prima le notifiche';
  }

  private async ensureChannels(): Promise<void> {
    if (this.channelsReady) return;
    try {
      await LocalNotifications.createChannel({
        id: CHANNEL_REMINDERS, name: 'Promemoria', description: 'Pagamenti ricorrenti, budget e obiettivi',
        importance: 4, visibility: 1, vibration: true,
      });
      await LocalNotifications.createChannel({
        id: CHANNEL_WALLETS, name: 'Wallet condivisi', description: 'Spese e carte aggiunte dagli altri membri',
        importance: 4, visibility: 1, vibration: true,
      });
      this.channelsReady = true;
    } catch (e) {
      console.error('Creazione canali notifiche non riuscita', e);
    }
  }

  private base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
    const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded);
    const out = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
}
