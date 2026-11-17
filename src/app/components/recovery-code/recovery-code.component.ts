import { Component, Input } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';

/** Mostra il codice di recupero UNA sola volta (sul server ne resta solo l'hash). */
@Component({
  selector: 'app-recovery-code',
  templateUrl: './recovery-code.component.html',
  standalone: false,
})
export class RecoveryCodeComponent {
  @Input() code = '';
  @Input() afterRecovery = false;
  saved = false;

  constructor(private modalCtrl: ModalController, private toast: ToastController) {}

  get canShare(): boolean { return typeof (navigator as any).share === 'function'; }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code);
      (await this.toast.create({ message: 'Codice copiato', duration: 1500, position: 'top' })).present();
    } catch {
      (await this.toast.create({ message: 'Copia non riuscita: scrivilo a mano', duration: 2500, position: 'top' })).present();
    }
  }

  async share(): Promise<void> {
    try { await (navigator as any).share({ title: 'Codice di recupero FinanzAI', text: this.code }); } catch { /* annullato */ }
  }

  close(): void { this.modalCtrl.dismiss(); }
}
