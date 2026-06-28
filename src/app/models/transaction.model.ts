export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  date: string;
  title: string;
  notes: string;
  isRecurring: boolean;
  recurringId: string | null;
  profileId: string;
}
