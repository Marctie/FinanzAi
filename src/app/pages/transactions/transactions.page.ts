import { Component, OnInit } from '@angular/core';
import { StorageService } from '../../services/storage.service';
import { AnalyticsService } from '../../services/analytics.service';
import { Transaction, TransactionType } from '../../models/transaction.model';

type FilterType = 'all' | 'income' | 'expense';

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  standalone: false,
})
export class TransactionsPage implements OnInit {
  allTransactions: Transaction[] = [];
  filtered:        Transaction[] = [];
  searchQuery  = '';
  activeFilter: FilterType = 'all';

  constructor(
    private storage:   StorageService,
    private analytics: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.storage.transactions.subscribe(txs => {
      this.allTransactions = [...txs].sort((a, b) => b.date.localeCompare(a.date));
      this.applyFilters();
    });
  }

  setFilter(filter: FilterType): void {
    this.activeFilter = filter;
    this.applyFilters();
  }

  onSearch(event: Event): void {
    this.searchQuery = (event as CustomEvent).detail.value?.toLowerCase() ?? '';
    this.applyFilters();
  }

  private applyFilters(): void {
    let result = this.allTransactions;

    if (this.activeFilter !== 'all') {
      result = result.filter(t => t.type === this.activeFilter);
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
}
