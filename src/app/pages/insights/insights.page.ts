import { Component, OnInit } from '@angular/core';
import { StorageService } from '../../services/storage.service';
import { AiService, AiInsight } from '../../services/ai.service';
import { AnalyticsService } from '../../services/analytics.service';
import { Transaction } from '../../models/transaction.model';

@Component({
  selector: 'app-insights',
  templateUrl: './insights.page.html',
  styleUrls: ['./insights.page.scss'],
  standalone: false,
})
export class InsightsPage implements OnInit {
  insights: AiInsight[] = [];
  transactions: Transaction[] = [];
  savingsRate = 0;
  topCategory = '';
  topCategoryAmount = 0;

  constructor(
    private storage:   StorageService,
    private ai:        AiService,
    private analytics: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.storage.transactions.subscribe(txs => {
      this.transactions = txs;
      this.refresh();
    });
  }

  private refresh(): void {
    this.insights = this.ai.generateInsights(this.transactions);

    const month  = this.analytics.getCurrentMonthKey();
    const monthTx = this.analytics.filterByMonth(this.transactions, month);
    const income  = this.analytics.totalIncome(monthTx);
    const expense = this.analytics.totalExpense(monthTx);

    this.savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

    const byCategory = this.analytics.expenseByCategory(monthTx);
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    if (sorted.length) {
      this.topCategory       = sorted[0][0];
      this.topCategoryAmount = sorted[0][1];
    }
  }

  formatCurrency(v: number): string {
    return this.analytics.formatCurrency(v);
  }
}
