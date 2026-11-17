/**
 * Planner delle notifiche, UNICO per app e server.
 * Questo file non importa nulla: scripts/deploy-functions.mjs lo copia così com'è in
 * supabase/functions/_shared/planner.ts, quindi notifiche locali Android, riepilogo web e push del server
 * (daily-reminders, notify-expense) usano esattamente la stessa logica e gli stessi testi.
 */

export interface PlannerPrefs {
  notificationsEnabled: boolean;
  notifyTime: string;
  budgetAlertEnabled: boolean;
  notifyRecurring: boolean;
  notifyGoals: boolean;
  goalAlertDays: number;
  notifyWalletExpenses: boolean;
  notifyLoyaltyCards: boolean;
  defaultCurrency?: string;
}

export const DEFAULT_NOTIFICATION_PREFS: PlannerPrefs = {
  notificationsEnabled: true,
  notifyTime: '09:00',
  budgetAlertEnabled: true,
  notifyRecurring: true,
  notifyGoals: true,
  goalAlertDays: 7,
  notifyWalletExpenses: true,
  notifyLoyaltyCards: true,
  defaultCurrency: 'EUR',
};

export interface PlannerTx {
  id: string; type: 'income' | 'expense'; amount: number; category: string; date: string;
  title: string; isRecurring: boolean; recurringId: string | null;
}
export interface PlannerBudget { id: string; categoryId: string; amount: number; alertThreshold?: number }
export interface PlannerGoal { id: string; name: string; targetAmount: number; currentAmount: number; deadline: string | null }

export interface PlannerInput {
  transactions: PlannerTx[];
  budgets: PlannerBudget[];
  goals: PlannerGoal[];
  /** Nome leggibile di una categoria (id → nome). */
  categoryName?: (id: string) => string;
}

export interface PlannedNotification {
  /** Id numerico stabile (stesso giorno + stesso motivo = stesso id), richiesto da Android. */
  id: number;
  day: string;            // AAAA-MM-GG
  kind: 'recurring' | 'budget' | 'goal';
  title: string;
  body: string;
}

// ── Date (sempre "giorno locale" AAAA-MM-GG, senza fusi orari) ─────────────

export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayNumber(day: string): number {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function addDays(day: string, n: number): string {
  const t = new Date((dayNumber(day) + n) * 86_400_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

export function parseTime(hhmm: string | undefined): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  const hour = m ? Math.min(23, Number(m[1])) : 9, minute = m ? Math.min(59, Number(m[2])) : 0;
  return { hour, minute };
}

export function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000 + 1;     // intero positivo a 32 bit (Android)
}

export function formatMoney(amount: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// ── Regole ─────────────────────────────────────────────────────────────────

/** Movimenti ricorrenti (mensili) che cadono in `day`: stesso giorno del mese dell'ultima occorrenza. */
export function recurringDue(transactions: PlannerTx[], day: string): PlannerTx[] {
  const latest = new Map<string, PlannerTx>();
  for (const t of transactions) {
    if (!t.isRecurring) continue;
    const key = t.recurringId || `${t.type}|${t.title.trim().toLowerCase()}|${t.category}`;
    const prev = latest.get(key);
    if (!prev || t.date > prev.date) latest.set(key, t);
  }
  const [y, m, d] = day.split('-').map(Number);
  return [...latest.values()].filter(t => {
    const last = t.date.slice(0, 10);
    if (last >= day) return false;                       // già registrato questo mese (o nel futuro)
    if (dayNumber(day) - dayNumber(last) < 20) return false;
    const want = Number(last.slice(8, 10));
    return Math.min(want, daysInMonth(y, m)) === d;
  });
}

/** Budget del mese di `day` oltre la soglia di avviso (default 80%). */
export function budgetsOver(input: PlannerInput, day: string): { budget: PlannerBudget; spent: number; pct: number }[] {
  const month = day.slice(0, 7);
  const spentBy: Record<string, number> = {};
  for (const t of input.transactions) {
    if (t.type === 'expense' && t.date.startsWith(month)) spentBy[t.category] = (spentBy[t.category] ?? 0) + t.amount;
  }
  return input.budgets
    .filter(b => b.amount > 0)
    .map(b => {
      const spent = spentBy[b.categoryId] ?? 0;
      return { budget: b, spent, pct: Math.round((spent / b.amount) * 100) };
    })
    .filter(x => x.pct >= (x.budget.alertThreshold || 80));
}

/** Obiettivi non raggiunti con scadenza entro `days` giorni (o scaduti da poco). */
export function goalsDue(goals: PlannerGoal[], day: string, days: number): { goal: PlannerGoal; left: number }[] {
  return goals
    .filter(g => g.deadline && g.currentAmount < g.targetAmount)
    .map(g => ({ goal: g, left: dayNumber(g.deadline!) - dayNumber(day) }))
    .filter(x => x.left >= -3 && x.left <= days);
}

/** Notifiche da mostrare nel giorno indicato, già ordinate per importanza. */
export function notificationsForDay(input: PlannerInput, prefs: PlannerPrefs, day: string): PlannedNotification[] {
  if (!prefs.notificationsEnabled) return [];
  const cur = prefs.defaultCurrency || 'EUR';
  const name = (id: string) => input.categoryName?.(id) || id;
  const out: PlannedNotification[] = [];

  if (prefs.notifyRecurring) {
    const due = recurringDue(input.transactions, day);
    if (due.length === 1) {
      const t = due[0];
      out.push({
        id: hash(`rec|${day}|${t.id}`), day, kind: 'recurring',
        title: t.type === 'income' ? '💶 Entrata ricorrente prevista oggi' : '🔁 Pagamento ricorrente oggi',
        body: `${t.title}: ${formatMoney(t.amount, cur)}. Ricordati di registrarlo.`,
      });
    } else if (due.length > 1) {
      out.push({
        id: hash(`rec|${day}`), day, kind: 'recurring',
        title: `🔁 ${due.length} movimenti ricorrenti oggi`,
        body: due.slice(0, 4).map(t => `${t.title} (${formatMoney(t.amount, cur)})`).join(', ')
          + (due.length > 4 ? '…' : ''),
      });
    }
  }

  if (prefs.budgetAlertEnabled) {
    const over = budgetsOver(input, day);
    if (over.length) {
      const exceeded = over.filter(x => x.pct >= 100);
      out.push({
        id: hash(`bud|${day}`), day, kind: 'budget',
        title: exceeded.length ? '⚠️ Budget superato' : '📊 Budget quasi esaurito',
        body: over.slice(0, 4).map(x => `${name(x.budget.categoryId)} ${x.pct}%`).join(', ')
          + ` del budget mensile${over.length > 4 ? '…' : ''}`,
      });
    }
  }

  if (prefs.notifyGoals) {
    for (const { goal, left } of goalsDue(input.goals, day, prefs.goalAlertDays).slice(0, 3)) {
      const missing = formatMoney(goal.targetAmount - goal.currentAmount, cur);
      out.push({
        id: hash(`goal|${day}|${goal.id}`), day, kind: 'goal',
        title: left < 0 ? `🎯 Obiettivo scaduto: ${goal.name}` : left === 0 ? `🎯 Scade oggi: ${goal.name}` : `🎯 ${goal.name}: mancano ${left} giorni`,
        body: `Ti mancano ${missing} per raggiungerlo.`,
      });
    }
  }
  return out;
}

/** Notifiche dei prossimi `horizon` giorni (Android le pianifica in anticipo). */
export function planNotifications(input: PlannerInput, prefs: PlannerPrefs, today: string, horizon: number,
                                  skipToday: boolean): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  for (let i = skipToday ? 1 : 0; i < horizon; i++) {
    const day = addDays(today, i);
    // Budget e obiettivi dipendono dalle spese future (sconosciute): si pianificano solo per oggi/domani.
    const n = notificationsForDay(input, prefs, day).filter(x => x.kind === 'recurring' || i <= 1);
    out.push(...n);
  }
  return out;
}

// ── Wallet condivisi ───────────────────────────────────────────────────────

export interface WalletChangeSummary {
  walletName: string;
  by: string;
  currency: string;
  added: { title: string; amount: number }[];
  changed: { title: string; amount: number }[];
  cards: { store: string }[];
}

/** Testo della notifica quando un altro membro aggiunge/modifica spese o condivide carte. */
export function walletChangeMessage(s: WalletChangeSummary, prefs: PlannerPrefs): { title: string; body: string } | null {
  const parts: string[] = [];
  const exp = prefs.notifyWalletExpenses;
  const fmt = (x: { title: string; amount: number }) => `${x.title} (${formatMoney(x.amount, s.currency)})`;
  if (exp && s.added.length === 1) parts.push(`ha aggiunto ${fmt(s.added[0])}`);
  else if (exp && s.added.length > 1) parts.push(`ha aggiunto ${s.added.length} spese: ${s.added.slice(0, 3).map(fmt).join(', ')}${s.added.length > 3 ? '…' : ''}`);
  if (exp && s.changed.length === 1) parts.push(`ha modificato ${fmt(s.changed[0])}`);
  else if (exp && s.changed.length > 1) parts.push(`ha modificato ${s.changed.length} spese`);
  if (prefs.notifyLoyaltyCards && s.cards.length === 1) parts.push(`ha condiviso la carta ${s.cards[0].store}`);
  else if (prefs.notifyLoyaltyCards && s.cards.length > 1) parts.push(`ha condiviso ${s.cards.length} carte fedeltà`);
  if (!parts.length) return null;
  return { title: `👛 ${s.walletName}`, body: `${s.by} ${parts.join(' e ')}` };
}
