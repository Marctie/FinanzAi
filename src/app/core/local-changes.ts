import { Subject } from 'rxjs';

/** Chiave localStorage appena modificata dall'utente (ascoltata da SyncService per sincronizzare). */
export const localChanges$ = new Subject<string>();
