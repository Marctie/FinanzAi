import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { AiService } from '../../services/ai.service';
import { DEFAULT_CATEGORIES, getCategoriesByType } from '../../core/categories.constants';
import { Category } from '../../models/category.model';
import { Transaction } from '../../models/transaction.model';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

@Component({
  selector: 'app-add-transaction',
  templateUrl: './add-transaction.page.html',
  styleUrls: ['./add-transaction.page.scss'],
  standalone: false,
})
export class AddTransactionPage implements OnInit {
  form!: FormGroup;
  categories: Category[] = [];
  suggestedCategory = '';
  today = new Date().toISOString();

  editId: string | null = null;
  get isEditMode(): boolean { return !!this.editId; }

  constructor(
    private fb:      FormBuilder,
    private storage: StorageService,
    private ai:      AiService,
    private router:  Router,
    private route:   ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      type:     ['expense', Validators.required],
      amount:   [null, [Validators.required, Validators.min(0.01)]],
      title:    ['', Validators.required],
      category: ['', Validators.required],
      date:     [this.today, Validators.required],
      notes:    [''],
    });

    this.form.get('type')!.valueChanges.subscribe(() => this.updateCategories());
    this.form.get('title')!.valueChanges.subscribe(v => this.onTitleChange(v));
    this.updateCategories();

    // Edit mode: load existing transaction
    this.editId = this.route.snapshot.queryParamMap.get('id');
    if (this.editId) {
      const tx = this.storage.transactionsSnapshot.find(t => t.id === this.editId);
      if (tx) {
        this.form.patchValue({
          type:     tx.type,
          amount:   tx.amount,
          title:    tx.title,
          category: tx.category,
          date:     tx.date + 'T00:00:00',
          notes:    tx.notes,
        });
        this.updateCategories();
      }
    }
  }

  private updateCategories(): void {
    const type = this.form.get('type')!.value as 'income' | 'expense';
    this.categories = getCategoriesByType(type);
    const current = this.form.get('category')!.value;
    const valid = this.categories.some(c => c.id === current);
    if (!valid) {
      this.form.get('category')!.setValue(type === 'expense' ? 'altro-uscita' : 'altro-entrata');
    }
  }

  private onTitleChange(title: string): void {
    if (this.isEditMode) return;
    if (title?.length > 2) {
      const type = this.form.get('type')!.value as 'income' | 'expense';
      const suggested = this.ai.suggestCategory(title, type);
      const cat = DEFAULT_CATEGORIES.find(c => c.id === suggested);
      if (suggested !== this.form.get('category')!.value && cat) {
        this.suggestedCategory = cat.name;
        this.form.get('category')!.setValue(suggested);
      }
    }
  }

  setType(type: 'income' | 'expense'): void {
    this.form.get('type')!.setValue(type);
  }

  save(): void {
    if (this.form.invalid) {
      if (Capacitor.isNativePlatform()) Haptics.notification({ type: NotificationType.Error });
      return;
    }
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Medium });
    const val = this.form.value;
    const dateStr = typeof val.date === 'string' ? val.date.split('T')[0] : val.date;

    if (this.isEditMode) {
      const original = this.storage.transactionsSnapshot.find(t => t.id === this.editId);
      if (!original) return;
      this.storage.updateTransaction({
        ...original,
        type:     val.type,
        amount:   parseFloat(val.amount),
        category: val.category,
        date:     dateStr,
        title:    val.title.trim(),
        notes:    val.notes?.trim() ?? '',
      });
    } else {
      const tx: Transaction = {
        id:          crypto.randomUUID(),
        type:        val.type,
        amount:      parseFloat(val.amount),
        currency:    'EUR',
        category:    val.category,
        date:        dateStr,
        title:       val.title.trim(),
        notes:       val.notes?.trim() ?? '',
        isRecurring: false,
        recurringId: null,
        profileId:   'default',
      };
      this.storage.addTransaction(tx);
    }
    this.router.navigate(['/tabs/transactions']);
  }

  cancel(): void {
    history.back();
  }
}
