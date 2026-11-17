import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Category } from '../../models/category.model';
import { SharedExpense, SplitMode, Wallet } from '../../models/wallet.model';
import { CategoryService } from '../../services/category.service';
import { fromCents, splitExpense, validateSplit } from '../../core/balances.util';

interface Row { userId: string; name: string; included: boolean; value: number | null }

/** Spesa di un wallet condiviso: chi ha pagato, importo e suddivisione (uguale, percentuale, importi). */
@Component({
  selector: 'app-expense-form',
  templateUrl: './expense-form.component.html',
  standalone: false,
})
export class ExpenseFormComponent implements OnInit {
  @Input() wallet!: Wallet;
  @Input() expense?: SharedExpense;
  @Input() myUserId = '';

  title = '';
  amount: number | null = null;
  date = new Date().toISOString().slice(0, 10);
  category = 'altro-uscita';
  paidBy = '';
  mode: SplitMode = 'equal';
  notes = '';
  rows: Row[] = [];
  categories: Category[] = [];
  error = '';

  constructor(private modalCtrl: ModalController, private categorySvc: CategoryService) {}

  ngOnInit(): void {
    this.categories = this.categorySvc.getCategoriesByType('expense');
    if (!this.categories.some(c => c.id === this.category)) this.category = this.categories[0]?.id ?? '';
    const e = this.expense;
    this.paidBy = e?.paidBy ?? this.myUserId;
    if (e) {
      this.title = e.title; this.amount = e.amount; this.date = e.date; this.category = e.category;
      this.mode = e.splitMode; this.notes = e.notes ?? '';
    }
    this.rows = this.wallet.members.map(m => {
      const share = e?.shares.find(s => s.userId === m.userId);
      return { userId: m.userId, name: m.isMe ? `${m.displayName} (tu)` : m.displayName, included: e ? !!share : true, value: share && e!.splitMode !== 'equal' ? share.value : null };
    });
  }

  get members() { return this.wallet.members; }

  setMode(m: SplitMode): void {
    this.mode = m;
    // Valori iniziali comodi: percentuali o importi divisi in parti uguali tra gli inclusi.
    const inc = this.rows.filter(r => r.included);
    if (m === 'percent') inc.forEach(r => r.value = +(100 / inc.length).toFixed(2));
    if (m === 'amount' && this.amount) {
      const split = splitExpense(this.amount, 'equal', inc.map(r => ({ userId: r.userId, value: 0 })));
      inc.forEach(r => r.value = fromCents(split.get(r.userId) ?? 0));
    }
  }

  /** Anteprima di quanto deve ciascuno. */
  preview(userId: string): number | null {
    if (!this.amount || this.amount <= 0) return null;
    const shares = this.shares();
    if (validateSplit(this.amount, this.mode, shares)) return null;
    return fromCents(splitExpense(this.amount, this.mode, shares).get(userId) ?? 0);
  }

  get remainder(): string | null {
    if (this.mode === 'equal') return null;
    const sum = this.rows.filter(r => r.included).reduce((a, r) => a + (Number(r.value) || 0), 0);
    if (this.mode === 'percent') return `Totale: ${+sum.toFixed(2)}% su 100%`;
    return `Totale quote: ${sum.toFixed(2)} su ${(this.amount ?? 0).toFixed(2)}`;
  }

  private shares() {
    return this.rows.filter(r => r.included).map(r => ({ userId: r.userId, value: this.mode === 'equal' ? 0 : Number(r.value) || 0 }));
  }

  save(): void {
    this.error = '';
    if (!this.title.trim()) { this.error = 'Scrivi una descrizione'; return; }
    const amount = Number(this.amount);
    const err = validateSplit(amount, this.mode, this.shares());
    if (err) { this.error = err; return; }
    const now = new Date().toISOString();
    const e: SharedExpense = {
      id: this.expense?.id ?? crypto.randomUUID(),
      title: this.title.trim().slice(0, 80),
      amount: Math.round(amount * 100) / 100,
      date: this.date.slice(0, 10),
      category: this.category,
      paidBy: this.paidBy,
      splitMode: this.mode,
      shares: this.shares(),
      notes: this.notes.trim().slice(0, 200) || undefined,
      createdBy: this.expense?.createdBy ?? this.myUserId,
      createdAt: this.expense?.createdAt ?? now,
      updatedAt: now,
    };
    this.modalCtrl.dismiss({ expense: e });
  }

  remove(): void { this.modalCtrl.dismiss({ delete: true }); }
  close(): void { this.modalCtrl.dismiss(); }
}
