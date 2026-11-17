import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { LogoComponent }           from './logo/logo.component';
import { FooterComponent }         from './footer/footer.component';
import { EmptyStateComponent }     from './empty-state/empty-state.component';
import { TransactionCardComponent } from './transaction-card/transaction-card.component';
import { BudgetProgressComponent } from './budget-progress/budget-progress.component';
import { InsightCardComponent }    from './insight-card/insight-card.component';
import { MiniChartComponent }      from './mini-chart/mini-chart.component';
import { AuthComponent }           from './auth/auth.component';
import { RecoveryCodeComponent }   from './recovery-code/recovery-code.component';
import { BarcodeComponent }        from './barcode/barcode.component';
import { LoyaltyCardFormComponent } from './loyalty-card-form/loyalty-card-form.component';
import { LoyaltyCardViewComponent } from './loyalty-card-view/loyalty-card-view.component';
import { ExpenseFormComponent }    from './expense-form/expense-form.component';
import { MoneyPipe }               from './pipes/money.pipe';

const COMPONENTS = [
  LogoComponent,
  FooterComponent,
  EmptyStateComponent,
  TransactionCardComponent,
  BudgetProgressComponent,
  InsightCardComponent,
  MiniChartComponent,
  AuthComponent,
  RecoveryCodeComponent,
  BarcodeComponent,
  LoyaltyCardFormComponent,
  LoyaltyCardViewComponent,
  ExpenseFormComponent,
  MoneyPipe,
];

@NgModule({
  declarations: COMPONENTS,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
  exports: COMPONENTS,
})
export class SharedModule {}
