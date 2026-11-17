import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Transaction } from '../models/transaction.model';
import { Budget } from '../models/budget.model';
import { Goal } from '../models/goal.model';
import { UserPreferences, DEFAULT_PREFERENCES } from '../models/user-preferences.model';
import { LoyaltyCard } from '../models/loyalty-card.model';
import { MOCK_TRANSACTIONS, MOCK_BUDGETS, MOCK_GOALS } from '../core/mock-data';
import { localChanges$ } from '../core/local-changes';

/** Dati personali sincronizzati con l'account (tabella personal_data). */
export interface PersonalSnapshot {
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  loyaltyCards: LoyaltyCard[];
}

const KEYS = {
  transactions: 'finanzai_transactions',
  budgets:      'finanzai_budgets',
  goals:        'finanzai_goals',
  preferences:  'finanzai_prefs',
  seeded:       'finanzai_seeded',
  demoActive:   'finanzai_demo_active',
  loyaltyCards: 'finanzai_loyalty_cards',
};

/** Chiavi che fanno parte dei dati personali sincronizzati. */
export const PERSONAL_KEYS = new Set([KEYS.transactions, KEYS.budgets, KEYS.goals, KEYS.loyaltyCards]);
export const PREFS_KEY = KEYS.preferences;

@Injectable({ providedIn: 'root' })
export class StorageService {
  private transactions$ = new BehaviorSubject<Transaction[]>([]);
  private budgets$      = new BehaviorSubject<Budget[]>([]);
  private goals$        = new BehaviorSubject<Goal[]>([]);
  private prefs$        = new BehaviorSubject<UserPreferences>(DEFAULT_PREFERENCES);
  private demoActive$   = new BehaviorSubject<boolean>(false);
  private loyaltyCards$ = new BehaviorSubject<LoyaltyCard[]>([]);

  get transactions()  { return this.transactions$.asObservable(); }
  get demoActive()    { return this.demoActive$.asObservable(); }
  get isDemoActive(): boolean { return this.demoActive$.value; }
  get budgets()       { return this.budgets$.asObservable(); }
  get goals()         { return this.goals$.asObservable(); }
  get preferences()   { return this.prefs$.asObservable(); }
  get loyaltyCards()  { return this.loyaltyCards$.asObservable(); }
  get loyaltyCardsSnapshot(): LoyaltyCard[] { return this.loyaltyCards$.value; }

  get transactionsSnapshot(): Transaction[] { return this.transactions$.value; }
  get budgetsSnapshot(): Budget[]           { return this.budgets$.value; }
  get goalsSnapshot(): Goal[]               { return this.goals$.value; }
  get prefsSnapshot(): UserPreferences      { return this.prefs$.value; }

  async init(): Promise<void> {
    const seeded = localStorage.getItem(KEYS.seeded);
    if (!seeded) {
      this.save(KEYS.transactions, MOCK_TRANSACTIONS);
      this.save(KEYS.budgets,      MOCK_BUDGETS);
      this.save(KEYS.goals,        MOCK_GOALS);
      localStorage.setItem(KEYS.seeded, '1');
      localStorage.setItem(KEYS.demoActive, '1');
    }
    this.transactions$.next(this.load<Transaction[]>(KEYS.transactions) ?? []);
    this.budgets$.next(this.load<Budget[]>(KEYS.budgets)               ?? []);
    this.goals$.next(this.load<Goal[]>(KEYS.goals)                     ?? []);
    // Le preferenze salvate da versioni precedenti non hanno i campi nuovi: si completano con i default.
    this.prefs$.next({ ...DEFAULT_PREFERENCES, ...(this.load<Partial<UserPreferences>>(KEYS.preferences) ?? {}) });
    this.loyaltyCards$.next(this.load<LoyaltyCard[]>(KEYS.loyaltyCards) ?? []);
    this.demoActive$.next(localStorage.getItem(KEYS.demoActive) === '1');
  }

  /** Rimuove i dati dimostrativi precaricati e lascia l'app pronta per l'uso reale. */
  clearDemoData(): void {
    this.save(KEYS.transactions, []);
    this.save(KEYS.budgets,      []);
    this.save(KEYS.goals,        []);
    this.transactions$.next([]);
    this.budgets$.next([]);
    this.goals$.next([]);
    localStorage.removeItem(KEYS.demoActive);
    this.demoActive$.next(false);
  }

  // ─── Transactions ──────────────────────────────────────────────────────────
  addTransaction(tx: Transaction): void {
    const list = [tx, ...this.transactions$.value];
    this.save(KEYS.transactions, list);
    this.transactions$.next(list);
  }

  updateTransaction(tx: Transaction): void {
    const list = this.transactions$.value.map(t => t.id === tx.id ? tx : t);
    this.save(KEYS.transactions, list);
    this.transactions$.next(list);
  }

  deleteTransaction(id: string): void {
    const list = this.transactions$.value.filter(t => t.id !== id);
    this.save(KEYS.transactions, list);
    this.transactions$.next(list);
  }

  // ─── Budgets ───────────────────────────────────────────────────────────────
  saveBudget(budget: Budget): void {
    const existing = this.budgets$.value.findIndex(b => b.id === budget.id);
    const list = existing >= 0
      ? this.budgets$.value.map(b => b.id === budget.id ? budget : b)
      : [...this.budgets$.value, budget];
    this.save(KEYS.budgets, list);
    this.budgets$.next(list);
  }

  deleteBudget(id: string): void {
    const list = this.budgets$.value.filter(b => b.id !== id);
    this.save(KEYS.budgets, list);
    this.budgets$.next(list);
  }

  // ─── Goals ─────────────────────────────────────────────────────────────────
  saveGoal(goal: Goal): void {
    const existing = this.goals$.value.findIndex(g => g.id === goal.id);
    const list = existing >= 0
      ? this.goals$.value.map(g => g.id === goal.id ? goal : g)
      : [...this.goals$.value, goal];
    this.save(KEYS.goals, list);
    this.goals$.next(list);
  }

  deleteGoal(id: string): void {
    const list = this.goals$.value.filter(g => g.id !== id);
    this.save(KEYS.goals, list);
    this.goals$.next(list);
  }

  // ─── Preferences ───────────────────────────────────────────────────────────
  savePreferences(prefs: UserPreferences): void {
    this.save(KEYS.preferences, prefs);
    this.prefs$.next(prefs);
  }

  // ─── Carte fedeltà personali (quelle condivise stanno nei wallet) ───────────
  saveLoyaltyCard(card: LoyaltyCard): void {
    const exists = this.loyaltyCards$.value.some(c => c.id === card.id);
    const list = exists
      ? this.loyaltyCards$.value.map(c => c.id === card.id ? card : c)
      : [...this.loyaltyCards$.value, card];
    this.save(KEYS.loyaltyCards, list);
    this.loyaltyCards$.next(list);
  }

  deleteLoyaltyCard(id: string): void {
    const list = this.loyaltyCards$.value.filter(c => c.id !== id);
    this.save(KEYS.loyaltyCards, list);
    this.loyaltyCards$.next(list);
  }

  // ─── Sincronizzazione account ──────────────────────────────────────────────
  collectPersonal(): PersonalSnapshot {
    return {
      transactions: this.transactions$.value,
      budgets:      this.budgets$.value,
      goals:        this.goals$.value,
      loyaltyCards: this.loyaltyCards$.value,
    };
  }

  /** Applica i dati arrivati dal server senza segnalarli come modifiche locali. */
  applyPersonal(d: PersonalSnapshot): void {
    this.save(KEYS.transactions, d.transactions, false);
    this.save(KEYS.budgets,      d.budgets, false);
    this.save(KEYS.goals,        d.goals, false);
    this.save(KEYS.loyaltyCards, d.loyaltyCards, false);
    this.transactions$.next(d.transactions);
    this.budgets$.next(d.budgets);
    this.goals$.next(d.goals);
    this.loyaltyCards$.next(d.loyaltyCards);
  }

  applyPreferences(prefs: Partial<UserPreferences>): void {
    const merged = { ...DEFAULT_PREFERENCES, ...this.prefs$.value, ...prefs };
    this.save(KEYS.preferences, merged, false);
    this.prefs$.next(merged);
  }

  // ─── Bulk restore (backup) ─────────────────────────────────────────────────
  restoreAll(data: {
    transactions: Transaction[];
    budgets: Budget[];
    goals: Goal[];
    preferences: UserPreferences;
  }): void {
    this.save(KEYS.transactions, data.transactions);
    this.save(KEYS.budgets,      data.budgets);
    this.save(KEYS.goals,        data.goals);
    this.save(KEYS.preferences,  data.preferences);
    this.transactions$.next(data.transactions);
    this.budgets$.next(data.budgets);
    this.goals$.next(data.goals);
    this.prefs$.next(data.preferences);
  }

  // ─── Internal ──────────────────────────────────────────────────────────────
  private save(key: string, value: unknown, notify = true): void {
    localStorage.setItem(key, JSON.stringify(value));
    if (notify) localChanges$.next(key);
  }

  private load<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  }
}
