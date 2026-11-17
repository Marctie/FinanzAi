/** Formati supportati per mostrare la carta alla cassa (nomi di JsBarcode, più QR). */
export type BarcodeFormat = 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CODE39' | 'ITF' | 'QR' | 'NONE';

export const BARCODE_FORMATS: { id: BarcodeFormat; label: string }[] = [
  { id: 'EAN13',   label: 'EAN-13 (13 cifre, il più comune)' },
  { id: 'EAN8',    label: 'EAN-8' },
  { id: 'CODE128', label: 'Code 128' },
  { id: 'CODE39',  label: 'Code 39' },
  { id: 'UPC',     label: 'UPC-A' },
  { id: 'ITF',     label: 'ITF' },
  { id: 'QR',      label: 'Codice QR' },
  { id: 'NONE',    label: 'Solo numero (senza codice)' },
];

export interface LoyaltyCard {
  id: string;
  store: string;
  number: string;
  format: BarcodeFormat;
  color: string;
  holder?: string;           // intestatario (facoltativo)
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
