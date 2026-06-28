import { Component, OnInit } from '@angular/core';
import { StorageService } from '../../services/storage.service';
import { AnalyticsService } from '../../services/analytics.service';
import { Budget } from '../../models/budget.model';
import { Transaction } from '../../models/transaction.model';

interface BudgetWithSpent extends Budget {
  spent: number;
}

@Component({
  selector: 'app-budgets',
  templateUrl: './budgets.page.html',
  styleUrls: ['./budgets.page.scss'],
  standalone: false,
})
export class BudgetsPage implements OnInit {
  budgetsWithSpent: BudgetWithSpent[] = [];
  transactions: Transaction[] = [];

  totalBudgeted = 0;
  totalSpent    = 0;

  constructor(
    private storage:   StorageService,
    private analytics: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.storage.budgets.subscribe(() => this.refresh());
    this.storage.transactions.subscribe(txs => {
      this.transactions = txs;
      this.refresh();
    });
  }

  private refresh(): void {
    const month = this.analytics.getCurrentMonthKey();
    const monthTx = this.analytics.filterByMonth(this.transactions, month);
    const byCategory = this.analytics.expenseByCategory(monthTx);

    this.budgetsWithSpent = this.storage.budgetsSnapshot.map(b => ({
      ...b,
      spent: byCategory[b.categoryId] ?? 0,
    }));

    this.totalBudgeted = this.budgetsWithSpent.reduce((s, b) => s + b.amount, 0);
    this.totalSpent    = this.budgetsWithSpent.reduce((s, b) => s + b.spent, 0);
  }

  formatCurrency(v: number): string {
    return this.analytics.formatCurrency(v);
  }

  get overallPct(): number {
    return this.totalBudgeted > 0
      ? Math.min(Math.round((this.totalSpent / this.totalBudgeted) * 100), 100)
      : 0;
  }

  get overallColor(): string {
    return this.overallPct >= 100 ? 'var(--color-negative)'
         : this.overallPct >= 80  ? 'var(--color-warning)'
         :                          'var(--color-positive)';
  }
}
