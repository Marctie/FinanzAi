import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { LoyaltyCard } from '../../models/loyalty-card.model';

/** Carta a schermo intero da mostrare alla cassa (codice grande su sfondo bianco). */
@Component({
  selector: 'app-loyalty-card-view',
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar [style.--background]="card.color" class="card-view-toolbar">
        <ion-buttons slot="start">
          <ion-button (click)="close()" aria-label="Chiudi"><ion-icon name="close-outline" slot="icon-only"></ion-icon></ion-button>
        </ion-buttons>
        <ion-title>{{ card.store }}</ion-title>
        <ion-buttons slot="end" *ngIf="canEdit">
          <ion-button (click)="edit()" aria-label="Modifica"><ion-icon name="create-outline" slot="icon-only"></ion-icon></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="card-view-content">
      <div class="card-view-body">
        <app-barcode [value]="card.number" [format]="card.format" [large]="true"></app-barcode>
        <p class="card-view-holder" *ngIf="card.holder">{{ card.holder }}</p>
        <p class="card-view-shared" *ngIf="walletName">Condivisa in {{ walletName }}</p>
        <p class="card-view-tip">Suggerimento: alza la luminosità dello schermo se il lettore non legge il codice.</p>
      </div>
    </ion-content>`,
  standalone: false,
})
export class LoyaltyCardViewComponent {
  @Input() card!: LoyaltyCard;
  @Input() walletName?: string;
  @Input() canEdit = true;

  constructor(private modalCtrl: ModalController) {}

  edit(): void { this.modalCtrl.dismiss({ edit: true }); }
  close(): void { this.modalCtrl.dismiss(); }
}
