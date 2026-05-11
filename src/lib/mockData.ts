import { StockLog } from './types';

export const MOCK_LOGS: StockLog[] = [
  {
    id: '1',
    timestamp: '2024-03-20T10:00:00Z',
    user: 'Admin Utama',
    storeName: 'Tokopedia & Tiktok',
    fileName: 'stok_maret_v1.xlsx',
    status: 'success',
  },
  {
    id: '2',
    timestamp: '2024-03-20T11:30:00Z',
    user: 'Staff Gudang A',
    storeName: 'Halodoc',
    fileName: 'halodoc_update.csv',
    status: 'success',
  },
  {
    id: '3',
    timestamp: '2024-03-21T09:15:00Z',
    user: 'Staff Gudang B',
    storeName: 'Tokopedia & Tiktok',
    fileName: 'tiktok_stok_final.xlsx',
    status: 'success',
  },
  {
    id: '4',
    timestamp: '2024-03-21T14:45:00Z',
    user: 'Admin Utama',
    storeName: 'Tokopedia & Tiktok',
    fileName: 'revisi_stok.xlsx',
    status: 'failed',
  },
  {
    id: '5',
    timestamp: '2024-03-22T08:00:00Z',
    user: 'Staff Gudang A',
    storeName: 'Halodoc',
    fileName: 'halodoc_pagi.csv',
    status: 'success',
  },
];
