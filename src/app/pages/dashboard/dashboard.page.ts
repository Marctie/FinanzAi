import { Component, OnInit } from '@angular/core';
import { StorageService } from '../../services/storage.service';
import { AnalyticsService, MonthlyStats } from '../../services/analytics.service';
import { AiService, AiInsight } from '../../services/ai.service';
import { Transaction } from '../../models/transaction.model';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements OnInit {
  transactions: Transaction[]  = [];
  monthlyTx:    Transaction[]  = [];
  recentTx:     Transaction[]  = [];
  insights:     AiInsight[]    = [];
  chartData:    MonthlyStats[] = [];

  totalIncome  = 0;
  totalExpense = 0;
  balance      = 0;
  forecast     = 0;

  currentMonthLabel = '';
  isLoading = true;

  constructor(
    private storage:   StorageService,
    private analytics: AnalyticsService,
    private ai:        AiService,
  ) {}

  ngOnInit(): void {
    const now = new Date();
    this.currentMonthLabel = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    this.storage.transactions.subscribe(txs => {
      this.transactions = txs;
      this.refresh();
      this.isLoading = false;
    });
  }

  private refresh(): void {
    const month = this.analytics.getCurrentMonthKey();
    this.monthlyTx   = this.analytics.filterByMonth(this.transactions, month);
    this.recentTx    = [...this.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    this.totalIncome  = this.analytics.totalIncome(this.monthlyTx);
    this.totalExpense = this.analytics.totalExpense(this.monthlyTx);
    this.balance      = this.totalIncome - this.totalExpense;
    this.forecast     = this.ai.forecastEndOfMonth(this.transactions);
    this.insights     = this.ai.generateInsights(this.transactions).slice(0, 2);
    this.chartData    = this.analytics.getLast6MonthsStats(this.transactions);
  }

  formatCurrency(amount: number): string {
    return this.analytics.formatCurrency(amount);
  }

  onTransactionDeleted(id: string): void {
    this.storage.deleteTransaction(id);
  }

  get balanceSign(): string {
    return this.balance >= 0 ? '+' : '';
  }
}
