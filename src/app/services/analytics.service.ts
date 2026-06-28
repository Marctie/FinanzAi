import { Injectable } from '@angular/core';
import { Transaction } from '../models/transaction.model';

export interface MonthlyStats {
  income:  number;
  expense: number;
  balance: number;
  month:   string;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {

  totalIncome(transactions: Transaction[]): number {
    return transactions
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
  }

  totalExpense(transactions: Transaction[]): number {
    return transactions
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
  }

  balance(transactions: Transaction[]): number {
    return this.totalIncome(transactions) - this.totalExpense(transactions);
  }

  expenseByCategory(transactions: Transaction[]): Record<string, number> {
    return transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] ?? 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
  }

  incomeByCategory(transactions: Transaction[]): Record<string, number> {
    return transactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] ?? 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
  }

  filterByMonth(transactions: Transaction[], yearMonth: string): Transaction[] {
    return transactions.filter(t => t.date.startsWith(yearMonth));
  }

  filterByType(transactions: Transaction[], type: 'income' | 'expense'): Transaction[] {
    return transactions.filter(t => t.type === type);
  }

  getLast6MonthsStats(transactions: Transaction[]): MonthlyStats[] {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const month = d.toLocaleDateString('it-IT', { month: 'short' });
      const txs = this.filterByMonth(transactions, ym);
      const income  = this.totalIncome(txs);
      const expense = this.totalExpense(txs);
      return { income, expense, balance: income - expense, month };
    });
  }

  getCurrentMonthKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  formatCurrency(amount: number, currency = 'EUR'): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
