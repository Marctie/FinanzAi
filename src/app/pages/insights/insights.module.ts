import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { InsightsPage } from './insights.page';
import { SharedModule } from '../../components/shared.module';

@NgModule({
  declarations: [InsightsPage],
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: InsightsPage }]),
    SharedModule,
  ],
})
export class InsightsPageModule {}
