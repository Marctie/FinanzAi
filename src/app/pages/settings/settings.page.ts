import { Component, OnDestroy, OnInit } from '@angular/core';
import { ToastController, AlertController, ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { NotificationService, PermissionState } from '../../services/notification.service';
import { SyncService, SyncStatus } from '../../services/sync.service';
import { CategoryService } from '../../services/category.service';
import { AuthComponent } from '../../components/auth/auth.component';
import { RecoveryCodeComponent } from '../../components/recovery-code/recovery-code.component';
import { MmImportComponent } from '../../components/mm-import/mm-import.component';
import { MmImportService } from '../../services/mm-import.service';
import { UserPreferences } from '../../models/user-preferences.model';
import { ThemeService } from '../../services/theme.service';
import { StorageService } from '../../services/storage.service';
import { AnalyticsService } from '../../services/analytics.service';
import { BackupService } from '../../services/backup.service';
import { ThemeMode } from '../../models/user-preferences.model';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage implements OnInit, OnDestroy {
  currentTheme: ThemeMode = 'system';
  version = environment.appVersion;
  isImporting = false;
  user: User | null = null;
  displayName = '';
  syncStatus: SyncStatus = 'idle';
  permission: PermissionState = 'unsupported';
  prefs!: UserPreferences;
  recoveryCreatedAt: string | null | undefined = undefined;
  private subs: Subscription[] = [];

  constructor(
    private themeService: ThemeService,
    private storage:      StorageService,
    private analytics:    AnalyticsService,
    private backup:       BackupService,
    private toast:        ToastController,
    private alertCtrl:    AlertController,
    private modal:        ModalController,
    public  auth:         AuthService,
    public  notifications: NotificationService,
    private sync:         SyncService,
    private categories:   CategoryService,
    private mmImport:     MmImportService,
  ) {}

  ngOnInit(): void {
    this.currentTheme = this.themeService.currentTheme;
    this.subs.push(
      this.auth.user$.subscribe(u => {
        this.user = u;
        this.recoveryCreatedAt = undefined;
        if (u) this.auth.recoveryCodeCreatedAt().then(d => this.recoveryCreatedAt = d).catch(() => undefined);
      }),
      this.auth.displayName$.subscribe(() => this.displayName = this.auth.displayName),
      this.sync.status$.subscribe(s => this.syncStatus = s),
      this.notifications.permission$.subscribe(p => this.permission = p),
      this.storage.preferences.subscribe(p => this.prefs = p),
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  // ─── Account ───────────────────────────────────────────────────────────────
  get syncLabel(): string {
    const labels: Record<SyncStatus, string> = {
      idle: 'In attesa',
      syncing: 'Sincronizzazione…',
      synced: 'Sincronizzato',
      offline: 'Offline: le modifiche partiranno appena torna la rete',
      error: 'Errore di sincronizzazione: riprovo a breve',
    };
    return labels[this.syncStatus];
  }

  async openAuth(mode: 'login' | 'signup'): Promise<void> {
    const m = await this.modal.create({ component: AuthComponent, componentProps: { mode } });
    await m.present();
  }

  async changeName(): Promise<void> {
    const a = await this.alertCtrl.create({
      header: 'Nome visibile', message: 'È il nome che vedono gli altri membri dei tuoi wallet.',
      inputs: [{ name: 'name', value: this.displayName, attributes: { maxlength: 40 } }],
      buttons: [{ text: 'Annulla', role: 'cancel' }, { text: 'Salva', role: 'confirm' }],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss();
    const name = (data?.values?.name ?? '').trim();
    if (role !== 'confirm' || !name) return;
    try { await this.auth.setDisplayName(name); this.showToast('Nome aggiornato', 'success'); }
    catch (e) { this.showToast((e as Error).message, 'danger'); }
  }

  async changePassword(): Promise<void> {
    const a = await this.alertCtrl.create({
      header: 'Cambia password',
      inputs: [
        { name: 'p1', type: 'password', placeholder: 'Nuova password (min. 8 caratteri)' },
        { name: 'p2', type: 'password', placeholder: 'Ripeti la nuova password' },
      ],
      buttons: [{ text: 'Annulla', role: 'cancel' }, { text: 'Cambia', role: 'confirm' }],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss();
    if (role !== 'confirm') return;
    const { p1, p2 } = data.values;
    if ((p1 ?? '').length < 8) { this.showToast('La password deve avere almeno 8 caratteri', 'warning'); return; }
    if (p1 !== p2) { this.showToast('Le due password non coincidono', 'warning'); return; }
    try { await this.auth.updatePassword(p1); this.showToast('Password cambiata', 'success'); }
    catch (e) { this.showToast((e as Error).message, 'danger'); }
  }

  async newRecoveryCode(): Promise<void> {
    if (this.recoveryCreatedAt) {
      const a = await this.alertCtrl.create({
        header: 'Nuovo codice di recupero?', message: 'Il codice attuale smetterà di funzionare.',
        buttons: [{ text: 'Annulla', role: 'cancel' }, { text: 'Genera', role: 'confirm' }],
      });
      await a.present();
      if ((await a.onDidDismiss()).role !== 'confirm') return;
    }
    try {
      const code = await this.auth.createRecoveryCode();
      this.recoveryCreatedAt = new Date().toISOString();
      const m = await this.modal.create({ component: RecoveryCodeComponent, componentProps: { code }, backdropDismiss: false });
      await m.present();
    } catch (e) { this.showToast((e as Error).message, 'danger'); }
  }

  get recoveryLabel(): string {
    if (this.recoveryCreatedAt === undefined) return '…';
    if (!this.recoveryCreatedAt) return 'Non ancora creato';
    return 'Creato il ' + new Date(this.recoveryCreatedAt).toLocaleDateString('it-IT');
  }

  async signOut(): Promise<void> {
    const a = await this.alertCtrl.create({
      header: 'Uscire dall’account?',
      message: this.sync.pendingChanges
        ? 'Ci sono modifiche non ancora sincronizzate: se esci adesso andranno perse. Collegati a internet e attendi la sincronizzazione.'
        : 'I dati restano salvati nel tuo account e torneranno quando accedi di nuovo.',
      buttons: [{ text: 'Annulla', role: 'cancel' }, { text: 'Esci', role: 'destructive' }],
    });
    await a.present();
    if ((await a.onDidDismiss()).role === 'destructive') await this.auth.signOut();
  }

  async deleteAccount(): Promise<void> {
    const a = await this.alertCtrl.create({
      header: 'Eliminare l’account?',
      message: 'Account, dati sincronizzati e appartenenza ai wallet verranno eliminati definitivamente. I wallet in cui restano altri membri non vengono cancellati. Scrivi ELIMINA per confermare.',
      inputs: [{ name: 'confirm', placeholder: 'ELIMINA' }],
      buttons: [{ text: 'Annulla', role: 'cancel' }, { text: 'Elimina', role: 'destructive' }],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss();
    if (role !== 'destructive' || (data?.values?.confirm ?? '').trim().toUpperCase() !== 'ELIMINA') return;
    try { await this.notifications.disablePush(); await this.auth.deleteAccount(); }
    catch (e) { this.showToast((e as Error).message, 'danger'); }
  }

  // ─── Notifiche ─────────────────────────────────────────────────────────────
  /** L'interruttore è acceso solo se la preferenza è attiva E il permesso di sistema è concesso. */
  get notificationsOn(): boolean {
    return !!this.prefs?.notificationsEnabled && this.permission === 'granted';
  }

  /** Chiamata direttamente dal tocco dell'utente (iOS mostra la richiesta di sistema solo così). */
  async toggleNotifications(ev: CustomEvent): Promise<void> {
    const want = (ev.detail as { checked: boolean }).checked;
    if (want === this.notificationsOn) return;
    if (!want) {
      this.updatePrefs({ notificationsEnabled: false });
      await this.notifications.disablePush();
      return;
    }
    await this.enableNotifications();
  }

  async enableNotifications(): Promise<void> {
    const r = await this.notifications.activate();
    if (r === 'granted') {
      this.updatePrefs({ notificationsEnabled: true });
      this.showToast('Notifiche attivate', 'success');
      return;
    }
    this.updatePrefs({ notificationsEnabled: false });
    let msg: string;
    if (r === 'needs-home-screen') {
      msg = 'Su iPhone le notifiche funzionano solo con l’app nella schermata Home: in Safari tocca Condividi, poi "Aggiungi a schermata Home", e apri FinanzAI da lì.';
    } else if (r === 'unsupported') {
      msg = 'Questo browser non supporta le notifiche.';
    } else if (this.notifications.isNative) {
      msg = 'Permesso negato. Puoi attivarlo da Impostazioni di Android, App, FinanzAI, Notifiche.';
    } else {
      msg = 'Permesso negato. Puoi riattivarlo dalle impostazioni del sito nel browser o, su iPhone, da Impostazioni, Notifiche, FinanzAI.';
    }
    const a = await this.alertCtrl.create({ header: 'Notifiche non attive', message: msg, buttons: ['OK'] });
    await a.present();
  }

  updatePrefs(patch: Partial<UserPreferences>): void {
    this.storage.savePreferences({ ...this.storage.prefsSnapshot, ...patch });
  }

  setPref(key: keyof UserPreferences, ev: CustomEvent): void {
    this.updatePrefs({ [key]: (ev.detail as { checked: boolean }).checked } as Partial<UserPreferences>);
  }

  setNotifyTime(ev: CustomEvent): void {
    const v = String((ev.detail as { value?: string }).value ?? '');
    const m = /(\d{2}):(\d{2})/.exec(v);
    if (m) this.updatePrefs({ notifyTime: `${m[1]}:${m[2]}` });
  }

  async sendTest(): Promise<void> {
    this.showToast(await this.notifications.sendTest(), 'medium');
  }

  setTheme(mode: ThemeMode): void {
    this.currentTheme = mode;
    this.themeService.setTheme(mode);
  }

  exportCsv(): void {
    const txs = this.storage.transactionsSnapshot;
    if (!txs.length) {
      this.showToast('Nessuna transazione da esportare.', 'warning');
      return;
    }

    const header = ['Data', 'Tipo', 'Importo', 'Categoria', 'Descrizione', 'Note'];
    const rows = txs.map(t => [
      t.date,
      t.type === 'income' ? 'Entrata' : 'Uscita',
      this.analytics.formatCurrency(t.amount),
      t.category,
      `"${(t.title ?? '').replace(/"/g, '""')}"`,
      `"${(t.notes ?? '').replace(/"/g, '""')}"`,
    ]);

    const csv = [header, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `finanzai_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    this.showToast(`Esportate ${txs.length} transazioni.`, 'success');
  }

  async exportBackup(): Promise<void> {
    await this.backup.exportBackup();
    this.showToast('Backup creato e scaricato.', 'success');
  }

  async onBackupFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const alert = await this.alertCtrl.create({
      header: 'Ripristina backup',
      message: 'Il ripristino sovrascriverà tutti i dati attuali con quelli del file selezionato. Continuare?',
      buttons: [
        { text: 'Annulla', role: 'cancel', handler: () => { input.value = ''; } },
        {
          text: 'Ripristina',
          role: 'destructive',
          handler: async () => {
            this.isImporting = true;
            try {
              const result = await this.backup.importBackup(file);
              this.showToast(
                `Ripristinati ${result.transactions} movimenti, ${result.budgets} budget, ${result.goals} obiettivi, ${result.categories} categorie personalizzate.`,
                'success',
              );
            } catch (e) {
              this.showToast((e as Error).message ?? 'Errore durante il ripristino del backup.', 'danger');
            } finally {
              this.isImporting = false;
              input.value = '';
            }
          },
        },
      ],
    });
    await alert.present();
  }

  get lastAutoBackupLabel(): string {
    const iso = this.backup.lastAutoBackupAt;
    if (!iso) return 'Nessuno ancora';
    return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  async restoreAutoBackup(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Ripristina backup automatico',
      message: `Verranno ripristinati i dati salvati automaticamente il ${this.lastAutoBackupLabel}, sovrascrivendo quelli attuali. Continuare?`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Ripristina',
          role: 'destructive',
          handler: async () => {
            try {
              const result = await this.backup.restoreFromAutoBackup();
              this.showToast(
                `Ripristinati ${result.transactions} movimenti, ${result.budgets} budget, ${result.goals} obiettivi.`,
                'success',
              );
            } catch (e) {
              this.showToast((e as Error).message ?? 'Errore durante il ripristino.', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  /** Importazione da Money Manager: lettura sul dispositivo, anteprima con abbinamento delle categorie, conferma. */
  async onMmFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.isImporting = true;
    try {
      const data = await this.mmImport.read(file);
      if (!data.transactions.length) { this.showToast('Il file non contiene movimenti.', 'warning'); return; }
      const m = await this.modal.create({ component: MmImportComponent, componentProps: { data } });
      await m.present();
      const r = (await m.onDidDismiss()).data as { added: number; updated: number; categories: number; budgets: number } | undefined;
      if (r) {
        this.showToast(`Importati ${r.added} movimenti${r.updated ? ` (${r.updated} aggiornati)` : ''}, ${r.categories} categorie nuove, ${r.budgets} budget.`, 'success');
      }
    } catch (e) {
      this.showToast((e as Error).message || 'File non valido.', 'danger');
    } finally {
      this.isImporting = false;
    }
  }

  async clearData(): Promise<void> {
    if (this.user) {
      // Con l'account: si svuotano i dati personali e la sincronizzazione li cancella anche online.
      const a = await this.alertCtrl.create({
        header: 'Cancellare tutti i dati?',
        message: 'Movimenti, budget, obiettivi, categorie e carte personali verranno eliminati su tutti i tuoi dispositivi. I wallet condivisi non vengono toccati. Resta un backup automatico locale.',
        buttons: [{ text: 'Annulla', role: 'cancel' }, { text: 'Cancella', role: 'destructive' }],
      });
      await a.present();
      if ((await a.onDidDismiss()).role !== 'destructive') return;
      await this.backup.autoBackup();
      this.storage.restoreAll({ transactions: [], budgets: [], goals: [], preferences: this.storage.prefsSnapshot });
      this.storage.loyaltyCardsSnapshot.forEach(c => this.storage.deleteLoyaltyCard(c.id));
      this.categories.restoreCustom([]);
      this.showToast('Dati cancellati', 'success');
      return;
    }
    if (confirm('Vuoi davvero eliminare tutti i dati? Questa azione non è reversibile. (Verrà comunque conservato un backup automatico di sicurezza, ripristinabile in seguito.)')) {
      await this.backup.autoBackup();
      const AUTO_BACKUP_KEY = 'finanzai_auto_backup';
      const keep = localStorage.getItem(AUTO_BACKUP_KEY);
      localStorage.clear();
      if (keep) localStorage.setItem(AUTO_BACKUP_KEY, keep);
      window.location.reload();
    }
  }

  private async showToast(msg: string, color: string): Promise<void> {
    const t = await this.toast.create({ message: msg, duration: 2500, color, position: 'bottom' });
    t.present();
  }
}
