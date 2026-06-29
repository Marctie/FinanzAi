import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ThemeService } from './services/theme.service';
import { StorageService } from './services/storage.service';
import { OnboardingComponent } from './components/onboarding/onboarding.component';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';

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
    this.initNativePlugins();
    if (OnboardingComponent.shouldShow()) {
      await this.showOnboarding();
    }
  }

  private initNativePlugins(): void {
    if (!Capacitor.isNativePlatform()) return;

    // Status bar: trasparente e adatta al tema
    StatusBar.setOverlaysWebView({ overlay: false });
    this.syncStatusBar();

    // Osserva i cambi di tema per aggiornare la status bar
    const observer = new MutationObserver(() => this.syncStatusBar());
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Hardware back button Android: chiude modals o esce dall'app
    App.addListener('backButton', async ({ canGoBack }) => {
      const topModal = await this.modal.getTop();
      if (topModal) {
        topModal.dismiss();
        return;
      }
      if (!canGoBack) {
        App.exitApp();
      }
    });
  }

  private syncStatusBar(): void {
    const dark =
      document.body.classList.contains('ion-palette-dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    StatusBar.setBackgroundColor({ color: dark ? '#0d1520' : '#ffffff' });
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
