import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { BudgetsPage } from './budgets.page';
import { SharedModule } from '../../components/shared.module';

@NgModule({
  declarations: [BudgetsPage],
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: BudgetsPage }]),
    SharedModule,
  ],
})
export class BudgetsPageModule {}
