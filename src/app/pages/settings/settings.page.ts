import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { ThemeService } from '../../services/theme.service';
import { StorageService } from '../../services/storage.service';
import { AnalyticsService } from '../../services/analytics.service';
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

  constructor(
    private themeService: ThemeService,
    private storage:      StorageService,
    private analytics:    AnalyticsService,
    private toast:        ToastController,
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

  clearData(): void {
    if (confirm('Vuoi davvero eliminare tutti i dati? Questa azione non è reversibile.')) {
      localStorage.clear();
      window.location.reload();
    }
  }

  openDeveloper(): void {
    window.open('https://marctie.github.io/marco.peluso/home', '_blank', 'noopener,noreferrer');
  }

  openGithub(): void {
    window.open('https://github.com/Marctie/FinanzAi', '_blank', 'noopener,noreferrer');
  }

  private async showToast(msg: string, color: string): Promise<void> {
    const t = await this.toast.create({ message: msg, duration: 2500, color, position: 'bottom' });
    t.present();
  }
}
