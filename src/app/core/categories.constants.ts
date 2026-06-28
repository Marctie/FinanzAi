import { Category } from '../models/category.model';

export const DEFAULT_CATEGORIES: Category[] = [
  // ─── Uscite ────────────────────────────────────────────────────────────────
  {
    id: 'spesa',
    name: 'Spesa',
    emoji: '🛒',
    type: 'expense',
    color: '#e67e22',
    keywords: ['esselunga', 'carrefour', 'lidl', 'conad', 'coop', 'pam', 'aldi', 'eurospin', 'spesa', 'supermercato', 'iper'],
    isCustom: false,
  },
  {
    id: 'ristorante',
    name: 'Ristorante',
    emoji: '🍽️',
    type: 'expense',
    color: '#e74c3c',
    keywords: ['ristorante', 'pizzeria', 'trattoria', 'osteria', 'bar', 'caffè', 'bistrot', 'sushi', 'burger', 'mcdonald', 'kebab'],
    isCustom: false,
  },
  {
    id: 'trasporti',
    name: 'Trasporti',
    emoji: '🚗',
    type: 'expense',
    color: '#3498db',
    keywords: ['atm', 'atac', 'trenitalia', 'italo', 'flixbus', 'uber', 'bolt', 'free2move', 'benzina', 'carburante', 'parcheggio', 'autostrada', 'pedaggio'],
    isCustom: false,
  },
  {
    id: 'abbonamenti',
    name: 'Abbonamenti',
    emoji: '📱',
    type: 'expense',
    color: '#9b59b6',
    keywords: ['netflix', 'spotify', 'amazon prime', 'disney', 'apple', 'google', 'dazn', 'sky', 'wind', 'tim', 'vodafone', 'iliad', 'abbonamento'],
    isCustom: false,
  },
  {
    id: 'salute',
    name: 'Salute',
    emoji: '💊',
    type: 'expense',
    color: '#1abc9c',
    keywords: ['farmacia', 'medico', 'dentista', 'analisi', 'visita', 'ospedale', 'clinica', 'fisioterapia', 'ottico'],
    isCustom: false,
  },
  {
    id: 'casa',
    name: 'Casa',
    emoji: '🏠',
    type: 'expense',
    color: '#795548',
    keywords: ['affitto', 'mutuo', 'luce', 'gas', 'acqua', 'condominio', 'ikea', 'leroy', 'brico', 'pulizie'],
    isCustom: false,
  },
  {
    id: 'shopping',
    name: 'Shopping',
    emoji: '🛍️',
    type: 'expense',
    color: '#e91e63',
    keywords: ['zara', 'h&m', 'mango', 'zalando', 'primark', 'uniqlo', 'abbigliamento', 'scarpe', 'vestiti', 'amazon'],
    isCustom: false,
  },
  {
    id: 'svago',
    name: 'Svago',
    emoji: '🎬',
    type: 'expense',
    color: '#ff5722',
    keywords: ['cinema', 'teatro', 'concerto', 'museo', 'parco', 'palestra', 'fitness', 'sport', 'libro', 'giochi'],
    isCustom: false,
  },
  {
    id: 'viaggi',
    name: 'Viaggi',
    emoji: '✈️',
    type: 'expense',
    color: '#00bcd4',
    keywords: ['airbnb', 'booking', 'ryanair', 'easyjet', 'hotel', 'albergo', 'vacanza', 'volo', 'treno', 'autobus'],
    isCustom: false,
  },
  {
    id: 'istruzione',
    name: 'Istruzione',
    emoji: '📚',
    type: 'expense',
    color: '#607d8b',
    keywords: ['udemy', 'coursera', 'università', 'corso', 'libri', 'tasse', 'scuola', 'formazione'],
    isCustom: false,
  },
  {
    id: 'altro-uscita',
    name: 'Altro',
    emoji: '💸',
    type: 'expense',
    color: '#9e9e9e',
    keywords: [],
    isCustom: false,
  },

  // ─── Entrate ───────────────────────────────────────────────────────────────
  {
    id: 'stipendio',
    name: 'Stipendio',
    emoji: '💼',
    type: 'income',
    color: '#27ae60',
    keywords: ['stipendio', 'salario', 'paga', 'busta', 'accredito'],
    isCustom: false,
  },
  {
    id: 'freelance',
    name: 'Freelance',
    emoji: '💻',
    type: 'income',
    color: '#2ecc71',
    keywords: ['fattura', 'consulenza', 'progetto', 'cliente', 'freelance', 'partita iva'],
    isCustom: false,
  },
  {
    id: 'investimenti',
    name: 'Investimenti',
    emoji: '📈',
    type: 'income',
    color: '#1b6ca8',
    keywords: ['dividendi', 'etf', 'azioni', 'interessi', 'rendita'],
    isCustom: false,
  },
  {
    id: 'rimborso',
    name: 'Rimborso',
    emoji: '↩️',
    type: 'income',
    color: '#16a085',
    keywords: ['rimborso', 'restituzione', 'cashback', 'bonus'],
    isCustom: false,
  },
  {
    id: 'altro-entrata',
    name: 'Altro',
    emoji: '💰',
    type: 'income',
    color: '#f39c12',
    keywords: [],
    isCustom: false,
  },
];

export function getCategoryById(id: string): Category | undefined {
  return DEFAULT_CATEGORIES.find(c => c.id === id);
}

export function getCategoriesByType(type: 'income' | 'expense'): Category[] {
  return DEFAULT_CATEGORIES.filter(c => c.type === type || c.type === 'both');
}
