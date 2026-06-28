import { Component, Input, OnChanges } from '@angular/core';
import { MonthlyStats } from '../../services/analytics.service';

@Component({
  selector: 'app-mini-chart',
  templateUrl: './mini-chart.component.html',
  styleUrls: ['./mini-chart.component.scss'],
  standalone: false,
})
export class MiniChartComponent implements OnChanges {
  @Input() data: MonthlyStats[] = [];

  readonly W = 300;
  readonly H = 100;
  readonly BAR_GAP = 4;

  bars: { x: number; incomeH: number; expenseH: number; month: string }[] = [];
  maxVal = 0;

  ngOnChanges(): void {
    if (!this.data.length) return;
    this.maxVal = Math.max(...this.data.map(d => d.income).concat(this.data.map(d => d.expense)));
    const count    = this.data.length;
    const barW     = (this.W - this.BAR_GAP * (count + 1)) / count / 2;
    const labelH   = 18;
    const chartH   = this.H - labelH;

    this.bars = this.data.map((d, i) => {
      const groupW = (this.W - this.BAR_GAP * (count + 1)) / count;
      const x = this.BAR_GAP + i * (groupW + this.BAR_GAP);
      const incomeH  = this.maxVal ? (d.income  / this.maxVal) * (chartH - 4) : 0;
      const expenseH = this.maxVal ? (d.expense / this.maxVal) * (chartH - 4) : 0;
      return { x, incomeH, expenseH, month: d.month };
    });
  }

  barY(h: number): number {
    const labelH = 18;
    const chartH = this.H - labelH;
    return chartH - h;
  }

  get barWidth(): number {
    const count  = this.data.length;
    const groupW = (this.W - this.BAR_GAP * (count + 1)) / count;
    return groupW / 2 - 1;
  }
}
