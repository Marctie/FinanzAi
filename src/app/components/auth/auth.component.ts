import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { RecoveryCodeComponent } from '../recovery-code/recovery-code.component';

type Mode = 'login' | 'signup' | 'recover';

/** Accesso, registrazione e recupero password con codice (senza email). */
@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  standalone: false,
})
export class AuthComponent {
  @Input() mode: Mode = 'login';
  email = '';
  password = '';
  password2 = '';
  displayName = '';
  code = '';
  busy = false;
  error = '';
  showPassword = false;

  constructor(private auth: AuthService, private modalCtrl: ModalController) {}

  setMode(m: Mode): void { this.mode = m; this.error = ''; }

  get title(): string {
    return this.mode === 'login' ? 'Accedi' : this.mode === 'signup' ? 'Crea un account' : 'Recupera la password';
  }

  async submit(): Promise<void> {
    this.error = '';
    const email = this.email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { this.error = 'Inserisci un indirizzo email valido'; return; }
    if (this.password.length < 8) { this.error = 'La password deve avere almeno 8 caratteri'; return; }
    if (this.mode !== 'login' && this.password !== this.password2) { this.error = 'Le due password non coincidono'; return; }
    if (this.mode === 'signup' && !this.displayName.trim()) { this.error = 'Scegli un nome da mostrare agli altri membri'; return; }
    if (this.mode === 'recover' && this.code.replace(/[^A-Za-z0-9]/g, '').length !== 16) {
      this.error = 'Il codice di recupero ha 16 caratteri (XXXX-XXXX-XXXX-XXXX)'; return;
    }
    this.busy = true;
    try {
      if (this.mode === 'login') {
        await this.auth.signIn(email, this.password);
        await this.modalCtrl.dismiss({ signedIn: true });
      } else if (this.mode === 'signup') {
        await this.auth.signUp(email, this.password, this.displayName);
        await this.modalCtrl.dismiss({ signedIn: true, newAccount: true });
      } else {
        const newCode = await this.auth.recoverWithCode(email, this.code, this.password);
        await this.modalCtrl.dismiss({ signedIn: true });
        const m = await this.modalCtrl.create({
          component: RecoveryCodeComponent, componentProps: { code: newCode, afterRecovery: true }, backdropDismiss: false,
        });
        await m.present();
      }
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
    }
  }

  close(): void { this.modalCtrl.dismiss(); }
}
