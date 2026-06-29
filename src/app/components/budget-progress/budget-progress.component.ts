import { Component, Input, OnChanges } from '@angular/core';
import { Budget } from '../../models/budget.model';
import { getCategoryById } from '../../core/categories.constants';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-budget-progress',
  templateUrl: './budget-progress.component.html',
  styleUrls: ['./budget-progress.component.scss'],
  standalone: false,
})
export class BudgetProgressComponent implements OnChanges {
  @Input() budget!: Budget;
  @Input() spent   = 0;
  @Input() isAlert = false;

  percentage = 0;
  progressColor = 'var(--color-positive)';

  constructor(private analytics: AnalyticsService) {}

  ngOnChanges(): void {
    this.percentage = this.budget ? Math.min(Math.round((this.spent / this.budget.amount) * 100), 100) : 0;
    this.progressColor =
      this.percentage >= 100 ? 'var(--color-negative)' :
      this.percentage >= this.budget?.alertThreshold ? 'var(--color-warning)' :
      'var(--color-positive)';
  }

  get category() { return getCategoryById(this.budget?.categoryId); }

  get spentFormatted(): string  { return this.analytics.formatCurrency(this.spent); }
  get budgetFormatted(): string { return this.analytics.formatCurrency(this.budget?.amount ?? 0); }
  get remaining(): number       { return Math.max((this.budget?.amount ?? 0) - this.spent, 0); }
  get remainingFormatted(): string { return this.analytics.formatCurrency(this.remaining); }
}
