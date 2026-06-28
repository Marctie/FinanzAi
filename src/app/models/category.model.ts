export type CategoryType = 'income' | 'expense' | 'both';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  type: CategoryType;
  color: string;
  keywords: string[];
  isCustom: boolean;
}
