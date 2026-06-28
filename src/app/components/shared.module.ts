import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { LogoComponent }           from './logo/logo.component';
import { FooterComponent }         from './footer/footer.component';
import { EmptyStateComponent }     from './empty-state/empty-state.component';
import { TransactionCardComponent } from './transaction-card/transaction-card.component';
import { BudgetProgressComponent } from './budget-progress/budget-progress.component';
import { InsightCardComponent }    from './insight-card/insight-card.component';
import { MiniChartComponent }      from './mini-chart/mini-chart.component';

const COMPONENTS = [
  LogoComponent,
  FooterComponent,
  EmptyStateComponent,
  TransactionCardComponent,
  BudgetProgressComponent,
  InsightCardComponent,
  MiniChartComponent,
];

@NgModule({
  declarations: COMPONENTS,
  imports: [CommonModule, IonicModule, RouterModule],
  exports: COMPONENTS,
})
export class SharedModule {}
