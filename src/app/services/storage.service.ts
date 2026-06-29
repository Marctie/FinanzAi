import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Transaction } from '../models/transaction.model';
import { Budget } from '../models/budget.model';
import { Goal } from '../models/goal.model';
import { UserPreferences, DEFAULT_PREFERENCES } from '../models/user-preferences.model';
import { MOCK_TRANSACTIONS, MOCK_BUDGETS, MOCK_GOALS } from '../core/mock-data';

const KEYS = {
  transactions: 'finanzai_transactions',
  budgets:      'finanzai_budgets',
  goals:        'finanzai_goals',
  preferences:  'finanzai_prefs',
  seeded:       'finanzai_seeded',
};

@Injectable({ providedIn: 'root' })
export class StorageService {
  private transactions$ = new BehaviorSubject<Transaction[]>([]);
  private budgets$      = new BehaviorSubject<Budget[]>([]);
  private goals$        = new BehaviorSubject<Goal[]>([]);
  private prefs$        = new BehaviorSubject<UserPreferences>(DEFAULT_PREFERENCES);

  get transactions()  { return this.transactions$.asObservable(); }
  get budgets()       { return this.budgets$.asObservable(); }
  get goals()         { return this.goals$.asObservable(); }
  get preferences()   { return this.prefs$.asObservable(); }

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
    }
    this.transactions$.next(this.load<Transaction[]>(KEYS.transactions) ?? []);
    this.budgets$.next(this.load<Budget[]>(KEYS.budgets)               ?? []);
    this.goals$.next(this.load<Goal[]>(KEYS.goals)                     ?? []);
    this.prefs$.next(this.load<UserPreferences>(KEYS.preferences)      ?? DEFAULT_PREFERENCES);
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

  // ─── Internal ──────────────────────────────────────────────────────────────
  private save(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  private load<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  }
}
