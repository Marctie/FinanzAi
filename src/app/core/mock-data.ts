import { Transaction } from '../models/transaction.model';
import { Budget } from '../models/budget.model';
import { Goal } from '../models/goal.model';

const now = new Date();
const y = now.getFullYear();
const m = now.getMonth();

function d(daysAgo: number): string {
  const date = new Date(y, m, now.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

function prevMonth(daysAgo: number): string {
  const date = new Date(y, m - 1, daysAgo);
  return date.toISOString().split('T')[0];
}

export const MOCK_TRANSACTIONS: Transaction[] = [
  // ─── Questo mese ───────────────────────────────────────────────────────────
  { id: 't1',  type: 'income',  amount: 2800, currency: 'EUR', category: 'stipendio',    date: d(1),  title: 'Stipendio Giugno', notes: '', isRecurring: true, recurringId: 'r-stipendio', profileId: 'default' },
  { id: 't2',  type: 'expense', amount: 87.50, currency: 'EUR', category: 'spesa',        date: d(1),  title: 'Esselunga', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't3',  type: 'expense', amount: 45,   currency: 'EUR', category: 'ristorante',   date: d(2),  title: 'Pizzeria Da Enzo', notes: 'Cena con amici', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't4',  type: 'expense', amount: 13.99, currency: 'EUR', category: 'abbonamenti',  date: d(2),  title: 'Netflix', notes: '', isRecurring: true, recurringId: 'r-netflix', profileId: 'default' },
  { id: 't5',  type: 'expense', amount: 9.99,  currency: 'EUR', category: 'abbonamenti',  date: d(3),  title: 'Spotify', notes: '', isRecurring: true, recurringId: 'r-spotify', profileId: 'default' },
  { id: 't6',  type: 'expense', amount: 34,   currency: 'EUR', category: 'trasporti',    date: d(3),  title: 'Benzina IP', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't7',  type: 'expense', amount: 62,   currency: 'EUR', category: 'spesa',        date: d(5),  title: 'Carrefour', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't8',  type: 'income',  amount: 350,  currency: 'EUR', category: 'freelance',    date: d(5),  title: 'Progetto Web Marco R.', notes: 'Primo acconto', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't9',  type: 'expense', amount: 28,   currency: 'EUR', category: 'ristorante',   date: d(6),  title: 'Bar Centrale', notes: 'Pranzi settimana', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't10', type: 'expense', amount: 15,   currency: 'EUR', category: 'trasporti',    date: d(7),  title: 'ATM Abbonamento mensile', notes: '', isRecurring: true, recurringId: 'r-atm', profileId: 'default' },
  { id: 't11', type: 'expense', amount: 120,  currency: 'EUR', category: 'shopping',     date: d(8),  title: 'Zara', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't12', type: 'expense', amount: 22.50, currency: 'EUR', category: 'svago',        date: d(9),  title: 'Cinema Anteo + popcorn', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't13', type: 'expense', amount: 55,   currency: 'EUR', category: 'salute',       date: d(10), title: 'Farmacia', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't14', type: 'expense', amount: 48,   currency: 'EUR', category: 'spesa',        date: d(12), title: 'Lidl', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't15', type: 'expense', amount: 800,  currency: 'EUR', category: 'casa',         date: d(14), title: 'Affitto', notes: '', isRecurring: true, recurringId: 'r-affitto', profileId: 'default' },
  { id: 't16', type: 'expense', amount: 18.90, currency: 'EUR', category: 'ristorante',   date: d(15), title: 'McDonald\'s', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't17', type: 'income',  amount: 80,   currency: 'EUR', category: 'rimborso',     date: d(16), title: 'Rimborso spese lavoro', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't18', type: 'expense', amount: 39,   currency: 'EUR', category: 'istruzione',   date: d(18), title: 'Udemy - Corso Angular', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't19', type: 'expense', amount: 72,   currency: 'EUR', category: 'spesa',        date: d(20), title: 'Esselunga', notes: 'Spesa settimanale', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't20', type: 'expense', amount: 5.90,  currency: 'EUR', category: 'svago',        date: d(21), title: 'Spotify Podcast+', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },

  // ─── Mese scorso ───────────────────────────────────────────────────────────
  { id: 't21', type: 'income',  amount: 2800, currency: 'EUR', category: 'stipendio',    date: prevMonth(1),  title: 'Stipendio Maggio', notes: '', isRecurring: true, recurringId: 'r-stipendio', profileId: 'default' },
  { id: 't22', type: 'expense', amount: 95,   currency: 'EUR', category: 'spesa',        date: prevMonth(3),  title: 'Esselunga', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't23', type: 'expense', amount: 68,   currency: 'EUR', category: 'ristorante',   date: prevMonth(5),  title: 'Trattoria Milanese', notes: 'Cena di compleanno', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't24', type: 'expense', amount: 13.99, currency: 'EUR', category: 'abbonamenti',  date: prevMonth(5),  title: 'Netflix', notes: '', isRecurring: true, recurringId: 'r-netflix', profileId: 'default' },
  { id: 't25', type: 'expense', amount: 800,  currency: 'EUR', category: 'casa',         date: prevMonth(6),  title: 'Affitto', notes: '', isRecurring: true, recurringId: 'r-affitto', profileId: 'default' },
  { id: 't26', type: 'expense', amount: 42,   currency: 'EUR', category: 'trasporti',    date: prevMonth(8),  title: 'Benzina Q8', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't27', type: 'expense', amount: 245,  currency: 'EUR', category: 'viaggi',       date: prevMonth(10), title: 'Ryanair Roma-Barcellona', notes: 'Vacanza fine maggio', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't28', type: 'income',  amount: 500,  currency: 'EUR', category: 'freelance',    date: prevMonth(12), title: 'Consulenza UI Design', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't29', type: 'expense', amount: 89,   currency: 'EUR', category: 'shopping',     date: prevMonth(15), title: 'H&M', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
  { id: 't30', type: 'expense', amount: 55,   currency: 'EUR', category: 'spesa',        date: prevMonth(20), title: 'Conad', notes: '', isRecurring: false, recurringId: null, profileId: 'default' },
];

export const MOCK_BUDGETS: Budget[] = [
  { id: 'b1', categoryId: 'spesa',       amount: 350, period: 'monthly', month: `${y}-${String(m + 1).padStart(2, '0')}`, alertThreshold: 80 },
  { id: 'b2', categoryId: 'ristorante',  amount: 150, period: 'monthly', month: `${y}-${String(m + 1).padStart(2, '0')}`, alertThreshold: 80 },
  { id: 'b3', categoryId: 'trasporti',   amount: 100, period: 'monthly', month: `${y}-${String(m + 1).padStart(2, '0')}`, alertThreshold: 80 },
  { id: 'b4', categoryId: 'abbonamenti', amount: 50,  period: 'monthly', month: `${y}-${String(m + 1).padStart(2, '0')}`, alertThreshold: 80 },
  { id: 'b5', categoryId: 'shopping',    amount: 200, period: 'monthly', month: `${y}-${String(m + 1).padStart(2, '0')}`, alertThreshold: 80 },
  { id: 'b6', categoryId: 'svago',       amount: 80,  period: 'monthly', month: `${y}-${String(m + 1).padStart(2, '0')}`, alertThreshold: 80 },
];

export const MOCK_GOALS: Goal[] = [
  { id: 'g1', name: 'Fondo Emergenza',  targetAmount: 5000, currentAmount: 2200, deadline: `${y + 1}-06-01`, category: 'investimenti', color: '#27ae60' },
  { id: 'g2', name: 'Vacanza Estate',   targetAmount: 1500, currentAmount: 650,  deadline: `${y}-08-01`,    category: 'viaggi',       color: '#1b6ca8' },
  { id: 'g3', name: 'Nuovo MacBook',    targetAmount: 1800, currentAmount: 400,  deadline: `${y}-12-25`,    category: 'shopping',     color: '#9b59b6' },
];

export const MOCK_MONTHLY_TREND = [
  { month: 'Gen', income: 2800, expense: 1680 },
  { month: 'Feb', income: 2800, expense: 1920 },
  { month: 'Mar', income: 3150, expense: 2100 },
  { month: 'Apr', income: 2800, expense: 1750 },
  { month: 'Mag', income: 3300, expense: 2380 },
  { month: 'Giu', income: 3230, expense: 1417 },
];
