import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { AiService, AiInsight } from '../../services/ai.service';
import { AnalyticsService, MonthlyStats } from '../../services/analytics.service';
import { Transaction } from '../../models/transaction.model';
import { Goal } from '../../models/goal.model';

@Component({
  selector: 'app-insights',
  templateUrl: './insights.page.html',
  styleUrls: ['./insights.page.scss'],
  standalone: false,
})
export class InsightsPage implements OnInit {
  insights:         AiInsight[]    = [];
  transactions:     Transaction[]  = [];
  goals:            Goal[]         = [];
  monthlyStats:     MonthlyStats[] = [];
  savingsRate       = 0;
  topCategory       = '';
  topCategoryAmount = 0;
  recurringCount    = 0;

  constructor(
    private storage:   StorageService,
    private ai:        AiService,
    private analytics: AnalyticsService,
    private router:    Router,
  ) {}

  ngOnInit(): void {
    this.storage.transactions.subscribe(txs => {
      this.transactions = txs;
      this.refresh();
    });
    this.storage.goals.subscribe(gs => { this.goals = gs; });
  }

  private refresh(): void {
    this.insights      = this.ai.generateInsights(this.transactions);
    this.monthlyStats  = this.analytics.getLast6MonthsStats(this.transactions);
    this.recurringCount = this.ai.detectRecurring(this.transactions).length;

    const month   = this.analytics.getCurrentMonthKey();
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

  get avgMonthlySaving(): number {
    const savings = this.monthlyStats.map(m => m.income - m.expense).filter(v => v > 0);
    return savings.length ? savings.reduce((a, b) => a + b, 0) / savings.length : 0;
  }

  get bestMonth(): MonthlyStats | null {
    return this.monthlyStats.length
      ? this.monthlyStats.reduce((best, m) => (m.balance > best.balance ? m : best))
      : null;
  }

  get activeGoals(): number { return this.goals.filter(g => g.currentAmount < g.targetAmount).length; }

  goToGoals(): void { this.router.navigate(['/tabs/goals']); }

  formatCurrency(v: number): string { return this.analytics.formatCurrency(v); }
}
