import type { ExpenseShare, MemberBalance, Settlement, SharedExpense, SplitMode } from '../models/wallet.model';

/** Arrotonda ai centesimi evitando gli errori dei numeri in virgola mobile. */
export const cents = (n: number) => Math.round(n * 100);
export const fromCents = (c: number) => c / 100;

/**
 * Quanto deve ciascun partecipante per una spesa, in centesimi.
 * - equal:   importo diviso in parti uguali; i centesimi avanzati vanno ai primi partecipanti;
 * - percent: value = percentuale (la somma deve essere 100);
 * - amount:  value = importo in valuta (la somma deve essere uguale al totale).
 * Il risultato somma sempre esattamente al totale.
 */
export function splitExpense(amount: number, mode: SplitMode, shares: ExpenseShare[]): Map<string, number> {
  const total = cents(amount);
  const out = new Map<string, number>();
  const people = shares.filter(s => mode === 'equal' || s.value > 0);
  if (!people.length || total === 0) return out;

  let raw: number[];
  if (mode === 'equal') raw = people.map(() => total / people.length);
  else if (mode === 'percent') {
    const sum = people.reduce((a, s) => a + s.value, 0) || 1;
    raw = people.map(s => total * s.value / sum);
  } else {
    const sum = people.reduce((a, s) => a + cents(s.value), 0) || 1;
    raw = people.map(s => total * cents(s.value) / sum);
  }
  // Metodo dei resti maggiori: si arrotonda per difetto e si distribuiscono i centesimi mancanti.
  const floor = raw.map(Math.floor);
  let rest = total - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) { if (rest <= 0) break; floor[i]++; rest--; }
  people.forEach((s, i) => out.set(s.userId, (out.get(s.userId) ?? 0) + floor[i]));
  return out;
}

/** Controlla la suddivisione prima del salvataggio. @returns messaggio d'errore oppure null. */
export function validateSplit(amount: number, mode: SplitMode, shares: ExpenseShare[]): string | null {
  if (!(amount > 0)) return 'Inserisci un importo maggiore di zero';
  const active = shares.filter(s => mode === 'equal' || s.value > 0);
  if (!active.length) return 'Scegli almeno una persona tra cui dividere la spesa';
  if (mode === 'percent') {
    const sum = active.reduce((a, s) => a + s.value, 0);
    if (Math.abs(sum - 100) > 0.01) return `Le percentuali sommano a ${+sum.toFixed(2)}%: devono fare 100%`;
  }
  if (mode === 'amount') {
    const sum = active.reduce((a, s) => a + cents(s.value), 0);
    if (sum !== cents(amount)) return `Le quote sommano a ${fromCents(sum).toFixed(2)}: devono fare ${amount.toFixed(2)}`;
  }
  return null;
}

/** Saldi dei membri: pagato, dovuto e netto (positivo = deve ricevere). */
export function computeBalances(expenses: SharedExpense[], memberIds: string[]): MemberBalance[] {
  const paid = new Map<string, number>(), owed = new Map<string, number>();
  for (const id of memberIds) { paid.set(id, 0); owed.set(id, 0); }
  for (const e of expenses) {
    paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + cents(e.amount));
    for (const [uid, c] of splitExpense(e.amount, e.splitMode, e.shares)) owed.set(uid, (owed.get(uid) ?? 0) + c);
  }
  const ids = new Set([...memberIds, ...paid.keys(), ...owed.keys()]);
  return [...ids].map(userId => {
    const p = paid.get(userId) ?? 0, o = owed.get(userId) ?? 0;
    return { userId, paid: fromCents(p), owed: fromCents(o), net: fromCents(p - o) };
  });
}

/**
 * "Chi deve a chi" con il minor numero di passaggi (algoritmo goloso: il debitore più grande paga
 * il creditore più grande). Restituisce importi in valuta.
 */
export function simplifyDebts(balances: MemberBalance[]): Settlement[] {
  const debtors = balances.filter(b => cents(b.net) < 0).map(b => ({ id: b.userId, c: -cents(b.net) }));
  const creditors = balances.filter(b => cents(b.net) > 0).map(b => ({ id: b.userId, c: cents(b.net) }));
  const out: Settlement[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.c - a.c || a.id.localeCompare(b.id));
    creditors.sort((a, b) => b.c - a.c || a.id.localeCompare(b.id));
    const d = debtors[0], cr = creditors[0];
    const x = Math.min(d.c, cr.c);
    out.push({ from: d.id, to: cr.id, amount: fromCents(x) });
    d.c -= x; cr.c -= x;
    if (!d.c) debtors.shift();
    if (!cr.c) creditors.shift();
  }
  return out;
}
