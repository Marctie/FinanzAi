export type BudgetPeriod = 'monthly' | 'weekly';

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  period: BudgetPeriod;
  month: string;
  alertThreshold: number;
}
