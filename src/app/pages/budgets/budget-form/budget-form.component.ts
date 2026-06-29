import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Budget } from '../../../models/budget.model';
import { getCategoriesByType } from '../../../core/categories.constants';
import { Category } from '../../../models/category.model';

@Component({
  selector: 'app-budget-form',
  templateUrl: './budget-form.component.html',
  styleUrls: ['./budget-form.component.scss'],
  standalone: false,
})
export class BudgetFormComponent implements OnInit {
  @Input() budget?: Budget;
  form!: FormGroup;
  categories: Category[] = [];

  constructor(private fb: FormBuilder, private modalCtrl: ModalController) {}

  ngOnInit(): void {
    this.categories = getCategoriesByType('expense');
    this.form = this.fb.group({
      categoryId:     [this.budget?.categoryId ?? '', Validators.required],
      amount:         [this.budget?.amount ?? null, [Validators.required, Validators.min(1)]],
      alertThreshold: [this.budget?.alertThreshold ?? 80, [Validators.required, Validators.min(1), Validators.max(100)]],
    });
  }

  get isEdit(): boolean { return !!this.budget; }

  save(): void {
    if (this.form.invalid) return;
    const now   = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const b: Budget = {
      id:             this.budget?.id ?? crypto.randomUUID(),
      period:         'monthly',
      month,
      ...this.form.value,
    };
    this.modalCtrl.dismiss({ budget: b });
  }

  delete(): void { this.modalCtrl.dismiss({ delete: this.budget!.id }); }
  dismiss(): void { this.modalCtrl.dismiss(); }
}
