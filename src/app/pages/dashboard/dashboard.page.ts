import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { StorageService } from '../../services/storage.service';
import { AnalyticsService, MonthlyStats } from '../../services/analytics.service';
import { AiService, AiInsight } from '../../services/ai.service';
import { Transaction } from '../../models/transaction.model';
import { getCategoryById } from '../../core/categories.constants';

Chart.register(...registerables);

interface CategorySlice { name: string; emoji: string; amount: number; color: string; pct: number; }

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements OnInit, OnDestroy {
  @ViewChild('barCanvas')   barCanvas!:   ElementRef<HTMLCanvasElement>;
  @ViewChild('donutCanvas') donutCanvas!: ElementRef<HTMLCanvasElement>;

  transactions: Transaction[] = [];
  monthlyTx:    Transaction[] = [];
  recentTx:     Transaction[] = [];
  insights:     AiInsight[]   = [];
  chartData:    MonthlyStats[] = [];
  categorySlices: CategorySlice[] = [];

  totalIncome  = 0;
  totalExpense = 0;
  balance      = 0;
  forecast     = 0;

  currentMonthLabel = '';
  isLoading = true;
  chartsReady = false;

  private barChart?:   Chart;
  private donutChart?: Chart;

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

  // Called each time the page becomes active (Ionic lifecycle)
  ionViewDidEnter(): void {
    if (!this.chartsReady && this.chartData.length) {
      this.renderCharts();
    }
  }

  private refresh(): void {
    const month = this.analytics.getCurrentMonthKey();
    this.monthlyTx   = this.analytics.filterByMonth(this.transactions, month);
    this.recentTx    = [...this.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    this.totalIncome  = this.analytics.totalIncome(this.monthlyTx);
    this.totalExpense = this.analytics.totalExpense(this.monthlyTx);
    this.balance      = this.totalIncome - this.totalExpense;
    this.forecast     = this.ai.forecastEndOfMonth(this.transactions);
    this.insights     = this.ai.generateInsights(this.transactions).slice(0, 2);
    this.chartData    = this.analytics.getLast6MonthsStats(this.transactions);
    this.buildCategorySlices();

    // Redraw charts if already rendered
    if (this.chartsReady) {
      this.destroyCharts();
      setTimeout(() => this.renderCharts(), 50);
    }
  }

  private buildCategorySlices(): void {
    const byCategory = this.analytics.expenseByCategory(this.monthlyTx);
    const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
    if (total === 0) { this.categorySlices = []; return; }

    this.categorySlices = Object.entries(byCategory)
      .map(([id, amount]) => {
        const cat = getCategoryById(id);
        return {
          name:   cat?.name  ?? id,
          emoji:  cat?.emoji ?? '💸',
          color:  cat?.color ?? '#999',
          amount,
          pct:    Math.round((amount / total) * 100),
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }

  private renderCharts(): void {
    this.renderBarChart();
    this.renderDonutChart();
    this.chartsReady = true;
  }

  private renderBarChart(): void {
    if (!this.barCanvas?.nativeElement || !this.chartData.length) return;
    const isDark = document.body.classList.contains('ion-palette-dark') ||
      (!document.body.classList.contains('ion-palette-light') &&
       window.matchMedia('(prefers-color-scheme: dark)').matches);
    const gridColor  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
    const labelColor = isDark ? '#7a9ab8' : '#8fa3ba';

    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels:   this.chartData.map(d => d.month),
        datasets: [
          {
            label: 'Entrate',
            data:  this.chartData.map(d => d.income),
            backgroundColor: 'rgba(39,174,96,0.75)',
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: 'Uscite',
            data:  this.chartData.map(d => d.expense),
            backgroundColor: 'rgba(192,57,43,0.65)',
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: labelColor, boxWidth: 12, padding: 16, font: { family: 'Work Sans', size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` €${(ctx.raw as number).toLocaleString('it-IT', { minimumFractionDigits: 0 })}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: labelColor, font: { family: 'Work Sans', size: 11 } } },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: labelColor,
              font: { family: 'Work Sans', size: 10 },
              callback: v => `€${(v as number / 1000).toFixed(0)}k`,
            },
          },
        },
      },
    };
    this.barChart = new Chart(this.barCanvas.nativeElement, cfg);
  }

  private renderDonutChart(): void {
    if (!this.donutCanvas?.nativeElement || !this.categorySlices.length) return;
    const isDark = document.body.classList.contains('ion-palette-dark') ||
      (!document.body.classList.contains('ion-palette-light') &&
       window.matchMedia('(prefers-color-scheme: dark)').matches);
    const labelColor = isDark ? '#7a9ab8' : '#8fa3ba';

    const cfg: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels:   this.categorySlices.map(s => `${s.emoji} ${s.name}`),
        datasets: [{
          data:            this.categorySlices.map(s => s.amount),
          backgroundColor: this.categorySlices.map(s => s.color),
          borderWidth: 2,
          borderColor: isDark ? '#152035' : '#ffffff',
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: labelColor, boxWidth: 12, padding: 12, font: { family: 'Work Sans', size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` €${(ctx.raw as number).toLocaleString('it-IT', { minimumFractionDigits: 2 })} (${this.categorySlices[ctx.dataIndex].pct}%)`,
            },
          },
        },
      },
    };
    this.donutChart = new Chart(this.donutCanvas.nativeElement, cfg);
  }

  private destroyCharts(): void {
    this.barChart?.destroy();
    this.donutChart?.destroy();
    this.barChart   = undefined;
    this.donutChart = undefined;
    this.chartsReady = false;
  }

  ngOnDestroy(): void { this.destroyCharts(); }

  formatCurrency(amount: number): string { return this.analytics.formatCurrency(amount); }

  onTransactionDeleted(id: string): void { this.storage.deleteTransaction(id); }
  onTransactionEdited(id: string): void  {
    const tx = this.storage.transactionsSnapshot.find(t => t.id === id);
    if (tx) window.location.href = `/tabs/add-transaction?id=${id}`;
  }

  get balanceSign(): string { return this.balance >= 0 ? '+' : ''; }
  get aiMonthlySummary(): string { return this.ai.getMonthlySummary(this.transactions); }
}
