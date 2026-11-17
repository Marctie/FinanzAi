import { Injectable } from '@angular/core';
import { CategoryService } from './category.service';
import { StorageService } from './storage.service';
import { BackupService } from './backup.service';
import { TelemetryService } from './telemetry.service';
import {
  CategoryMapping, ImportOptions, MmData, TargetCategory, buildImport, defaultMapping, extractDatabase, readMmData,
} from '../core/mmbackup';
import { Category } from '../models/category.model';

/**
 * Importazione dei backup di Money Manager (.mmbackup). Il file viene aperto SUL DISPOSITIVO (fflate + sql.js in
 * WebAssembly, caricati solo quando servono): nessun dato viene inviato a server. I movimenti vengono aggiunti a quelli
 * esistenti; con l'account la sincronizzazione li porta poi sugli altri dispositivi come ogni altra modifica.
 */
@Injectable({ providedIn: 'root' })
export class MmImportService {
  constructor(
    private categories: CategoryService,
    private storage: StorageService,
    private backup: BackupService,
    private telemetry: TelemetryService,
  ) {}

  /** Legge il file e restituisce i dati da mostrare nell'anteprima. */
  async read(file: File): Promise<MmData> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { unzipSync } = await import('fflate');
    const dbBytes = extractDatabase(bytes, unzipSync);
    const mod: any = await import('sql.js');
    const initSqlJs = mod.default ?? mod;
    const SQL = await initSqlJs({ locateFile: (f: string) => new URL(`assets/sqljs/${f}`, document.baseURI).href });
    const db = new SQL.Database(dbBytes);
    try {
      return readMmData(sql => {
        const res = db.exec(sql);
        if (!res.length) return [];
        const { columns, values } = res[0];
        return values.map((row: unknown[]) => Object.fromEntries(columns.map((c: string, i: number) => [c, row[i]])));
      });
    } finally {
      db.close();
    }
  }

  targets(): TargetCategory[] {
    return this.categories.all.map(c => ({ id: c.id, name: c.name, type: c.type }));
  }

  defaultMapping(data: MmData): CategoryMapping {
    return defaultMapping(data.categories, this.targets());
  }

  /** Applica l'importazione: backup automatico di sicurezza, poi categorie, movimenti e budget. */
  async apply(data: MmData, mapping: CategoryMapping, opts: Omit<ImportOptions, 'month'>): Promise<{ added: number; updated: number; categories: number; budgets: number }> {
    await this.backup.autoBackup();
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const res = buildImport(data, mapping, { ...opts, month });
    this.categories.upsertCustom(res.newCategories as Category[]);
    const { added, updated } = this.storage.importData({ transactions: res.transactions, budgets: res.budgets });
    this.telemetry.track('import_money_manager', { movimenti: res.transactions.length, categorie: res.newCategories.length });
    return { added, updated, categories: res.newCategories.length, budgets: res.budgets.length };
  }
}
