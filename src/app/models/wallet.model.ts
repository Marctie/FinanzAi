import { LoyaltyCard } from './loyalty-card.model';

export type SplitMode = 'equal' | 'percent' | 'amount';

/** Quota di un membro in una spesa: per "equal" conta solo la presenza, per "percent" è la %, per "amount" l'importo. */
export interface ExpenseShare {
  userId: string;
  value: number;
}

/** Spesa di un wallet condiviso. Gli importi sono in unità della valuta del wallet (es. euro, con decimali). */
export interface SharedExpense {
  id: string;
  title: string;
  amount: number;
  date: string;              // AAAA-MM-GG
  category: string;
  paidBy: string;            // userId di chi ha pagato
  splitMode: SplitMode;
  shares: ExpenseShare[];
  /** true = rimborso tra membri ("Marco ha restituito 20 € a Luca"). */
  isSettlement?: boolean;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Contenuto condiviso del wallet (colonna wallets.data). */
export interface WalletData {
  expenses: SharedExpense[];
  loyaltyCards: LoyaltyCard[];
}

export const EMPTY_WALLET_DATA: WalletData = { expenses: [], loyaltyCards: [] };

export interface WalletMember {
  userId: string;
  displayName: string;
  role: 'owner' | 'member';
  isMe: boolean;
}

export interface Wallet {
  id: string;
  name: string;
  emoji: string;
  currency: string;
  inviteCode: string;
  role: 'owner' | 'member';
  members: WalletMember[];
  data: WalletData;
}

/** Saldo netto di un membro: positivo = deve ricevere, negativo = deve dare. */
export interface MemberBalance {
  userId: string;
  paid: number;
  owed: number;
  net: number;
}

/** "from deve `amount` a to". */
export interface Settlement {
  from: string;
  to: string;
  amount: number;
}
