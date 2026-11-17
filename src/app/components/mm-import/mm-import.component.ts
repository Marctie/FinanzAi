import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { CategoryMapping, MmCategory, MmData, NEW_CATEGORY, TargetCategory } from '../../core/mmbackup';
import { MmImportService } from '../../services/mm-import.service';

/** Anteprima dell'importazione da Money Manager: riepilogo, abbinamento delle categorie, opzioni. */
@Component({
  selector: 'app-mm-import',
  templateUrl: './mm-import.component.html',
  standalone: false,
})
export class MmImportComponent implements OnInit {
  @Input() data!: MmData;
  mapping: CategoryMapping = {};
  targets: TargetCategory[] = [];
  budgets = true;
  recurring = true;
  busy = false;
  error = '';
  readonly NEW = NEW_CATEGORY;

  constructor(private modalCtrl: ModalController, private importer: MmImportService) {}

  ngOnInit(): void {
    this.targets = this.importer.targets();
    this.mapping = this.importer.defaultMapping(this.data);
  }

  options(c: MmCategory): TargetCategory[] {
    return this.targets.filter(t => t.type === c.type || t.type === 'both');
  }

  get recurringCount(): number { return this.data.transactions.filter(t => t.recurringUid).length; }
  get limitCount(): number { return this.data.categories.filter(c => c.type === 'expense' && c.limit > 0).length; }
  get newCount(): number { return this.data.categories.filter(c => this.mapping[c.uid] === NEW_CATEGORY).length; }

  fmtDate(d: string): string {
    if (!d) return '?';
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async confirm(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      const r = await this.importer.apply(this.data, this.mapping, { budgets: this.budgets, recurring: this.recurring });
      await this.modalCtrl.dismiss(r);
    } catch (e) {
      this.error = (e as Error).message || 'Importazione non riuscita';
      this.busy = false;
    }
  }

  close(): void { this.modalCtrl.dismiss(); }
}
