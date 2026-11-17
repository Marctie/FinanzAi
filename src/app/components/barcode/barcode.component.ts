import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import * as JsBarcodeNs from 'jsbarcode';
import { toCanvas } from 'qrcode';
import { BarcodeFormat } from '../../models/loyalty-card.model';

// jsbarcode è un modulo CommonJS: a seconda del bundler la funzione è l'export stesso o il suo default.
const JsBarcode: (el: Element, value: string, opts: object) => void =
  ((JsBarcodeNs as any).default ?? JsBarcodeNs) as any;

/** Disegna il codice della carta (a barre o QR) su sfondo bianco, leggibile dai lettori alla cassa. */
@Component({
  selector: 'app-barcode',
  template: `
    <div class="barcode-wrap" [class.large]="large">
      <svg #svg [hidden]="format === 'QR' || format === 'NONE' || failed" aria-hidden="true"></svg>
      <canvas #canvas [hidden]="format !== 'QR' || failed" aria-hidden="true"></canvas>
      <p class="barcode-number" [class.big]="format === 'NONE' || failed">{{ value }}</p>
      <p class="barcode-note" *ngIf="fallback">Formato non valido per questo numero: mostrato come Code 128</p>
    </div>`,
  standalone: false,
})
export class BarcodeComponent implements AfterViewInit, OnChanges {
  @Input() value = '';
  @Input() format: BarcodeFormat = 'CODE128';
  @Input() large = false;
  @ViewChild('svg') svg?: ElementRef<SVGSVGElement>;
  @ViewChild('canvas') canvas?: ElementRef<HTMLCanvasElement>;
  failed = false;
  fallback = false;

  ngAfterViewInit(): void { this.render(); }
  ngOnChanges(): void { this.render(); }

  private render(): void {
    if (!this.svg || !this.canvas || !this.value) return;
    this.failed = false;
    this.fallback = false;
    if (this.format === 'NONE') return;
    if (this.format === 'QR') {
      toCanvas(this.canvas.nativeElement, this.value, { width: this.large ? 260 : 160, margin: 1 })
        .catch(() => { this.failed = true; });
      return;
    }
    const opts = { displayValue: false, margin: 8, height: this.large ? 110 : 60, width: this.large ? 2.4 : 1.6, background: '#ffffff', lineColor: '#000000' };
    try {
      JsBarcode(this.svg.nativeElement, this.value, { ...opts, format: this.format });
    } catch {
      try {
        JsBarcode(this.svg.nativeElement, this.value, { ...opts, format: 'CODE128' });
        this.fallback = true;
      } catch {
        this.failed = true;
      }
    }
  }
}
