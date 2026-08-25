import { Component, OnInit } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';
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
export class SettingsPage implements OnInit {
  currentTheme: ThemeMode = 'system';
  version = '1.0.0';
  isImporting = false;

  constructor(
    private themeService: ThemeService,
    private storage:      StorageService,
    private analytics:    AnalyticsService,
    private backup:       BackupService,
    private toast:        ToastController,
    private alertCtrl:    AlertController,
  ) {}

  ngOnInit(): void {
    this.currentTheme = this.themeService.currentTheme;
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

  clearData(): void {
    if (confirm('Vuoi davvero eliminare tutti i dati? Questa azione non è reversibile.')) {
      localStorage.clear();
      window.location.reload();
    }
  }

  private async showToast(msg: string, color: string): Promise<void> {
    const t = await this.toast.create({ message: msg, duration: 2500, color, position: 'bottom' });
    t.present();
  }
}
