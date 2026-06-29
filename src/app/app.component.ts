import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ThemeService } from './services/theme.service';
import { StorageService } from './services/storage.service';
import { OnboardingComponent } from './components/onboarding/onboarding.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(
    private theme:   ThemeService,
    private storage: StorageService,
    private modal:   ModalController,
  ) {}

  async ngOnInit(): Promise<void> {
    this.theme.init();
    await this.storage.init();
    if (OnboardingComponent.shouldShow()) {
      await this.showOnboarding();
    }
  }

  private async showOnboarding(): Promise<void> {
    const m = await this.modal.create({
      component: OnboardingComponent,
      backdropDismiss: false,
      cssClass: 'onboarding-modal',
    });
    await m.present();
  }
}
