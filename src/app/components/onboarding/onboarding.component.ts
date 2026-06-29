import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { UserPreferences } from '../../models/user-preferences.model';

const ONBOARDING_KEY = 'finanzai_onboarded';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.scss'],
  standalone: false,
})
export class OnboardingComponent {
  step    = 0;
  name    = '';
  income  = '';
  savGoal = '';

  readonly steps = [
    { title: 'Benvenuto in FinanzAI 👋', subtitle: 'Il tuo assistente finanziario personale alimentato dall\'AI locale.' },
    { title: 'Come ti chiami?',           subtitle: 'Personalizza la tua esperienza.' },
    { title: 'Qual è il tuo reddito mensile?', subtitle: 'Ti aiutiamo a capire quanto puoi risparmiare.' },
    { title: 'Obiettivo di risparmio',    subtitle: 'Quanto vorresti risparmiare ogni mese?' },
  ];

  constructor(private modalCtrl: ModalController, private storage: StorageService) {}

  next(): void {
    if (this.step < this.steps.length - 1) { this.step++; }
    else { this.finish(); }
  }

  prev(): void { if (this.step > 0) { this.step--; } }

  finish(): void {
    const prefs: Partial<UserPreferences> = {};
    if (this.name)    (prefs as any).displayName  = this.name.trim();
    if (this.income)  (prefs as any).monthlyIncome = parseFloat(this.income);
    if (this.savGoal) (prefs as any).savingsGoal   = parseFloat(this.savGoal);

    if (Object.keys(prefs).length) {
      this.storage.savePreferences({ ...this.storage.prefsSnapshot, ...prefs });
    }
    localStorage.setItem(ONBOARDING_KEY, '1');
    this.modalCtrl.dismiss({ completed: true });
  }

  skip(): void {
    localStorage.setItem(ONBOARDING_KEY, '1');
    this.modalCtrl.dismiss();
  }

  static shouldShow(): boolean {
    return !localStorage.getItem(ONBOARDING_KEY);
  }
}
