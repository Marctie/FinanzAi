/**
 * Unione a tre vie dei documenti sincronizzati (dati personali e wallet condivisi).
 *
 * base   = ultima versione sincronizzata da questo dispositivo
 * local  = versione attuale sul dispositivo (con le modifiche fatte offline)
 * remote = versione attuale sul server (con le modifiche degli altri dispositivi / membri)
 *
 * Regole, elemento per elemento (per id) e poi campo per campo:
 * - cambiato solo da una parte → vince quella parte (anche una cancellazione);
 * - cancellato da una parte e modificato dall'altra → si tiene la modifica;
 * - lo stesso campo cambiato da entrambe → vince l'elemento con `updatedAt` più recente (a parità, il locale).
 * Senza base (primo collegamento) si fa l'unione semplice: niente viene cancellato, a parità di id vince il server.
 */

type Rec = Record<string, unknown>;
type WithId = { id: string };

/** JSON con chiavi ordinate: due oggetti uguali producono sempre la stessa stringa. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const obj = value as Rec;
  return '{' + Object.keys(obj).filter(k => obj[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

export const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);

const stamp = (x: unknown): string => String((x as { updatedAt?: string })?.updatedAt ?? '');

/** Unione campo per campo di due versioni dello stesso elemento modificate entrambe rispetto alla base. */
export function mergeFields<T extends object>(base: T | undefined, local: T, remote: T): T {
  if (!base) return stamp(remote) > stamp(local) ? remote : local;
  const b = base as Rec, l = local as Rec, r = remote as Rec;
  const remoteNewer = stamp(remote) > stamp(local);
  const out: Rec = {};
  for (const k of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
    const lc = !same(b[k], l[k]), rc = !same(b[k], r[k]);
    const v = !lc ? r[k] : !rc ? l[k] : (remoteNewer ? r[k] : l[k]);
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

export function mergeList<T extends WithId>(base: T[] | null, local: T[], remote: T[]): T[] {
  const B = new Map((base ?? []).map(x => [x.id, x]));
  const L = new Map(local.map(x => [x.id, x]));
  const R = new Map(remote.map(x => [x.id, x]));
  const merged = new Map<string, T>();
  for (const id of new Set([...B.keys(), ...L.keys(), ...R.keys()])) {
    const b = B.get(id), l = L.get(id), r = R.get(id);
    let v: T | undefined;
    if (!base) v = r ?? l;                              // unione semplice
    else {
      const lc = !same(b, l), rc = !same(b, r);
      if (!lc) v = r;
      else if (!rc) v = l;
      else if (l === undefined) v = r;                  // io ho cancellato, l'altro ha modificato
      else if (r === undefined) v = l;                  // l'altro ha cancellato, io ho modificato
      else v = mergeFields(b, l, r);
    }
    if (v !== undefined) merged.set(id, v);
  }
  // Ordine: prima l'ordine del server, poi i nuovi elementi locali.
  const out: T[] = [];
  const seen = new Set<string>();
  for (const x of [...remote, ...local]) {
    if (merged.has(x.id) && !seen.has(x.id)) { out.push(merged.get(x.id)!); seen.add(x.id); }
  }
  return out;
}

/** Unisce un documento formato da liste di elementi con id (es. { transactions: [], budgets: [] }). */
export function mergeDoc<D extends Record<string, WithId[]>>(base: D | null, local: D, remote: D, keys: (keyof D)[]): D {
  const out = {} as D;
  for (const k of keys) {
    out[k] = mergeList(base ? (base[k] ?? []) : null, local[k] ?? [], remote[k] ?? []) as D[keyof D];
  }
  return out;
}

/** Elementi presenti in `after` ma non in `before`, e quelli presenti in entrambi ma cambiati. */
export function diffList<T extends WithId>(before: T[], after: T[]): { added: T[]; changed: T[]; removed: T[] } {
  const prev = new Map(before.map(x => [x.id, x]));
  const next = new Set(after.map(x => x.id));
  return {
    added: after.filter(x => !prev.has(x.id)),
    changed: after.filter(x => prev.has(x.id) && !same(prev.get(x.id), x)),
    removed: before.filter(x => !next.has(x.id)),
  };
}
