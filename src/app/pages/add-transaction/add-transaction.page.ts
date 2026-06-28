import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { AiService } from '../../services/ai.service';
import { DEFAULT_CATEGORIES, getCategoriesByType } from '../../core/categories.constants';
import { Category } from '../../models/category.model';
import { Transaction } from '../../models/transaction.model';

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

  constructor(
    private fb:      FormBuilder,
    private storage: StorageService,
    private ai:      AiService,
    private router:  Router,
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
    if (this.form.invalid) return;

    const val = this.form.value;
    const tx: Transaction = {
      id:          crypto.randomUUID(),
      type:        val.type,
      amount:      parseFloat(val.amount),
      currency:    'EUR',
      category:    val.category,
      date:        val.date.split('T')[0],
      title:       val.title.trim(),
      notes:       val.notes?.trim() ?? '',
      isRecurring: false,
      recurringId: null,
      profileId:   'default',
    };

    this.storage.addTransaction(tx);
    this.router.navigate(['/tabs/transactions']);
  }

  cancel(): void {
    this.router.navigate(['/tabs/dashboard']);
  }
}
