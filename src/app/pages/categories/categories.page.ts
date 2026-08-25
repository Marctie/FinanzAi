import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category.model';
import { CategoryFormComponent } from './category-form/category-form.component';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
  standalone: false,
})
export class CategoriesPage implements OnInit {
  expenseCategories: Category[] = [];
  incomeCategories: Category[] = [];

  constructor(private categoryService: CategoryService, private modalCtrl: ModalController) {}

  ngOnInit(): void {
    this.categoryService.categories.subscribe(() => this.refresh());
  }

  private refresh(): void {
    this.expenseCategories = this.categoryService.getCategoriesByType('expense');
    this.incomeCategories  = this.categoryService.getCategoriesByType('income');
  }

  async addCategory(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: CategoryFormComponent, breakpoints: [0, 0.75, 1], initialBreakpoint: 0.75 });
    modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.value) {
      this.categoryService.addCategory(data.value);
    }
  }

  async editCategory(category: Category): Promise<void> {
    if (!category.isCustom) return;
    const modal = await this.modalCtrl.create({
      component: CategoryFormComponent,
      componentProps: { category },
      breakpoints: [0, 0.75, 1],
      initialBreakpoint: 0.75,
    });
    modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.delete) {
      this.categoryService.deleteCategory(data.delete);
    } else if (data?.value) {
      this.categoryService.updateCategory({ ...category, ...data.value });
    }
  }
}
