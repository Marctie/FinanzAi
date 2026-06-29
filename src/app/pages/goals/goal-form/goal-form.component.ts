import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Goal } from '../../../models/goal.model';

const COLORS = ['#1b6ca8','#27ae60','#e74c3c','#f39c12','#9b59b6','#16a085','#e67e22','#2c3e50'];

@Component({
  selector: 'app-goal-form',
  templateUrl: './goal-form.component.html',
  styleUrls: ['./goal-form.component.scss'],
  standalone: false,
})
export class GoalFormComponent implements OnInit {
  @Input() goal?: Goal;
  form!: FormGroup;
  colors = COLORS;
  today  = new Date().toISOString().slice(0, 10);

  constructor(private fb: FormBuilder, private modalCtrl: ModalController) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name:          [this.goal?.name          ?? '',        Validators.required],
      targetAmount:  [this.goal?.targetAmount  ?? null,     [Validators.required, Validators.min(1)]],
      currentAmount: [this.goal?.currentAmount ?? 0,        [Validators.required, Validators.min(0)]],
      deadline:      [this.goal?.deadline      ?? null],
      category:      [this.goal?.category      ?? '🎯',     Validators.required],
      color:         [this.goal?.color         ?? COLORS[0], Validators.required],
    });
  }

  get isEdit(): boolean { return !!this.goal; }

  save(): void {
    if (this.form.invalid) return;
    const g: Goal = {
      id: this.goal?.id ?? crypto.randomUUID(),
      ...this.form.value,
    };
    this.modalCtrl.dismiss({ goal: g });
  }

  delete(): void { this.modalCtrl.dismiss({ delete: this.goal!.id }); }
  dismiss(): void { this.modalCtrl.dismiss(); }
}
