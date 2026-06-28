import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('../pages/dashboard/dashboard.module').then(m => m.DashboardPageModule),
      },
      {
        path: 'transactions',
        loadChildren: () => import('../pages/transactions/transactions.module').then(m => m.TransactionsPageModule),
      },
      {
        path: 'add-transaction',
        loadChildren: () => import('../pages/add-transaction/add-transaction.module').then(m => m.AddTransactionPageModule),
      },
      {
        path: 'budgets',
        loadChildren: () => import('../pages/budgets/budgets.module').then(m => m.BudgetsPageModule),
      },
      {
        path: 'insights',
        loadChildren: () => import('../pages/insights/insights.module').then(m => m.InsightsPageModule),
      },
      {
        path: 'settings',
        loadChildren: () => import('../pages/settings/settings.module').then(m => m.SettingsPageModule),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsRoutingModule {}
