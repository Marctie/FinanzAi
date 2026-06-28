import { Injectable } from '@angular/core';
import { DEFAULT_CATEGORIES, getCategoryById } from '../core/categories.constants';
import { Transaction } from '../models/transaction.model';
import { AnalyticsService } from './analytics.service';

export interface AiInsight {
  id: string;
  icon: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'success' | 'tip';
}

@Injectable({ providedIn: 'root' })
export class AiService {
  constructor(private analytics: AnalyticsService) {}

  suggestCategory(title: string, type: 'income' | 'expense'): string {
    const lower = title.toLowerCase();
    const candidates = DEFAULT_CATEGORIES.filter(c => c.type === type || c.type === 'both');
    for (const cat of candidates) {
      if (cat.keywords.some(kw => lower.includes(kw))) return cat.id;
    }
    return type === 'income' ? 'altro-entrata' : 'altro-uscita';
  }

  generateInsights(transactions: Transaction[]): AiInsight[] {
    const insights: AiInsight[] = [];
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonth    = (() => {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    const thisMonthTx = transactions.filter(t => t.date.startsWith(currentMonth));
    const prevMonthTx = transactions.filter(t => t.date.startsWith(prevMonth));

    const totalExpenseThis = this.analytics.totalExpense(thisMonthTx);
    const totalExpensePrev = this.analytics.totalExpense(prevMonthTx);

    // Confronto mese precedente
    if (totalExpensePrev > 0) {
      const diff = totalExpenseThis - totalExpensePrev;
      const pct  = Math.abs(Math.round((diff / totalExpensePrev) * 100));
      if (Math.abs(diff) > 50) {
        insights.push({
          id: 'monthly-compare',
          icon: diff > 0 ? '📈' : '📉',
          title: diff > 0 ? 'Spese in aumento' : 'Ottimo controllo spese',
          body: diff > 0
            ? `Questo mese hai speso ${pct}% in più rispetto al mese scorso (€${Math.abs(diff).toFixed(0)} in più).`
            : `Stai spendendo ${pct}% in meno rispetto al mese scorso. Ottimo lavoro!`,
          type: diff > 0 ? 'warning' : 'success',
        });
      }
    }

    // Categoria con crescita maggiore
    const byCategory = this.analytics.expenseByCategory(thisMonthTx);
    const byPrev     = this.analytics.expenseByCategory(prevMonthTx);
    let topGrowthCat = '';
    let topGrowth    = 0;
    for (const [cat, amount] of Object.entries(byCategory)) {
      const prevAmt = byPrev[cat] ?? 0;
      if (prevAmt > 0 && amount - prevAmt > topGrowth) {
        topGrowth    = amount - prevAmt;
        topGrowthCat = cat;
      }
    }
    if (topGrowthCat && topGrowth > 20) {
      const catObj = getCategoryById(topGrowthCat);
      insights.push({
        id: 'top-growth',
        icon: catObj?.emoji ?? '💸',
        title: `Attenzione a "${catObj?.name ?? topGrowthCat}"`,
        body: `Hai speso €${topGrowth.toFixed(0)} in più in questa categoria rispetto al mese scorso.`,
        type: 'warning',
      });
    }

    // Risparmio mensile
    const income  = this.analytics.totalIncome(thisMonthTx);
    const expense = totalExpenseThis;
    if (income > 0) {
      const savingsRate = Math.round(((income - expense) / income) * 100);
      insights.push({
        id: 'savings-rate',
        icon: savingsRate >= 20 ? '🏆' : savingsRate >= 10 ? '💪' : '⚠️',
        title: 'Tasso di risparmio',
        body: savingsRate >= 20
          ? `Stai risparmiando il ${savingsRate}% del tuo reddito. Eccellente!`
          : savingsRate >= 10
          ? `Stai risparmiando il ${savingsRate}% del reddito. Continua così.`
          : `Stai risparmiando solo il ${savingsRate}% del reddito. Prova a ridurre le spese voluttuarie.`,
        type: savingsRate >= 20 ? 'success' : savingsRate >= 10 ? 'info' : 'warning',
      });
    }

    // Abbonamenti
    const subscriptions = thisMonthTx.filter(t => t.category === 'abbonamenti' && t.type === 'expense');
    const subTotal = subscriptions.reduce((s, t) => s + t.amount, 0);
    if (subTotal > 30) {
      insights.push({
        id: 'subscriptions',
        icon: '📱',
        title: `${subscriptions.length} abbonamenti attivi`,
        body: `Stai spendendo €${subTotal.toFixed(2)} al mese in abbonamenti. Controlla se li usi tutti.`,
        type: 'tip',
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: 'no-data',
        icon: '💡',
        title: 'Aggiungi transazioni',
        body: 'Inizia a registrare le tue spese per ricevere suggerimenti personalizzati.',
        type: 'info',
      });
    }

    return insights;
  }

  forecastEndOfMonth(transactions: Transaction[]): number {
    const now  = new Date();
    const day  = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisTx = transactions.filter(t => t.date.startsWith(month));

    const income  = this.analytics.totalIncome(thisTx);
    const expense = this.analytics.totalExpense(thisTx);
    const dailySpend = day > 0 ? expense / day : 0;
    const projectedExpense = dailySpend * daysInMonth;

    return income - projectedExpense;
  }
}
