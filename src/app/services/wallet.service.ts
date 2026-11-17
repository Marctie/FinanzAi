import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { TelemetryService } from './telemetry.service';
import { DocSync } from './doc-sync';
import { diffList } from '../core/merge.util';
import { computeBalances, simplifyDebts } from '../core/balances.util';
import {
  EMPTY_WALLET_DATA, MemberBalance, Settlement, SharedExpense, Wallet, WalletData, WalletMember,
} from '../models/wallet.model';
import { LoyaltyCard } from '../models/loyalty-card.model';

const CACHE_KEY = 'finanzai_wallets';                 // elenco wallet + contenuto (funziona offline)
const BASE_PREFIX = 'finanzai_walletbase_';

/** Cambiamenti fatti da un altro membro (per l'avviso in app e la notifica locale Android). */
export interface RemoteWalletChange {
  walletId: string;
  walletName: string;
  by: string;
  added: SharedExpense[];
  changed: SharedExpense[];
  cards: LoyaltyCard[];
}

interface WalletRow {
  wallet_id: string;
  role: 'owner' | 'member';
  wallets: { id: string; name: string; emoji: string; currency: string; invite_code: string };
}

/**
 * Wallet condivisi: spese di gruppo (chi ha pagato, suddivisione, saldi) e carte fedeltà condivise.
 * Ogni wallet è un documento sincronizzato con DocSync; l'elenco resta in cache per l'uso offline.
 */
@Injectable({ providedIn: 'root' })
export class WalletService {
  readonly wallets$ = new BehaviorSubject<Wallet[]>(this.loadCache());
  readonly remoteChange$ = new Subject<RemoteWalletChange>();

  private syncs = new Map<string, DocSync<WalletData & Record<string, { id: string }[]>>>();
  private userId: string | null = null;

  constructor(private auth: AuthService, private telemetry: TelemetryService) {}

  get snapshot(): Wallet[] { return this.wallets$.value; }

  byId(id: string): Wallet | undefined {
    return this.snapshot.find(w => w.id === id);
  }

  // ── Avvio / arresto (chiamati da SyncService) ─────────────────────────────

  async start(userId: string): Promise<void> {
    this.userId = userId;
    await this.refreshList();
  }

  stop(): void {
    this.userId = null;
    this.syncs.clear();
  }

  /** Ricarica l'elenco dei wallet e dei membri dal server, poi sincronizza ogni wallet. */
  async refreshList(): Promise<void> {
    if (!this.userId || !navigator.onLine) return;
    const db = this.auth.supabase;
    const { data, error } = await db.from('wallet_members')
      .select('wallet_id, role, wallets(id, name, emoji, currency, invite_code)')
      .eq('user_id', this.userId);
    if (error || !data) { if (error) this.telemetry.captureError(error, 'sync', { fase: 'elenco_wallet' }); return; }

    const ids = (data as unknown as WalletRow[]).map(r => r.wallet_id);
    const { data: members } = ids.length
      ? await db.from('wallet_members').select('wallet_id, user_id, display_name, role, joined_at')
          .in('wallet_id', ids).order('joined_at')
      : { data: [] as any[] };

    const old = new Map(this.snapshot.map(w => [w.id, w]));
    const list: Wallet[] = (data as unknown as WalletRow[]).filter(r => r.wallets).map(r => ({
      id: r.wallet_id,
      name: r.wallets.name,
      emoji: r.wallets.emoji,
      currency: r.wallets.currency,
      inviteCode: r.wallets.invite_code,
      role: r.role,
      members: (members ?? []).filter((m: any) => m.wallet_id === r.wallet_id).map((m: any): WalletMember => ({
        userId: m.user_id, displayName: m.display_name || 'Utente', role: m.role, isMe: m.user_id === this.userId,
      })),
      data: old.get(r.wallet_id)?.data ?? { ...EMPTY_WALLET_DATA },
    }));
    // Wallet da cui si è usciti o si è stati rimossi: si dimentica la base.
    for (const id of old.keys()) if (!ids.includes(id)) { this.syncs.get(id)?.forget(); this.syncs.delete(id); }
    this.setWallets(list);
    await Promise.all(list.map(w => this.syncWallet(w.id)));
  }

  async syncAll(): Promise<void> {
    await Promise.all(this.snapshot.map(w => this.syncWallet(w.id)));
  }

  syncWallet(id: string): Promise<unknown> {
    if (!this.userId) return Promise.resolve();
    let s = this.syncs.get(id);
    if (!s) {
      s = new DocSync({
        client: () => this.auth.supabase,
        table: 'wallets',
        idColumn: 'id',
        id,
        keys: ['expenses', 'loyaltyCards'],
        baseKey: BASE_PREFIX + id,
        createIfMissing: false,
        collect: () => (this.byId(id)?.data ?? EMPTY_WALLET_DATA) as any,
        apply: d => this.patch(id, { data: d as WalletData }),
        onSaved: (before, after) => this.notifyOthers(id, before as WalletData, after as WalletData),
        onRemoteChange: (base, remote, by) => this.emitRemote(id, base as WalletData, remote as WalletData, by),
        onError: (e, fase) => this.telemetry.captureError(e, 'sync', { fase: 'wallet_' + fase }),
      });
      this.syncs.set(id, s);
    }
    return s.sync().then(r => { if (r === 'gone') return this.refreshList(); return undefined; });
  }

  /** Versione sincronizzata nota (per ignorare gli eventi realtime dei propri salvataggi). */
  knownVersion(id: string): number | null {
    return this.syncs.get(id)?.baseVersion ?? null;
  }

  // ── Gestione wallet ───────────────────────────────────────────────────────

  async create(name: string, currency: string, emoji: string): Promise<string> {
    const { data, error } = await this.auth.supabase.rpc('create_wallet', {
      p_name: name, p_currency: currency, p_emoji: emoji, p_display_name: this.auth.displayName,
    });
    if (error || !data?.[0]) {
      throw new Error(error?.message.includes('too_many_wallets') ? 'Hai raggiunto il massimo di 20 wallet' : 'Creazione non riuscita, riprova');
    }
    this.telemetry.track('wallet_creato');
    await this.refreshList();
    return data[0].wallet_id as string;
  }

  async join(code: string): Promise<string> {
    const { data, error } = await this.auth.supabase.rpc('join_wallet', { p_code: code, p_display_name: this.auth.displayName });
    if (error) {
      throw new Error(error.message.includes('invalid_invite_code') ? 'Codice invito non valido'
        : error.message.includes('wallet_full') ? 'Il wallet ha già il numero massimo di membri'
        : 'Non è stato possibile entrare nel wallet, riprova');
    }
    this.telemetry.track('wallet_entrato');
    await this.refreshList();
    return data as string;
  }

  async leave(id: string): Promise<void> {
    const { error } = await this.auth.supabase.rpc('leave_wallet', { p_wallet_id: id });
    if (error) throw new Error('Non è stato possibile uscire dal wallet');
    this.telemetry.track('wallet_uscito');
    this.syncs.get(id)?.forget();
    this.syncs.delete(id);
    this.setWallets(this.snapshot.filter(w => w.id !== id));
  }

  async regenerateInvite(id: string): Promise<void> {
    const { data, error } = await this.auth.supabase.rpc('regenerate_invite_code', { p_wallet_id: id });
    if (error) throw new Error('Solo chi ha creato il wallet può cambiare il codice');
    this.telemetry.track('invito_rigenerato');
    this.patch(id, { inviteCode: data as string });
  }

  async removeMember(id: string, userId: string): Promise<void> {
    const { error } = await this.auth.supabase.rpc('remove_wallet_member', { p_wallet_id: id, p_user_id: userId });
    if (error) throw new Error('Non è stato possibile rimuovere il membro');
    this.telemetry.track('wallet_membro_rimosso');
    await this.refreshList();
  }

  async rename(id: string, name: string, emoji: string): Promise<void> {
    const { error } = await this.auth.supabase.from('wallets').update({ name: name.trim().slice(0, 60), emoji }).eq('id', id);
    if (error) throw new Error('Non è stato possibile rinominare il wallet');
    this.patch(id, { name: name.trim().slice(0, 60), emoji });
  }

  // ── Spese ─────────────────────────────────────────────────────────────────

  saveExpense(walletId: string, e: SharedExpense): void {
    const w = this.byId(walletId);
    if (!w) return;
    const exists = w.data.expenses.some(x => x.id === e.id);
    const expenses = exists ? w.data.expenses.map(x => x.id === e.id ? e : x) : [e, ...w.data.expenses];
    this.patch(walletId, { data: { ...w.data, expenses } });
    this.telemetry.track(e.isSettlement ? 'rimborso_registrato' : exists ? 'spesa_modificata' : 'spesa_aggiunta');
    this.syncWallet(walletId);
  }

  deleteExpense(walletId: string, expenseId: string): void {
    const w = this.byId(walletId);
    if (!w) return;
    this.patch(walletId, { data: { ...w.data, expenses: w.data.expenses.filter(x => x.id !== expenseId) } });
    this.telemetry.track('spesa_eliminata');
    this.syncWallet(walletId);
  }

  balances(walletId: string): { balances: MemberBalance[]; settlements: Settlement[] } {
    const w = this.byId(walletId);
    if (!w) return { balances: [], settlements: [] };
    const balances = computeBalances(w.data.expenses, w.members.map(m => m.userId));
    return { balances, settlements: simplifyDebts(balances) };
  }

  // ── Carte fedeltà condivise ───────────────────────────────────────────────

  saveCard(walletId: string, card: LoyaltyCard): void {
    const w = this.byId(walletId);
    if (!w) return;
    const exists = w.data.loyaltyCards.some(c => c.id === card.id);
    const loyaltyCards = exists ? w.data.loyaltyCards.map(c => c.id === card.id ? card : c) : [...w.data.loyaltyCards, card];
    this.patch(walletId, { data: { ...w.data, loyaltyCards } });
    this.telemetry.track(exists ? 'carta_modificata' : 'carta_condivisa');
    this.syncWallet(walletId);
  }

  deleteCard(walletId: string, cardId: string): void {
    const w = this.byId(walletId);
    if (!w) return;
    this.patch(walletId, { data: { ...w.data, loyaltyCards: w.data.loyaltyCards.filter(c => c.id !== cardId) } });
    this.telemetry.track('carta_eliminata');
    this.syncWallet(walletId);
  }

  memberName(walletId: string, userId: string | null): string {
    if (!userId) return 'Qualcuno';
    return this.byId(walletId)?.members.find(m => m.userId === userId)?.displayName || 'Qualcuno';
  }

  // ── Interni ───────────────────────────────────────────────────────────────

  /** Avvisa gli altri membri (push dal server) di spese aggiunte/modificate e carte condivise. */
  private notifyOthers(walletId: string, before: WalletData, after: WalletData): void {
    const w = this.byId(walletId);
    if (!w || w.members.length < 2) return;
    const exp = diffList(before.expenses, after.expenses);
    const cards = diffList(before.loyaltyCards, after.loyaltyCards).added;
    const added = exp.added.filter(e => e.createdBy === this.userId).map(e => e.id);
    const changed = exp.changed.map(e => e.id);
    const cardIds = cards.map(c => c.id);
    if (!added.length && !changed.length && !cardIds.length) return;
    this.auth.supabase.functions.invoke('notify-expense', {
      body: { walletId, added: added.slice(0, 20), changed: changed.slice(0, 20), cards: cardIds.slice(0, 20) },
    }).catch(() => undefined);
  }

  private emitRemote(walletId: string, base: WalletData, remote: WalletData, by: string | null): void {
    if (!by || by === this.userId) return;
    const exp = diffList(base.expenses, remote.expenses);
    const cards = diffList(base.loyaltyCards, remote.loyaltyCards).added;
    if (!exp.added.length && !exp.changed.length && !cards.length) return;
    this.remoteChange$.next({
      walletId, walletName: this.byId(walletId)?.name ?? 'Wallet', by: this.memberName(walletId, by),
      added: exp.added, changed: exp.changed, cards,
    });
  }

  private patch(id: string, p: Partial<Wallet>): void {
    this.setWallets(this.snapshot.map(w => w.id === id ? { ...w, ...p } : w));
  }

  private setWallets(list: Wallet[]): void {
    this.wallets$.next(list);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* */ }
  }

  private loadCache(): Wallet[] {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]'); } catch { return []; }
  }
}
