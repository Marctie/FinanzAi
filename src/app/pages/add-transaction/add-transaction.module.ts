import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { AddTransactionPage } from './add-transaction.page';
import { SharedModule } from '../../components/shared.module';

@NgModule({
  declarations: [AddTransactionPage],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: AddTransactionPage }]),
    SharedModule,
  ],
})
export class AddTransactionPageModule {}
