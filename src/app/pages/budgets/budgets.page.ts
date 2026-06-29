import { Component, OnInit } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { AnalyticsService } from '../../services/analytics.service';
import { AiService } from '../../services/ai.service';
import { Budget } from '../../models/budget.model';
import { Transaction } from '../../models/transaction.model';
import { BudgetFormComponent } from './budget-form/budget-form.component';

interface BudgetWithSpent extends Budget { spent: number; isAlert: boolean; }

@Component({
  selector: 'app-budgets',
  templateUrl: './budgets.page.html',
  styleUrls: ['./budgets.page.scss'],
  standalone: false,
})
export class BudgetsPage implements OnInit {
  budgetsWithSpent: BudgetWithSpent[] = [];
  transactions:     Transaction[]     = [];
  recurringCount    = 0;
  totalBudgeted     = 0;
  totalSpent        = 0;

  constructor(
    private storage:   StorageService,
    private analytics: AnalyticsService,
    private ai:        AiService,
    private modal:     ModalController,
    private alert:     AlertController,
  ) {}

  ngOnInit(): void {
    this.storage.budgets.subscribe(() => this.refresh());
    this.storage.transactions.subscribe(txs => {
      this.transactions = txs;
      this.refresh();
    });
  }

  private refresh(): void {
    const month    = this.analytics.getCurrentMonthKey();
    const monthTx  = this.analytics.filterByMonth(this.transactions, month);
    const byCategory = this.analytics.expenseByCategory(monthTx);
    const alertTh  = 80;

    this.budgetsWithSpent = this.storage.budgetsSnapshot.map(b => {
      const spent = byCategory[b.categoryId] ?? 0;
      const pct   = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      return { ...b, spent, isAlert: pct >= alertTh };
    });

    this.totalBudgeted   = this.budgetsWithSpent.reduce((s, b) => s + b.amount, 0);
    this.totalSpent      = this.budgetsWithSpent.reduce((s, b) => s + b.spent,  0);
    this.recurringCount  = this.ai.detectRecurring(this.transactions).length;
  }

  async openForm(budget?: Budget): Promise<void> {
    const m = await this.modal.create({
      component: BudgetFormComponent,
      componentProps: { budget },
      initialBreakpoint: 0.75,
      breakpoints: [0, 0.75, 1],
      handleBehavior: 'cycle',
    });
    await m.present();
    const { data } = await m.onWillDismiss();
    if (data?.budget) this.storage.saveBudget(data.budget);
    if (data?.delete) this.storage.deleteBudget(data.delete);
  }

  async confirmDelete(id: string): Promise<void> {
    const a = await this.alert.create({
      header: 'Elimina budget',
      message: 'Sei sicuro di voler eliminare questo budget?',
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Elimina', role: 'destructive', handler: () => this.storage.deleteBudget(id) },
      ],
    });
    await a.present();
  }

  formatCurrency(v: number): string { return this.analytics.formatCurrency(v); }

  get overallPct(): number {
    return this.totalBudgeted > 0
      ? Math.min(Math.round((this.totalSpent / this.totalBudgeted) * 100), 100) : 0;
  }

  get overallColor(): string {
    return this.overallPct >= 100 ? 'var(--color-negative)'
         : this.overallPct >= 80  ? 'var(--color-warning)'
         :                          'var(--color-positive)';
  }

  get alertBudgets(): BudgetWithSpent[] {
    return this.budgetsWithSpent.filter(b => b.isAlert);
  }
}
