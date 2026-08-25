import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { CategoriesPage } from './categories.page';
import { CategoryFormComponent } from './category-form/category-form.component';

@NgModule({
  declarations: [CategoriesPage, CategoryFormComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: CategoriesPage }]),
  ],
})
export class CategoriesPageModule {}
