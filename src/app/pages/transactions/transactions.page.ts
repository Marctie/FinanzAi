import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { AnalyticsService } from '../../services/analytics.service';
import { Transaction } from '../../models/transaction.model';
import { DEFAULT_CATEGORIES } from '../../core/categories.constants';
import { Category } from '../../models/category.model';

type FilterType = 'all' | 'income' | 'expense';

interface MonthOption { label: string; value: string; }

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  standalone: false,
})
export class TransactionsPage implements OnInit {
  allTransactions: Transaction[] = [];
  filtered:        Transaction[] = [];
  searchQuery     = '';
  activeFilter:   FilterType = 'all';
  activeMonth     = '';
  activeCategoryId = 'all';

  months: MonthOption[] = [];
  expenseCategories: Category[] = [];

  constructor(
    private storage:   StorageService,
    private analytics: AnalyticsService,
    private router:    Router,
  ) {}

  ngOnInit(): void {
    this.buildMonthOptions();
    this.expenseCategories = DEFAULT_CATEGORIES.filter(c => c.type === 'expense');

    this.storage.transactions.subscribe(txs => {
      this.allTransactions = [...txs].sort((a, b) => b.date.localeCompare(a.date));
      this.applyFilters();
    });
  }

  private buildMonthOptions(): void {
    const now = new Date();
    this.months = [{ label: 'Tutti', value: '' }];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      this.months.push({
        label: d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }),
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      });
    }
    this.activeMonth = this.months[1].value; // mese corrente
  }

  setFilter(filter: FilterType): void {
    this.activeFilter = filter;
    this.applyFilters();
  }

  setMonth(value: string): void {
    this.activeMonth = value;
    this.applyFilters();
  }

  setCategory(id: string): void {
    this.activeCategoryId = id;
    this.applyFilters();
  }

  onSearch(event: Event): void {
    this.searchQuery = (event as CustomEvent).detail.value?.toLowerCase() ?? '';
    this.applyFilters();
  }

  private applyFilters(): void {
    let result = this.allTransactions;

    if (this.activeMonth) {
      result = result.filter(t => t.date.startsWith(this.activeMonth));
    }
    if (this.activeFilter !== 'all') {
      result = result.filter(t => t.type === this.activeFilter);
    }
    if (this.activeCategoryId !== 'all') {
      result = result.filter(t => t.category === this.activeCategoryId);
    }
    if (this.searchQuery) {
      result = result.filter(t =>
        t.title.toLowerCase().includes(this.searchQuery) ||
        t.category.toLowerCase().includes(this.searchQuery)
      );
    }
    this.filtered = result;
  }

  trackById(_: number, tx: Transaction): string { return tx.id; }

  onEdit(id: string): void {
    this.router.navigate(['/tabs/add-transaction'], { queryParams: { id } });
  }

  onDeleted(id: string): void {
    this.storage.deleteTransaction(id);
  }

  formatCurrency(amount: number): string {
    return this.analytics.formatCurrency(amount);
  }

  get totalFiltered(): number {
    return this.filtered.reduce((s, t) =>
      t.type === 'expense' ? s - t.amount : s + t.amount, 0
    );
  }

  get totalIncome(): number {
    return this.filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  }

  get totalExpense(): number {
    return this.filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  }
}
