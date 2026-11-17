import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { combineLatest, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { ThemeService } from './services/theme.service';
import { StorageService } from './services/storage.service';
import { BackupService } from './services/backup.service';
import { AuthService } from './services/auth.service';
import { SyncService } from './services/sync.service';
import { WalletService } from './services/wallet.service';
import { CategoryService } from './services/category.service';
import { NotificationService } from './services/notification.service';
import { TelemetryService } from './services/telemetry.service';
import { OnboardingComponent } from './components/onboarding/onboarding.component';
import { RecoveryCodeComponent } from './components/recovery-code/recovery-code.component';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';

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
    private backup:  BackupService,
    private modal:   ModalController,
    private auth:    AuthService,
    private sync:    SyncService,
    private wallets: WalletService,
    private categories: CategoryService,
    private notifications: NotificationService,
    private telemetry: TelemetryService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.theme.init();
    await this.storage.init();
    this.backup.autoBackup();
    this.initNativePlugins();
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide({ fadeOutDuration: 250 });
    }
    if (OnboardingComponent.shouldShow()) {
      await this.showOnboarding();
    }

    this.initNotifications();
    await this.initAccount();
  }

  /** Account e sincronizzazione: si avviano/fermano a ogni login/logout. */
  private async initAccount(): Promise<void> {
    try {
      await this.auth.init();
    } catch (e) {
      this.telemetry.captureError(e, 'auth', { fase: 'avvio' });
    }
    this.auth.user$.pipe(map(u => u?.id ?? null), distinctUntilChanged()).subscribe(async id => {
      if (!id) { this.sync.stop(); return; }
      await this.sync.start(id);
      await this.ensureRecoveryCode();
      // Con l'account le push del web vanno (ri)collegate all'utente corrente.
      if (this.notifications.isPushSupported && this.storage.prefsSnapshot.notificationsEnabled
          && (await this.notifications.refreshPermission()) === 'granted') {
        this.notifications.enablePush();
      }
    });
  }

  /** Al primo accesso (o se l'account non l'ha mai creato) si genera e si mostra il codice di recupero. */
  private async ensureRecoveryCode(): Promise<void> {
    if (!navigator.onLine) return;
    try {
      if (await this.auth.recoveryCodeCreatedAt()) return;
      const code = await this.auth.createRecoveryCode();
      const m = await this.modal.create({ component: RecoveryCodeComponent, componentProps: { code }, backdropDismiss: false });
      await m.present();
    } catch (e) {
      this.telemetry.captureError(e, 'auth', { fase: 'codice_recupero' });
    }
  }

  /** Promemoria ripianificati a ogni modifica di dati o preferenze; avvisi per le modifiche degli altri membri. */
  private initNotifications(): void {
    this.notifications.init().catch(e => console.error('Avvio notifiche non riuscito', e));
    combineLatest([this.storage.transactions, this.storage.budgets, this.storage.goals, this.storage.preferences, this.categories.categories])
      .pipe(debounceTime(1000))
      .subscribe(([transactions, budgets, goals, prefs]) => {
        this.notifications.reschedule({
          transactions, budgets, goals,
          categoryName: id => this.categories.getCategoryById(id)?.name ?? id,
        }, prefs);
      });
    this.wallets.remoteChange$.subscribe(c => this.notifications.onRemoteWalletChange(c, this.storage.prefsSnapshot));
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
    await m.onDidDismiss();
  }
}
