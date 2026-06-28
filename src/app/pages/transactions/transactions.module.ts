import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { TransactionsPage } from './transactions.page';
import { SharedModule } from '../../components/shared.module';

@NgModule({
  declarations: [TransactionsPage],
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: TransactionsPage }]),
    SharedModule,
  ],
})
export class TransactionsPageModule {}
