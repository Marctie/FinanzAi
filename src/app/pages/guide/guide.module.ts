import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { GuidePage } from './guide.page';
import { SharedModule } from '../../components/shared.module';

@NgModule({
  declarations: [GuidePage],
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: GuidePage }]),
    SharedModule,
  ],
})
export class GuidePageModule {}
