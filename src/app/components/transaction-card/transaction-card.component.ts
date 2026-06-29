import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Transaction } from '../../models/transaction.model';
import { getCategoryById } from '../../core/categories.constants';
import { AnalyticsService } from '../../services/analytics.service';

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

  constructor(private analytics: AnalyticsService) {}

  get category() { return getCategoryById(this.transaction?.category); }

  get amountFormatted(): string {
    const sign = this.transaction.type === 'income' ? '+' : '-';
    return `${sign}${this.analytics.formatCurrency(this.transaction.amount, this.transaction.currency)}`;
  }

  get dateFormatted(): string { return this.analytics.formatDate(this.transaction.date); }
  get isIncome(): boolean     { return this.transaction.type === 'income'; }

  onEdit():   void { this.edited.emit(this.transaction.id); }
  onDelete(): void { this.deleted.emit(this.transaction.id); }
}
