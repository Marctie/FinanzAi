/**
 * Importazione dei backup ".mmbackup" (app Money Manager: ZIP con un piccolo prefisso, che contiene il database
 * SQLite "MyFinance.db"). Modulo PURO: riceve una funzione `query` che esegue SQL e restituisce righe, così funziona
 * con sql.js nel browser e con node:sqlite nei test. Tutto avviene sul dispositivo: niente viene inviato a server.
 *
 * Mappatura:
 * - importi in centesimi → euro; movimenti cancellati (isRemoved) esclusi;
 * - categoria e conto del movimento tramite la tabella sync_link;
 * - categorie predefinite dell'app di origine (titolo vuoto) riconosciute dall'icona;
 * - limiti di categoria (limitAmount) → budget mensili;
 * - pagamenti periodici (reminding → regular_payment_period → transaction) → movimenti ricorrenti;
 * - id stabili "mm-<uid>": reimportare lo stesso file aggiorna invece di duplicare.
 */

export type Query = (sql: string) => Record<string, unknown>[];

export interface MmCategory {
  uid: string;
  title: string;              // nome mostrato (per le predefinite ricavato dall'icona)
  original: string;           // titolo originale ('' per le predefinite)
  icon: string;
  type: 'income' | 'expense';
  color: string;
  limit: number;              // euro, 0 = nessun limite
  count: number;              // movimenti attivi in questa categoria
}

export interface MmTransaction {
  uid: string;
  type: 'income' | 'expense';
  amount: number;             // euro
  currency: string;
  date: string;               // AAAA-MM-GG
  comment: string;
  categoryUid: string | null;
  accountTitle: string;
  recurringUid: string | null;
  recurringTitle: string | null;
}

export interface MmData {
  categories: MmCategory[];
  transactions: MmTransaction[];
  firstDate: string;
  lastDate: string;
  income: number;
  expense: number;
}

/** Nomi delle categorie predefinite dell'app di origine (titolo vuoto), per icona e tipo. */
const DEFAULT_NAMES: Record<string, string> = {
  'expense:products': 'Spesa alimentare', 'expense:cafe': 'Bar e ristoranti', 'expense:transport': 'Trasporti',
  'expense:home': 'Casa', 'expense:heart': 'Salute', 'expense:education': 'Istruzione', 'expense:purse': 'Abbigliamento',
  'expense:present': 'Regali', 'expense:other': 'Altro', 'expense:sport': 'Sport', 'expense:car': 'Auto',
  'expense:pets': 'Animali', 'expense:entertainment': 'Svago', 'expense:communication': 'Telefono e internet',
  'expense:hygiene': 'Igiene', 'expense:clothes': 'Abbigliamento', 'expense:taxi': 'Taxi', 'expense:eating_out': 'Bar e ristoranti',
  'income:bank': 'Depositi', 'income:prepaid': 'Stipendio', 'income:present': 'Regali ricevuti', 'income:other': 'Altro',
  'income:salary': 'Stipendio', 'income:savings': 'Risparmi',
};

/** Categoria FinanzAI proposta per le categorie dell'app di origine (per icona). null = crearne una nuova. */
const DEFAULT_TARGETS: Record<string, string> = {
  'expense:products': 'spesa', 'expense:cafe': 'ristorante', 'expense:eating_out': 'ristorante', 'expense:transport': 'trasporti',
  'expense:taxi': 'trasporti', 'expense:car': 'trasporti', 'expense:canister': 'trasporti', 'expense:home': 'casa',
  'expense:building': 'casa', 'expense:heart': 'salute', 'expense:medicine': 'salute', 'expense:education': 'istruzione',
  'expense:purse': 'shopping', 'expense:clothes': 'shopping', 'expense:entertainment': 'svago', 'expense:games': 'abbonamenti',
  'expense:travels': 'viaggi', 'expense:other': 'altro-uscita',
  'income:prepaid': 'stipendio', 'income:salary': 'stipendio', 'income:bank': 'investimenti', 'income:other': 'altro-entrata',
};

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const typ = (v: unknown): 'income' | 'expense' => (str(v).toLowerCase() === 'income' ? 'income' : 'expense');

/** Colore ARGB intero (es. 4293553944) → "#rrggbb". */
export function argbToHex(v: unknown): string {
  const n = num(v);
  if (!n) return '#9e9e9e';
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}

/** Trova il database dentro il file: salta il prefisso prima dello ZIP e restituisce i byte di MyFinance.db. */
export function extractDatabase(file: Uint8Array, unzip: (zip: Uint8Array) => Record<string, Uint8Array>): Uint8Array {
  let start = -1;
  for (let i = 0; i < Math.min(file.length - 4, 4096); i++) {
    if (file[i] === 0x50 && file[i + 1] === 0x4b && file[i + 2] === 0x03 && file[i + 3] === 0x04) { start = i; break; }
  }
  if (start < 0) {
    // Forse è già il database SQLite
    if (new TextDecoder().decode(file.slice(0, 15)) === 'SQLite format 3') return file;
    throw new Error('Il file non sembra un backup di Money Manager (.mmbackup)');
  }
  const files = unzip(file.slice(start));
  const db = Object.entries(files).find(([name]) => /\.db$/i.test(name) && !name.includes('/'))?.[1];
  if (!db) throw new Error('Nel backup non c\'è il database dei movimenti');
  return db;
}

export function readMmData(query: Query): MmData {
  const tables = new Set(query(`select name from sqlite_master where type = 'table'`).map(r => str(r['name'])));
  for (const t of ['transaction', 'category', 'sync_link']) {
    if (!tables.has(t)) throw new Error('Formato del backup non riconosciuto (manca la tabella ' + t + ')');
  }

  const link = (entity: string, other: string) => {
    const m = new Map<string, string>();
    for (const r of query(`select entityUid, otherUid from sync_link
                           where entityType = '${entity}' and otherType = '${other}' and isRemoved = 0`)) {
      m.set(str(r['entityUid']), str(r['otherUid']));
    }
    return m;
  };
  const txCategory = link('Transaction', 'Category');
  const txAccount = link('Transaction', 'Account');

  // Pagamenti periodici: reminding → regular_payment_period → transaction
  const periodToReminder = new Map<string, string>();
  for (const r of query(`select entityUid, otherUid from sync_link where entityType = 'Reminding'
                         and otherType = 'RegularPaymentPeriod' and isRemoved = 0`)) {
    periodToReminder.set(str(r['otherUid']), str(r['entityUid']));
  }
  const txReminder = new Map<string, string>();
  for (const r of query(`select entityUid, otherUid from sync_link where entityType = 'RegularPaymentPeriod'
                         and otherType = 'Transaction' and isRemoved = 0`)) {
    const rem = periodToReminder.get(str(r['entityUid']));
    if (rem) txReminder.set(str(r['otherUid']), rem);
  }
  const reminderTitle = new Map<string, string>();
  if (tables.has('reminding')) {
    for (const r of query(`select uid, title from reminding`)) reminderTitle.set(str(r['uid']), str(r['title']));
  }
  const accountTitle = new Map<string, string>();
  if (tables.has('account')) {
    for (const r of query(`select uid, title from account`)) accountTitle.set(str(r['uid']), str(r['title']));
  }

  const transactions: MmTransaction[] = query(`select uid, type, amountInAccountCurrency, amountInDefaultCurrency,
      accountCurrencyCode, date, comment from "transaction" where isRemoved = 0 order by date`).map(r => {
    const uid = str(r['uid']);
    const cents = num(r['amountInAccountCurrency']) || num(r['amountInDefaultCurrency']);
    const rem = txReminder.get(uid) ?? null;
    return {
      uid,
      type: typ(r['type']),
      amount: Math.round(Math.abs(cents)) / 100,
      currency: str(r['accountCurrencyCode']) || 'EUR',
      date: str(r['date']).slice(0, 10),
      comment: str(r['comment']).trim(),
      categoryUid: txCategory.get(uid) ?? null,
      accountTitle: accountTitle.get(txAccount.get(uid) ?? '') ?? '',
      recurringUid: rem,
      recurringTitle: rem ? (reminderTitle.get(rem) || null) : null,
    };
  });

  const counts = new Map<string, number>();
  transactions.forEach(t => { if (t.categoryUid) counts.set(t.categoryUid, (counts.get(t.categoryUid) ?? 0) + 1); });

  const categories: MmCategory[] = query(`select uid, title, type, icon, color, limitAmount from category
      where isRemoved = 0 order by position`).map(r => {
    const type = typ(r['type']);
    const icon = str(r['icon']);
    const original = str(r['title']).trim();
    return {
      uid: str(r['uid']),
      title: original || DEFAULT_NAMES[`${type}:${icon}`] || (type === 'income' ? 'Entrata' : 'Uscita') + ` (${icon || 'senza nome'})`,
      original,
      icon,
      type,
      color: argbToHex(r['color']),
      limit: Math.round(num(r['limitAmount'])) / 100,
      count: counts.get(str(r['uid'])) ?? 0,
    };
  }).sort((a, b) => b.count - a.count);

  const dates = transactions.map(t => t.date).filter(Boolean).sort();
  return {
    categories,
    transactions,
    firstDate: dates[0] ?? '',
    lastDate: dates[dates.length - 1] ?? '',
    income: transactions.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0),
    expense: transactions.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0),
  };
}

// ── Conversione nei dati di FinanzAI ─────────────────────────────────────────

export interface TargetCategory { id: string; name: string; type: 'income' | 'expense' | 'both' }

/** Destinazione di ogni categoria d'origine: id di una categoria FinanzAI esistente, oppure "new" (crearla). */
export type CategoryMapping = Record<string, string>;
export const NEW_CATEGORY = 'new';

export function defaultMapping(cats: MmCategory[], targets: TargetCategory[]): CategoryMapping {
  const norm = (s: string) => s.trim().toLowerCase();
  const out: CategoryMapping = {};
  for (const c of cats) {
    const compatible = targets.filter(t => t.type === c.type || t.type === 'both');
    const sameName = compatible.find(t => norm(t.name) === norm(c.title));
    const byIcon = c.original ? undefined : DEFAULT_TARGETS[`${c.type}:${c.icon}`];
    out[c.uid] = sameName?.id ?? (byIcon && compatible.some(t => t.id === byIcon) ? byIcon : NEW_CATEGORY);
  }
  return out;
}

const ICON_EMOJI: Record<string, string> = {
  products: '🛒', cafe: '☕', transport: '🚌', home: '🏠', heart: '❤️', education: '📚', purse: '👛', present: '🎁',
  other: '📦', sport: '⚽', car: '🚗', canister: '⛽', cigarettes: '🚬', games: '🎮', medicine: '💊', building: '🏢',
  sale: '🧾', travels: '✈️', prepaid: '💳', bank: '🏦', repairs: '🛠️',
};

export interface ImportOptions {
  budgets: boolean;          // limiti di categoria → budget mensili
  recurring: boolean;        // pagamenti periodici → movimenti ricorrenti
  month: string;             // AAAA-MM per i budget
}

export interface ImportResult {
  newCategories: { id: string; name: string; emoji: string; type: 'income' | 'expense'; color: string; keywords: string[]; isCustom: true }[];
  transactions: {
    id: string; type: 'income' | 'expense'; amount: number; currency: string; category: string; date: string;
    title: string; notes: string; paymentMethod?: 'carta-credito' | 'carta-debito' | 'contanti'; isRecurring: boolean;
    recurringId: string | null; profileId: string;
  }[];
  budgets: { id: string; categoryId: string; amount: number; period: 'monthly'; month: string; alertThreshold: number }[];
}

export function buildImport(data: MmData, mapping: CategoryMapping, opts: ImportOptions): ImportResult {
  const catId = new Map<string, string>();
  const newCategories: ImportResult['newCategories'] = [];
  for (const c of data.categories) {
    const target = mapping[c.uid] ?? NEW_CATEGORY;
    if (target === NEW_CATEGORY) {
      const id = `custom-mm-${c.uid}`;
      newCategories.push({ id, name: c.title.slice(0, 30), emoji: ICON_EMOJI[c.icon] ?? (c.type === 'income' ? '💰' : '💸'),
        type: c.type, color: c.color, keywords: [], isCustom: true });
      catId.set(c.uid, id);
    } else {
      catId.set(c.uid, target);
    }
  }
  const catName = new Map(data.categories.map(c => [c.uid, c.title]));
  const fallback = (t: 'income' | 'expense') => (t === 'income' ? 'altro-entrata' : 'altro-uscita');
  const method = (account: string) => {
    const a = account.toLowerCase();
    return a.includes('credit') ? 'carta-credito' as const : a.includes('debit') ? 'carta-debito' as const
      : a.includes('contant') || a.includes('cash') ? 'contanti' as const : undefined;
  };

  const transactions: ImportResult['transactions'] = data.transactions.filter(t => t.amount > 0 && t.date).map(t => {
    const recurring = opts.recurring && !!t.recurringUid;
    return {
      id: `mm-${t.uid}`,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      category: (t.categoryUid && catId.get(t.categoryUid)) || fallback(t.type),
      date: t.date,
      title: (t.comment || t.recurringTitle || (t.categoryUid ? catName.get(t.categoryUid) : '') || (t.type === 'income' ? 'Entrata' : 'Uscita')).slice(0, 80),
      notes: '',
      ...(method(t.accountTitle) ? { paymentMethod: method(t.accountTitle) } : {}),
      isRecurring: recurring,
      recurringId: recurring ? `mm-${t.recurringUid}` : null,
      profileId: 'default',
    };
  });

  const budgets: ImportResult['budgets'] = [];
  if (opts.budgets) {
    const seen = new Set<string>();
    for (const c of data.categories) {
      const id = catId.get(c.uid);
      if (c.type !== 'expense' || c.limit <= 0 || !id || seen.has(id)) continue;
      seen.add(id);
      budgets.push({ id: `mm-budget-${c.uid}`, categoryId: id, amount: c.limit, period: 'monthly', month: opts.month, alertThreshold: 80 });
    }
  }
  return { newCategories, transactions, budgets };
}
