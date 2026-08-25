export type TransactionType = 'income' | 'expense';

export type PaymentMethod = 'contanti' | 'carta-debito' | 'carta-credito' | 'bonifico' | 'altro';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'contanti',      label: 'Contanti',        icon: 'cash-outline' },
  { id: 'carta-debito',  label: 'Carta di debito',  icon: 'card-outline' },
  { id: 'carta-credito', label: 'Carta di credito',  icon: 'card-outline' },
  { id: 'bonifico',      label: 'Bonifico',         icon: 'swap-horizontal-outline' },
  { id: 'altro',         label: 'Altro',            icon: 'ellipsis-horizontal-outline' },
];

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  date: string;
  title: string;
  notes: string;
  paymentMethod?: PaymentMethod;
  isRecurring: boolean;
  recurringId: string | null;
  profileId: string;
}
