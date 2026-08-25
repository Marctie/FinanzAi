import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { CategoryService } from './category.service';

const AUTO_BACKUP_KEY = 'finanzai_auto_backup';

interface BackupFile {
  app: 'finanzai';
  backupVersion: 1;
  exportedAt: string;
  checksum: string;
  data: {
    transactions: unknown[];
    budgets: unknown[];
    goals: unknown[];
    preferences: unknown;
    customCategories: unknown[];
  };
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  constructor(private storage: StorageService, private categories: CategoryService) {}

  async exportBackup(): Promise<void> {
    const backup = await this.buildBackupFile();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `finanzai_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** @throws Error con messaggio leggibile se il file non è un backup valido o l'integrità non corrisponde */
  async importBackup(file: File): Promise<{ transactions: number; budgets: number; goals: number; categories: number }> {
    const text = await file.text();
    let parsed: BackupFile;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Il file non è un JSON valido.');
    }
    return this.applyBackup(parsed);
  }

  /**
   * Salva silenziosamente uno snapshot dei dati correnti in locale (nessun file scaricato,
   * nessuna interazione utente) come rete di sicurezza in caso di problemi con i dati live.
   * Va richiamato ad ogni avvio dell'app e prima di operazioni distruttive.
   */
  async autoBackup(): Promise<void> {
    try {
      const backup = await this.buildBackupFile();
      localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(backup));
    } catch {
      // Il backup automatico non deve mai bloccare l'avvio dell'app.
    }
  }

  get lastAutoBackupAt(): string | null {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as BackupFile).exportedAt;
    } catch {
      return null;
    }
  }

  async restoreFromAutoBackup(): Promise<{ transactions: number; budgets: number; goals: number; categories: number }> {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY);
    if (!raw) throw new Error('Nessun backup automatico disponibile.');
    return this.applyBackup(JSON.parse(raw) as BackupFile);
  }

  private async buildBackupFile(): Promise<BackupFile> {
    const data = {
      transactions:     this.storage.transactionsSnapshot,
      budgets:          this.storage.budgetsSnapshot,
      goals:            this.storage.goalsSnapshot,
      preferences:      this.storage.prefsSnapshot,
      customCategories: this.categories.custom,
    };
    const checksum = await this.hash(JSON.stringify(data));
    return {
      app: 'finanzai',
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      checksum,
      data,
    };
  }

  private async applyBackup(parsed: BackupFile): Promise<{ transactions: number; budgets: number; goals: number; categories: number }> {
    if (parsed.app !== 'finanzai' || !parsed.data || !parsed.checksum) {
      throw new Error('Il file non è un backup di FinanzAI.');
    }

    const expected = await this.hash(JSON.stringify(parsed.data));
    if (expected !== parsed.checksum) {
      throw new Error('Il backup risulta corrotto o modificato (integrità non verificata).');
    }

    const { transactions, budgets, goals, preferences, customCategories } = parsed.data;
    if (!Array.isArray(transactions) || !Array.isArray(budgets) || !Array.isArray(goals)) {
      throw new Error('Struttura del backup non valida.');
    }

    this.storage.restoreAll({
      transactions: transactions as any,
      budgets:      budgets as any,
      goals:        goals as any,
      preferences:  preferences as any,
    });
    this.categories.restoreCustom((customCategories as any) ?? []);

    return {
      transactions: transactions.length,
      budgets:      budgets.length,
      goals:        goals.length,
      categories:   Array.isArray(customCategories) ? customCategories.length : 0,
    };
  }

  private async hash(text: string): Promise<string> {
    const buf   = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
