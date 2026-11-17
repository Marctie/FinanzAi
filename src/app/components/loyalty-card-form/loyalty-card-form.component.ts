import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ModalController } from '@ionic/angular';
import { BARCODE_FORMATS, BarcodeFormat, LoyaltyCard } from '../../models/loyalty-card.model';
import { Wallet } from '../../models/wallet.model';
import { BarcodeScanService } from '../../services/barcode-scan.service';

export const CARD_COLORS = ['#1b6ca8', '#c0392b', '#27ae60', '#e67e22', '#8e44ad', '#16a085', '#2c3e50', '#d35400'];

/** Nuova carta fedeltà o modifica. Restituisce { card, destination: 'personal' | walletId }. */
@Component({
  selector: 'app-loyalty-card-form',
  templateUrl: './loyalty-card-form.component.html',
  standalone: false,
})
export class LoyaltyCardFormComponent implements OnInit, OnDestroy {
  @Input() card?: LoyaltyCard;
  @Input() wallets: Wallet[] = [];
  @Input() destination = 'personal';
  /** In modifica la destinazione non si cambia (si elimina e si ricrea). */
  @Input() lockDestination = false;
  @ViewChild('video') video?: ElementRef<HTMLVideoElement>;

  store = '';
  number = '';
  format: BarcodeFormat = 'EAN13';
  color = CARD_COLORS[0];
  holder = '';
  notes = '';
  error = '';
  scanning = false;
  formats = BARCODE_FORMATS;
  colors = CARD_COLORS;
  private stopScan: (() => void) | null = null;

  constructor(private modalCtrl: ModalController, private scanner: BarcodeScanService) {}

  ngOnInit(): void {
    if (this.card) {
      ({ store: this.store, number: this.number, format: this.format, color: this.color } = this.card);
      this.holder = this.card.holder ?? '';
      this.notes = this.card.notes ?? '';
    }
  }

  ngOnDestroy(): void { this.stopScan?.(); }

  get canScan(): boolean { return this.scanner.isAvailable; }

  async scan(): Promise<void> {
    this.error = '';
    try {
      if (Capacitor.isNativePlatform()) {
        const r = await this.scanner.scanNative();
        if (r) { this.number = r.value; this.format = r.format; }
        return;
      }
      this.scanning = true;
      await new Promise(r => setTimeout(r));          // aspetta che il <video> sia nel DOM
      this.stopScan = await this.scanner.scanWeb(this.video!.nativeElement, r => {
        this.number = r.value;
        this.format = r.format;
        this.cancelScan();
      });
    } catch (e) {
      this.scanning = false;
      this.error = (e as Error).name === 'NotAllowedError' ? 'Permesso fotocamera negato' : (e as Error).message || 'Scansione non riuscita';
    }
  }

  cancelScan(): void {
    this.stopScan?.();
    this.stopScan = null;
    this.scanning = false;
  }

  save(): void {
    this.error = '';
    if (!this.store.trim()) { this.error = 'Scrivi il nome del negozio'; return; }
    const number = this.number.trim();
    if (!number) { this.error = 'Inserisci il numero della carta o scansionalo'; return; }
    if (this.format === 'EAN13' && !/^\d{12,13}$/.test(number)) { this.error = 'Un codice EAN-13 ha 13 cifre: controlla il numero o scegli un altro formato'; return; }
    const now = new Date().toISOString();
    const card: LoyaltyCard = {
      id: this.card?.id ?? crypto.randomUUID(),
      store: this.store.trim().slice(0, 40),
      number: number.slice(0, 80),
      format: this.format,
      color: this.color,
      holder: this.holder.trim().slice(0, 40) || undefined,
      notes: this.notes.trim().slice(0, 200) || undefined,
      createdBy: this.card?.createdBy,
      createdAt: this.card?.createdAt ?? now,
      updatedAt: now,
    };
    this.modalCtrl.dismiss({ card, destination: this.destination });
  }

  remove(): void { this.modalCtrl.dismiss({ delete: true }); }
  close(): void { this.cancelScan(); this.modalCtrl.dismiss(); }
}
