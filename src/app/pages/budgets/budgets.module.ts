import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { BudgetsPage } from './budgets.page';
import { BudgetFormComponent } from './budget-form/budget-form.component';
import { SharedModule } from '../../components/shared.module';

@NgModule({
  declarations: [BudgetsPage, BudgetFormComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: BudgetsPage }]),
    SharedModule,
  ],
})
export class BudgetsPageModule {}
