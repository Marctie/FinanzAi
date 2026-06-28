import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { SettingsPage } from './settings.page';
import { SharedModule } from '../../components/shared.module';

@NgModule({
  declarations: [SettingsPage],
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: SettingsPage }]),
    SharedModule,
  ],
})
export class SettingsPageModule {}
