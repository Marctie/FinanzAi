import type { SupabaseClient } from '@supabase/supabase-js';
import { mergeDoc, same } from '../core/merge.util';

type WithId = { id: string };
export type Doc = Record<string, WithId[]>;

interface Base<D> { version: number; data: D }

export interface DocSyncOptions<D extends Doc> {
  client: () => SupabaseClient;
  table: 'personal_data' | 'wallets';
  idColumn: 'user_id' | 'id';
  id: string;
  keys: (keyof D)[];
  /** Chiave localStorage dove si salva la base (ultima versione sincronizzata). */
  baseKey: string;
  collect: () => D;
  apply: (d: D) => void;
  /** Se la riga non esiste ancora: true = la crea (dati personali), false = errore (wallet rimosso). */
  createIfMissing: boolean;
  /** Dopo un salvataggio riuscito: prima (server) e dopo (unione salvata). */
  onSaved?: (before: D, after: D) => void;
  /** Arrivati cambiamenti fatti da qualcun altro. */
  onRemoteChange?: (base: D, remote: D, updatedBy: string | null) => void;
  onError?: (e: unknown, phase: string) => void;
}

/**
 * Sincronizza un documento JSON con versione (optimistic locking) e unione a tre vie.
 * Funziona offline: le modifiche restano nel localStorage e partono alla prossima sincronizzazione.
 */
export class DocSync<D extends Doc> {
  private running: Promise<'ok' | 'gone' | 'error' | 'offline'> | null = null;
  private again = false;

  constructor(private o: DocSyncOptions<D>) {}

  get baseVersion(): number | null {
    return this.loadBase()?.version ?? null;
  }

  normalize(d: Partial<D> | null | undefined): D {
    const out = {} as D;
    for (const k of this.o.keys) out[k] = (Array.isArray(d?.[k]) ? d![k] : []) as D[keyof D];
    return out;
  }

  sync(): Promise<'ok' | 'gone' | 'error' | 'offline'> {
    if (this.running) { this.again = true; return this.running; }
    this.running = (async () => {
      let r: 'ok' | 'gone' | 'error' | 'offline';
      do { this.again = false; r = await this.syncOnce(); } while (this.again && r === 'ok');
      return r;
    })().finally(() => { this.running = null; });
    return this.running;
  }

  forget(): void {
    try { localStorage.removeItem(this.o.baseKey); } catch { /* */ }
  }

  private async syncOnce(): Promise<'ok' | 'gone' | 'error' | 'offline'> {
    if (!navigator.onLine) return 'offline';
    const db = this.o.client();
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: row, error } = await db.from(this.o.table)
          .select('data, version' + (this.o.table === 'wallets' ? ', updated_by' : ''))
          .eq(this.o.idColumn, this.o.id)
          .maybeSingle<{ data: Partial<D>; version: number; updated_by?: string | null }>();
        if (error) { this.o.onError?.(error, 'lettura'); return 'error'; }

        if (!row) {
          if (!this.o.createIfMissing) { this.forget(); return 'gone'; }
          const local = this.normalize(this.o.collect());
          const { error: insErr } = await db.from(this.o.table).insert({ [this.o.idColumn]: this.o.id, data: local, version: 1 });
          if (insErr && insErr.code !== '23505') { this.o.onError?.(insErr, 'creazione'); return 'error'; }
          continue;                                    // riletto al giro successivo (anche se un altro dispositivo l'ha creato)
        }

        const remote = this.normalize(row.data);
        const storedBase = this.loadBase();
        const base = storedBase ? this.normalize(storedBase.data) : null;
        const local = this.normalize(this.o.collect());
        const merged = mergeDoc(base, local, remote, this.o.keys);

        if (base && storedBase!.version !== row.version) this.o.onRemoteChange?.(base, remote, row.updated_by ?? null);

        let version = row.version;
        if (!same(merged, remote)) {
          const { data: saved, error: saveErr } = await db.from(this.o.table)
            .update({ data: merged, version: row.version + 1 })
            .eq(this.o.idColumn, this.o.id)
            .eq('version', row.version)
            .select('version');
          if (saveErr) { this.o.onError?.(saveErr, 'salvataggio'); return 'error'; }
          if (!saved?.length) continue;               // qualcuno ha salvato nel frattempo: si riparte con i dati nuovi
          version = row.version + 1;
          this.o.onSaved?.(remote, merged);
        }
        if (!same(merged, local)) this.o.apply(merged);
        this.saveBase({ version, data: merged });
        return 'ok';
      }
      this.o.onError?.(new Error('Salvataggio in conflitto per 5 volte di seguito'), 'conflitti');
      return 'error';
    } catch (e) {
      if (navigator.onLine) this.o.onError?.(e, 'rete');
      return navigator.onLine ? 'error' : 'offline';
    }
  }

  private loadBase(): Base<D> | null {
    try { const raw = localStorage.getItem(this.o.baseKey); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  private saveBase(b: Base<D>): void {
    try { localStorage.setItem(this.o.baseKey, JSON.stringify(b)); } catch { /* spazio pieno: alla prossima si riunisce */ }
  }
}
