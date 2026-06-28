export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserPreferences {
  theme: ThemeMode;
  defaultCurrency: string;
  activeProfileId: string;
  notificationsEnabled: boolean;
  budgetAlertEnabled: boolean;
  firstDayOfWeek: 0 | 1;
  language: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  defaultCurrency: 'EUR',
  activeProfileId: 'default',
  notificationsEnabled: true,
  budgetAlertEnabled: true,
  firstDayOfWeek: 1,
  language: 'it',
};
