import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat as MlFormat } from '@capacitor-mlkit/barcode-scanning';
import { BarcodeFormat } from '../models/loyalty-card.model';
import { TelemetryService } from './telemetry.service';

export interface ScanResult { value: string; format: BarcodeFormat }

const FROM_ML: Partial<Record<MlFormat, BarcodeFormat>> = {
  [MlFormat.Ean13]: 'EAN13', [MlFormat.Ean8]: 'EAN8', [MlFormat.UpcA]: 'UPC', [MlFormat.Code128]: 'CODE128',
  [MlFormat.Code39]: 'CODE39', [MlFormat.Itf]: 'ITF', [MlFormat.QrCode]: 'QR',
};
const FROM_ZXING: Record<string, BarcodeFormat> = {
  EAN_13: 'EAN13', EAN_8: 'EAN8', UPC_A: 'UPC', CODE_128: 'CODE128', CODE_39: 'CODE39', ITF: 'ITF', QR_CODE: 'QR',
};

/**
 * Scansione del codice di una carta fedeltà con la fotocamera.
 * Android: ML Kit (plugin nativo). Web/iPhone: @zxing/browser (Safari non ha BarcodeDetector), caricato solo quando serve.
 * La telemetria registra solo l'esito, MAI il codice letto.
 */
@Injectable({ providedIn: 'root' })
export class BarcodeScanService {
  constructor(private telemetry: TelemetryService) {}

  get isAvailable(): boolean {
    return Capacitor.isNativePlatform() || !!navigator.mediaDevices?.getUserMedia;
  }

  /** Android: usa lo scanner di Google Play Services (non serve il permesso fotocamera all'app). */
  async scanNative(): Promise<ScanResult | null> {
    try {
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        this.telemetry.track('scansione_carta', { esito: 'modulo_in_download' });
        throw new Error('Sto scaricando lo scanner di Google: riprova tra qualche secondo');
      }
    } catch (e) {
      if ((e as Error).message.startsWith('Sto scaricando')) throw e;
      /* verifica non supportata: si prova comunque */
    }
    const { barcodes } = await BarcodeScanner.scan({ formats: Object.keys(FROM_ML) as MlFormat[] });
    const b = barcodes[0];
    this.telemetry.track('scansione_carta', { esito: b ? 'ok' : 'annullata' });
    return b ? { value: b.rawValue ?? b.displayValue ?? '', format: FROM_ML[b.format] ?? 'CODE128' } : null;
  }

  /** Web: avvia la fotocamera nel <video> indicato. Restituisce una funzione per fermarla. */
  async scanWeb(video: HTMLVideoElement, onResult: (r: ScanResult) => void): Promise<() => void> {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
    const controls = await reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } }, video,
      (result) => {
        if (!result) return;
        const fmt = FROM_ZXING[String((result as any).getBarcodeFormat?.() !== undefined
          ? formatName((result as any).getBarcodeFormat()) : '')] ?? 'CODE128';
        this.telemetry.track('scansione_carta', { esito: 'ok' });
        onResult({ value: result.getText(), format: fmt });
      },
    );
    return () => controls.stop();
  }
}

/** Nome del formato zxing (l'enum numerico non è esportato in modo comodo dal pacchetto browser). */
function formatName(n: number): string {
  const names = ['AZTEC', 'CODABAR', 'CODE_39', 'CODE_93', 'CODE_128', 'DATA_MATRIX', 'EAN_8', 'EAN_13', 'ITF',
    'MAXICODE', 'PDF_417', 'QR_CODE', 'RSS_14', 'RSS_EXPANDED', 'UPC_A', 'UPC_E', 'UPC_EAN_EXTENSION'];
  return names[n] ?? '';
}
