import { Pipe, PipeTransform } from '@angular/core';
import { formatMoney } from '../../notifications/planner';

/** Importo in valuta con formato italiano (es. 1.234,50 €), senza dipendere dai dati di locale di Angular. */
@Pipe({ name: 'money', standalone: false })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, currency = 'EUR'): string {
    return value === null || value === undefined ? '' : formatMoney(value, currency);
  }
}
