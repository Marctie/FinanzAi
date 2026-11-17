import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../components/shared.module';
import { SharedPage } from './shared.page';
import { WalletDetailPage } from './wallet-detail.page';

@NgModule({
  declarations: [SharedPage, WalletDetailPage],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    RouterModule.forChild([
      { path: '', component: SharedPage },
      { path: 'wallet/:id', component: WalletDetailPage },
    ]),
  ],
})
export class SharedPageModule {}
