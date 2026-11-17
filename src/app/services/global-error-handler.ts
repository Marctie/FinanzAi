import { ErrorHandler, Injectable } from '@angular/core';
import { TelemetryService } from './telemetry.service';

const RELOAD_KEY = 'finanzai_chunk_reload_at';

/**
 * Dopo un nuovo deploy della web app, una pagina aperta con la versione precedente può chiedere un pezzo di codice
 * (chunk) che non esiste più → ChunkLoadError. In quel caso si ricarica la pagina UNA volta (al massimo ogni 5 minuti,
 * per non entrare in un ciclo) e l'utente si ritrova sulla versione nuova.
 */
export function reloadIfStaleChunk(err: unknown, telemetry?: TelemetryService): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (!/ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(msg)) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 5 * 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { /* sessionStorage non disponibile: si ricarica comunque */ }
  telemetry?.track('aggiornamento_ricaricato');
  setTimeout(() => location.reload(), 300);
  return true;
}

/**
 * Sostituisce l'ErrorHandler di Angular: ogni errore non gestito (template, componenti, promesse nella zona
 * Angular) viene registrato nella telemetria e continua a essere scritto in console come prima.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private telemetry: TelemetryService) {}

  handleError(error: unknown): void {
    // Angular a volte avvolge l'errore vero (es. promessa rifiutata): si invia quello originale.
    const original = (error as { rejection?: unknown })?.rejection ?? error;
    if (reloadIfStaleChunk(original, this.telemetry)) return;
    this.telemetry.captureError(original, 'angular');
    this.telemetry.consoleErrorRaw('ERROR', error);
  }
}
