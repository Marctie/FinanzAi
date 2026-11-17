import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription, debounceTime, filter, tap } from 'rxjs';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { CategoryService, CATEGORIES_KEY } from './category.service';
import { PERSONAL_KEYS, PREFS_KEY, StorageService } from './storage.service';
import { TelemetryService } from './telemetry.service';
import { WalletService } from './wallet.service';
import { DocSync } from './doc-sync';
import { localChanges$ } from '../core/local-changes';
import { Category } from '../models/category.model';

const OWNER_KEY = 'finanzai_sync_owner';
const BASE_KEY = 'finanzai_sync_base';
const DIRTY_KEY = 'finanzai_sync_dirty';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

type PersonalDoc = {
  transactions: { id: string }[];
  budgets: { id: string }[];
  goals: { id: string }[];
  loyaltyCards: { id: string }[];
  customCategories: { id: string }[];
};

/**
 * Sincronizzazione offline-first con Supabase.
 * - Dati personali (movimenti, budget, obiettivi, categorie, carte private) → personal_data.
 * - Wallet condivisi → wallets (tramite WalletService).
 * - Preferenze personali → user_settings (mai condivise).
 * Il localStorage resta la fonte di lavoro: le modifiche offline restano in coda e partono appena c'è rete;
 * i conflitti si risolvono con versione + unione a tre vie (DocSync). Supabase Realtime avvisa delle modifiche
 * fatte da altri dispositivi o membri.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  readonly status$ = new BehaviorSubject<SyncStatus>('idle');

  private userId: string | null = null;
  private personal: DocSync<PersonalDoc> | null = null;
  private subs: Subscription[] = [];
  private channel: RealtimeChannel | null = null;
  private running: Promise<void> | null = null;
  private again = false;

  constructor(
    private auth: AuthService,
    private storage: StorageService,
    private categories: CategoryService,
    private wallets: WalletService,
    private telemetry: TelemetryService,
  ) {}

  get pendingChanges(): boolean {
    try { return !!localStorage.getItem(DIRTY_KEY); } catch { return false; }
  }

  async start(userId: string): Promise<void> {
    if (this.userId === userId) return;
    this.userId = userId;

    const owner = localStorage.getItem(OWNER_KEY);
    if (owner && owner !== userId) {
      // Dati di un altro account rimasti sul dispositivo: non devono finire in questo account.
      this.auth.clearLocalData();
      this.storage.applyPersonal({ transactions: [], budgets: [], goals: [], loyaltyCards: [] });
      this.categories.applyRemote([]);
    }
    localStorage.setItem(OWNER_KEY, userId);
    // I dati di esempio non vanno mai caricati sull'account.
    if (this.storage.isDemoActive) this.storage.clearDemoData();

    this.personal = new DocSync<PersonalDoc>({
      client: () => this.auth.supabase,
      table: 'personal_data',
      idColumn: 'user_id',
      id: userId,
      keys: ['transactions', 'budgets', 'goals', 'loyaltyCards', 'customCategories'],
      baseKey: BASE_KEY,
      createIfMissing: true,
      collect: () => ({ ...this.storage.collectPersonal(), customCategories: this.categories.custom }) as PersonalDoc,
      apply: d => {
        this.storage.applyPersonal(d as any);
        this.categories.applyRemote(d.customCategories as Category[]);
      },
      onError: (e, fase) => this.telemetry.captureError(e, 'sync', { fase: 'personale_' + fase }),
    });

    if (navigator.onLine) await this.pullSettings().catch(e => this.telemetry.captureError(e, 'sync', { fase: 'preferenze' }));
    await this.wallets.start(userId).catch(e => this.telemetry.captureError(e, 'sync', { fase: 'wallet_avvio' }));
    await this.sync();
    this.subscribeRealtime(userId);

    this.subs.push(
      localChanges$.pipe(
        filter(k => PERSONAL_KEYS.has(k) || k === CATEGORIES_KEY),
        tap(() => localStorage.setItem(DIRTY_KEY, new Date().toISOString())),
        debounceTime(1200),
      ).subscribe(() => this.sync()),
      localChanges$.pipe(filter(k => k === PREFS_KEY), debounceTime(1500)).subscribe(() => this.pushSettings()),
    );
    window.addEventListener('online', this.onWake);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  stop(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    if (this.channel) { this.auth.supabase.removeChannel(this.channel); this.channel = null; }
    this.wallets.stop();
    this.personal = null;
    this.userId = null;
    window.removeEventListener('online', this.onWake);
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  /** Sincronizza tutto adesso (chiamate ravvicinate raggruppate). */
  sync(): Promise<void> {
    if (!this.userId || !this.personal) return Promise.resolve();
    if (this.running) { this.again = true; return this.running; }
    this.running = (async () => {
      do {
        this.again = false;
        if (!navigator.onLine) { this.status$.next('offline'); return; }
        this.status$.next('syncing');
        const r = await this.personal!.sync();
        await this.wallets.syncAll();
        if (r === 'ok') localStorage.removeItem(DIRTY_KEY);
        this.status$.next(r === 'ok' ? 'synced' : r === 'offline' ? 'offline' : 'error');
      } while (this.again);
    })().finally(() => { this.running = null; });
    return this.running;
  }

  // ── Preferenze personali ──────────────────────────────────────────────────

  private async pullSettings(): Promise<void> {
    const { data, error } = await this.auth.supabase.from('user_settings')
      .select('prefs').eq('user_id', this.userId!).maybeSingle<{ prefs: Record<string, unknown> }>();
    if (error) throw error;
    if (!data?.prefs || !Object.keys(data.prefs).length) { await this.pushSettings(); return; }
    this.storage.applyPreferences(data.prefs);
  }

  async pushSettings(): Promise<void> {
    if (!this.userId || !navigator.onLine) return;
    let timezone = 'Europe/Rome';
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone; } catch { /* default */ }
    const { error } = await this.auth.supabase.from('user_settings').upsert({
      user_id: this.userId, prefs: this.storage.prefsSnapshot, timezone, updated_at: new Date().toISOString(),
    });
    if (error) this.telemetry.captureError(error, 'sync', { fase: 'preferenze_salvataggio' });
  }

  // ── Tempo reale ───────────────────────────────────────────────────────────

  private subscribeRealtime(userId: string): void {
    this.channel = this.auth.supabase.channel(`finanzai-${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'personal_data', filter: `user_id=eq.${userId}` },
        p => { if ((p.new as any)?.version !== this.personal?.baseVersion) this.sync(); })
      // Le RLS fanno arrivare solo i wallet di cui si è membri.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets' }, p => {
        const id = (p.new as any)?.id as string | undefined;
        if (id && (p.new as any)?.version !== this.wallets.knownVersion(id)) this.wallets.syncWallet(id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_members' }, () => this.wallets.refreshList())
      .subscribe();
  }

  private onWake = () => this.sync();

  private onVisible = () => {
    if (document.visibilityState === 'visible') {
      this.sync();
      this.wallets.refreshList();
    }
  };
}
