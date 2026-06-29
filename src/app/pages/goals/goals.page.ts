import { Component, OnInit } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { AnalyticsService } from '../../services/analytics.service';
import { Goal } from '../../models/goal.model';
import { GoalFormComponent } from './goal-form/goal-form.component';

export interface GoalWithMeta extends Goal {
  pct:     number;
  daysLeft: number | null;
}

@Component({
  selector: 'app-goals',
  templateUrl: './goals.page.html',
  styleUrls: ['./goals.page.scss'],
  standalone: false,
})
export class GoalsPage implements OnInit {
  goals: GoalWithMeta[] = [];

  constructor(
    private storage:   StorageService,
    private analytics: AnalyticsService,
    private modal:     ModalController,
    private alert:     AlertController,
  ) {}

  ngOnInit(): void {
    this.storage.goals.subscribe(gs => this.mapGoals(gs));
  }

  private mapGoals(gs: Goal[]): void {
    const now = new Date();
    this.goals = gs.map(g => {
      const pct      = g.targetAmount > 0 ? Math.min(Math.round((g.currentAmount / g.targetAmount) * 100), 100) : 0;
      let daysLeft: number | null = null;
      if (g.deadline) {
        const diff = new Date(g.deadline).getTime() - now.getTime();
        daysLeft   = Math.max(Math.ceil(diff / 86_400_000), 0);
      }
      return { ...g, pct, daysLeft };
    });
  }

  get totalSaved():  number { return this.goals.reduce((s, g) => s + g.currentAmount, 0); }
  get totalTarget(): number { return this.goals.reduce((s, g) => s + g.targetAmount, 0); }
  get completedCount(): number { return this.goals.filter(g => g.pct >= 100).length; }

  async openForm(goal?: Goal): Promise<void> {
    const m = await this.modal.create({
      component: GoalFormComponent,
      componentProps: { goal },
      initialBreakpoint: 0.85,
      breakpoints: [0, 0.85, 1],
      handleBehavior: 'cycle',
    });
    await m.present();
    const { data } = await m.onWillDismiss();
    if (data?.goal)   this.storage.saveGoal(data.goal);
    if (data?.delete) this.storage.deleteGoal(data.delete);
  }

  async addContrib(goal: GoalWithMeta): Promise<void> {
    const a = await this.alert.create({
      header: `Aggiungi a "${goal.name}"`,
      inputs: [{ name: 'amount', type: 'number', placeholder: 'Importo (€)', min: 0.01 }],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Aggiungi',
          handler: (d) => {
            const v = parseFloat(d.amount);
            if (v > 0) {
              const updated: Goal = { ...goal, currentAmount: goal.currentAmount + v };
              this.storage.saveGoal(updated);
            }
          },
        },
      ],
    });
    await a.present();
  }

  formatCurrency(v: number): string { return this.analytics.formatCurrency(v); }
}
