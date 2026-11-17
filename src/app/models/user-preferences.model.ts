export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserPreferences {
  theme: ThemeMode;
  defaultCurrency: string;
  activeProfileId: string;
  firstDayOfWeek: 0 | 1;
  language: string;

  // ── Notifiche (sincronizzate in user_settings, mai condivise) ──
  /** Interruttore generale (vale solo se anche il permesso di sistema è concesso). */
  notificationsEnabled: boolean;
  /** Orario dei promemoria giornalieri "HH:MM" nel fuso orario del dispositivo. */
  notifyTime: string;
  /** Budget del mese oltre la soglia di avviso. */
  budgetAlertEnabled: boolean;
  /** Movimenti ricorrenti in scadenza oggi (rate, abbonamenti, affitto...). */
  notifyRecurring: boolean;
  /** Obiettivi con scadenza vicina. */
  notifyGoals: boolean;
  /** Giorni di preavviso per le scadenze degli obiettivi. */
  goalAlertDays: number;
  /** Spese aggiunte o modificate da altri membri dei wallet. */
  notifyWalletExpenses: boolean;
  /** Carte fedeltà condivise da altri membri. */
  notifyLoyaltyCards: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  defaultCurrency: 'EUR',
  activeProfileId: 'default',
  firstDayOfWeek: 1,
  language: 'it',
  notificationsEnabled: true,
  notifyTime: '09:00',
  budgetAlertEnabled: true,
  notifyRecurring: true,
  notifyGoals: true,
  goalAlertDays: 7,
  notifyWalletExpenses: true,
  notifyLoyaltyCards: true,
};
