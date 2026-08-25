import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Category, CategoryType } from '../../../models/category.model';

export const EMOJI_CHOICES = [
  '🛒', '🍽️', '🚗', '📱', '💊', '🏠', '🛍️', '🎬', '✈️', '📚',
  '💼', '💻', '📈', '↩️', '🐾', '🎁', '⚽', '🧾', '🔧', '💸',
];

export const COLOR_CHOICES = [
  '#e67e22', '#e74c3c', '#3498db', '#9b59b6', '#1abc9c', '#795548',
  '#e91e63', '#ff5722', '#00bcd4', '#607d8b', '#27ae60', '#f39c12',
];

@Component({
  selector: 'app-category-form',
  templateUrl: './category-form.component.html',
  styleUrls: ['./category-form.component.scss'],
  standalone: false,
})
export class CategoryFormComponent implements OnInit {
  @Input() category?: Category;
  form!: FormGroup;
  emojiChoices = EMOJI_CHOICES;
  colorChoices = COLOR_CHOICES;

  constructor(private fb: FormBuilder, private modalCtrl: ModalController) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name:  [this.category?.name ?? '', Validators.required],
      type:  [this.category?.type ?? 'expense', Validators.required],
      emoji: [this.category?.emoji ?? this.emojiChoices[0], Validators.required],
      color: [this.category?.color ?? this.colorChoices[0], Validators.required],
    });
  }

  get isEdit(): boolean { return !!this.category; }

  setType(type: CategoryType): void { this.form.get('type')!.setValue(type); }
  setEmoji(emoji: string): void     { this.form.get('emoji')!.setValue(emoji); }
  setColor(color: string): void     { this.form.get('color')!.setValue(color); }

  save(): void {
    if (this.form.invalid) return;
    this.modalCtrl.dismiss({ value: this.form.value });
  }

  delete(): void { this.modalCtrl.dismiss({ delete: this.category!.id }); }
  dismiss(): void { this.modalCtrl.dismiss(); }
}
