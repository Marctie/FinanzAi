import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Transaction, PAYMENT_METHODS } from '../../models/transaction.model';
import { AnalyticsService } from '../../services/analytics.service';
import { CategoryService } from '../../services/category.service';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

@Component({
  selector: 'app-transaction-card',
  templateUrl: './transaction-card.component.html',
  styleUrls: ['./transaction-card.component.scss'],
  standalone: false,
})
export class TransactionCardComponent {
  @Input() transaction!: Transaction;
  @Output() deleted = new EventEmitter<string>();
  @Output() edited  = new EventEmitter<string>();

  constructor(private analytics: AnalyticsService, private categories: CategoryService) {}

  get category() { return this.categories.getCategoryById(this.transaction?.category); }

  get paymentMethodLabel(): string | null {
    if (!this.transaction?.paymentMethod) return null;
    return PAYMENT_METHODS.find(p => p.id === this.transaction.paymentMethod)?.label ?? null;
  }

  get amountFormatted(): string {
    const sign = this.transaction.type === 'income' ? '+' : '-';
    return `${sign}${this.analytics.formatCurrency(this.transaction.amount, this.transaction.currency)}`;
  }

  get dateFormatted(): string { return this.analytics.formatDate(this.transaction.date); }
  get isIncome(): boolean     { return this.transaction.type === 'income'; }

  onEdit(): void {
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light });
    this.edited.emit(this.transaction.id);
  }

  onDelete(): void {
    if (Capacitor.isNativePlatform()) Haptics.notification({ type: NotificationType.Warning });
    this.deleted.emit(this.transaction.id);
  }
}
