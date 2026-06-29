import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { GoalsPage } from './goals.page';
import { GoalFormComponent } from './goal-form/goal-form.component';
import { SharedModule } from '../../components/shared.module';

@NgModule({
  declarations: [GoalsPage, GoalFormComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule.forChild([{ path: '', component: GoalsPage }]),
    SharedModule,
  ],
})
export class GoalsPageModule {}
