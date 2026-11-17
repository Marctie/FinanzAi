import { ErrorHandler, Injectable } from '@angular/core';
import { TelemetryService } from './telemetry.service';

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
    this.telemetry.captureError(original, 'angular');
    this.telemetry.consoleErrorRaw('ERROR', error);
  }
}
