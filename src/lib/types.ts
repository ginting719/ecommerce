export type StoreType = 'halodoc' | 'tokopedia_tiktok';

export interface Store {
  id: StoreType;
  name: string;
  outputFormat: 'csv' | 'xlsx';
}

export interface StockLog {
  id: string;
  timestamp: string;
  user: string;
  storeName: string;
  fileName: string;
  status: 'success' | 'failed';
}

export const STORES: Store[] = [
  { id: 'halodoc', name: 'Halodoc', outputFormat: 'csv' },
  { id: 'tokopedia_tiktok', name: 'Tokopedia & Tiktok', outputFormat: 'xlsx' },
];
