import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface InventoryData {
  stock: any[][];
  halodoc: any[][];
  log?: any[][];
}

// URL deployment Apps Script yang aktif. Dipakai langsung saat app di-build
// statis (mis. GitHub Pages) yang tidak menjalankan server Node.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHAEXD266ez3egYRElLQ_F3a8An5WaFXY2NEsyKLKO2jey10rq-5AhPgz3IcpepFh_rg/exec";

// Saat development (npm run dev) request lewat proxy server.ts agar tidak
// bergantung pada redirect/CORS Apps Script.
const ENDPOINTS = {
  inventory: '/api/inventory',
  stores: '/api/stores',
  logs: '/api/logs',
  log: '/api/log',
};

// ─── Cache Config ────────────────────────────────────────────────────────────
// localStorage caching dihapus karena Apps Script sudah dioptimasi dan proses fetch full data sangat cepat.

// ─── In-memory cache inventory (per toko, valid 1 sesi) ──────────────────────
const _inventoryCache = new Map<string, InventoryData>();
const _inventoryFetch = new Map<string, Promise<InventoryData>>();

/**
 * Pastikan response benar-benar JSON. Kalau server mengembalikan HTML/teks
 * (misal route tidak ketemu atau Apps Script bermasalah), tampilkan pesan yang
 * jelas daripada error "Unexpected token ... is not valid JSON".
 */
async function readJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Server tidak mengembalikan JSON (HTTP ${response.status}). ` +
        `Kemungkinan proxy API belum aktif atau Apps Script bermasalah.`
    );
  }
  if (!response.ok) {
    const detail = data?.details ? ` — ${data.details}` : '';
    throw new Error(`${data?.error || `HTTP ${response.status}`}${detail}`);
  }
  return data;
}

/**
 * Ambil data JSON dari Apps Script. Di development lewat proxy server.ts;
 * kalau tidak (hasil build statis / GitHub Pages) langsung ke Apps Script.
 */
async function fetchJson(action: string, proxyPath: string, params?: Record<string, any>): Promise<any> {
  if (import.meta.env.DEV) {
    const query = params
      ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      : '';
    return readJsonResponse(await fetch(proxyPath + query, { method: 'GET' }));
  }
  return readJsonResponse(
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...(params || {}) }),
      redirect: 'follow',
    })
  );
}

// ─── Internal fetch inventory (opsional difilter per toko) ────────────────────
async function fetchInventoryDataInternal(store?: string): Promise<InventoryData> {
  const data = await fetchJson('getData', ENDPOINTS.inventory, store ? { store } : undefined);
  if (!data.stock || data.stock.length === 0) {
    throw new Error('Data Stock tidak ditemukan atau kosong di Spreadsheet');
  }
  return data;
}

/**
 * fetchInventoryData — Ambil data stock & halodoc. Kalau `store` diisi, hanya
 * baris milik toko itu yang diambil (payload jauh lebih kecil & cepat).
 * Hasil di-cache per toko selama sesi berjalan.
 */
export const fetchInventoryData = async (store?: string): Promise<InventoryData> => {
  const key = store || '__all__';
  const cached = _inventoryCache.get(key);
  if (cached) return cached;

  const inflight = _inventoryFetch.get(key);
  if (inflight) return inflight;

  const request = fetchInventoryDataInternal(store)
    .then((data) => {
      _inventoryCache.set(key, data);
      return data;
    })
    .finally(() => _inventoryFetch.delete(key));

  _inventoryFetch.set(key, request);
  return request;
};

/**
 * fetchStoreList — Hanya mengambil daftar nama toko (dipakai untuk dropdown di
 * layar utama tanpa menarik full stock).
 */
export const fetchStoreList = async (refresh = false): Promise<{ name: string; colIndex: number }[]> => {
  const data = await fetchJson('getStoreNames', ENDPOINTS.stores, refresh ? { nocache: true } : undefined);
  const names: string[] = Array.isArray(data.stores) ? data.stores : [];
  return names.map((name) => ({ name, colIndex: -1 }));
};

/** Hapus semua cache (saat user klik Refresh) */
export const clearAllCache = () => {
  _inventoryCache.clear();
  _inventoryFetch.clear();
};

export const fetchLogs = async () => {
  try {
    const data = await fetchJson('getLogs', ENDPOINTS.logs);
    console.log('Raw logs data received:', data);
    
    if (!data.log || data.log.length < 2) {
      console.warn('Logs sheet is empty or only contains header');
      return [];
    }
    
    // Skip header and map to readable format
    const mappedLogs = data.log.slice(1).map((row: any[], index: number) => {
      // Validate row has data
      if (!row || row.length === 0) return null;
      
      return {
        id: `log-${index}`,
        timestamp: row[0],
        user: row[1] || 'Unknown',
        storeName: row[2] || 'Unknown',
        fileName: row[3] || 'Unknown',
        status: row[4] || 'failed'
      };
    }).filter(Boolean).reverse(); // Newest first
    
    console.log('Mapped logs:', mappedLogs);
    return mappedLogs;
  } catch (error) {
    console.error('fetchLogs error:', error);
    return [];
  }
};

export const logToSpreadsheet = async (log: any) => {
  try {
    if (import.meta.env.DEV) {
      await fetch(ENDPOINTS.log, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addLog', log }),
      });
    } else {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addLog', log }),
        redirect: 'follow',
      });
    }
  } catch (e) {
    console.error('Failed to log to spreadsheet', e);
  }
};

export const getStoresFromStock = (stock: any[][]) => {
  if (stock.length < 2) return [];
  const header = stock[0];
  
  // If first column is "NAMA TOKO", we extract unique names from that column
  if (header[0] === "NAMA TOKO") {
    const stores = new Set<string>();
    for (let i = 1; i < stock.length; i++) {
      const name = String(stock[i][0] || '').trim();
      if (name) stores.add(name);
    }
    return Array.from(stores).sort().map(name => ({
      name,
      colIndex: -1 // Special value to indicate name-based filtering
    }));
  }

  // Fallback to column-based (old logic: stores start from index 3)
  return header.slice(3).map((name: string, index: number) => ({
    name: name || `Store ${index + 1}`,
    colIndex: index + 3
  }));
};

const getMappings = (inventory: InventoryData, storeSelection: { colIndex: number; name?: string }) => {
  // 1. Mapping Halodoc: ID Jembatan -> { MotherCode, QtyConversion, HargaProduct, HargaApprove }
  const halodocMap = new Map();
  for (let i = 1; i < inventory.halodoc.length; i++) {
    const row = inventory.halodoc[i];
    const motherCode = row[0]; // MOTHER CODE (Col A)
    const idJembatan = row[3]; // ID JEMBATAN (Col D)
    const hargaProduct = row[6]; // HARGA PRODUCT (Col G)
    const qtyConvertion = parseFloat(row[7]) || 1; // QTY CONVERTION (Col H)
    const hargaApprove = row[8]; // HARGA APPROVE (Col I)
    if (idJembatan) {
      halodocMap.set(String(idJembatan).trim(), { motherCode, qtyConvertion, hargaProduct, hargaApprove });
    }
  }

  // 2. Mapping Stock: ItemCode -> Stok
  const stockMap = new Map();
  const isNameBased = storeSelection.colIndex === -1 && storeSelection.name;
  
  for (let i = 1; i < inventory.stock.length; i++) {
    const row = inventory.stock[i];
    
    // Default column structure for name-based (NAMA TOKO structure)
    // Col A: NAMA TOKO, Col B: STORE CODE, Col C: ITEM CODE, Col D: NAMA ITEM, Col E: STOK
    let itemCode = '';
    let stok = 0;
    let shouldInclude = false;

    if (isNameBased) {
      // Filter by Store Name in Col A (index 0) - Trimmed and case-insensitive matching
      const rowStoreName = String(row[0] || '').trim().toLowerCase();
      const targetStoreName = String(storeSelection.name || '').trim().toLowerCase();
      if (rowStoreName === targetStoreName) {
        itemCode = row[2]; // ITEM CODE is index 2 (Col C)
        const valStr = String(row[4] || '').replace(',', '.');
        stok = parseFloat(valStr) || 0; // STOK is index 4 (Col E)
        if (stok < 0) stok = 0; // Auto convert negative stock to 0
        shouldInclude = true;
      }
    } else {
      // Column-based: Col B (index 1) is Item Code, selected col is Stok
      itemCode = row[1];
      const valStr = String(row[storeSelection.colIndex] || '').replace(',', '.');
      stok = parseFloat(valStr) || 0;
      if (stok < 0) stok = 0; // Auto convert negative stock to 0
      shouldInclude = true;
    }

    if (shouldInclude && itemCode) {
      // Defensively keep maximum stock value if item exists, but always ensure it's at least 0
      const existingStok = stockMap.get(String(itemCode).trim()) || 0;
      const finalVal = Math.max(existingStok, stok, 0);
      stockMap.set(String(itemCode).trim(), finalVal);
    }
  }

  return { halodocMap, stockMap };
};

export const processHalodocStock = (
  csvContent: string,
  inventory: InventoryData,
  storeSelection: { colIndex: number; name?: string }
): string => {
  const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  const data = parsed.data as any[];
  const { halodocMap, stockMap } = getMappings(inventory, storeSelection);

  const updatedData = data.map((row) => {
    const sku = row['PRODUCT_SKU'];
    if (!sku) return row;

    const mapping = halodocMap.get(String(sku).trim());
    if (mapping) {
      if (String(mapping.hargaProduct).trim() !== 'Jual Approve') {
        return {
          ...row,
          'INVENTORY_STOCK': 0
        };
      }

      // Defensively parse and sanitize rawStock
      let rawStock = stockMap.get(String(mapping.motherCode));
      if (rawStock === undefined || rawStock === null) {
        rawStock = 0;
      }
      if (typeof rawStock === 'string') {
        rawStock = parseFloat(rawStock) || 0;
      }
      if (rawStock < 0) {
        rawStock = 0;
      }

      // User requested division: "dibagi oleh QTY konversion"
      const divisor = parseFloat(mapping.qtyConvertion) || 1;
      let convertedStock = Math.floor(rawStock / divisor);
      if (convertedStock < 0) {
        convertedStock = 0;
      }
      
      // Ambil 80% dari stok
      let finalStock = Math.floor(convertedStock * 0.8);
      if (finalStock < 0) {
        finalStock = 0;
      }

      // Ambil HARGA APPROVE dari kolom I sheet HALODOC
      const rawHarga = mapping.hargaApprove;
      const parsedHarga = parseFloat(String(rawHarga || '').replace(/,/g, '')) || 0;
      
      return {
        ...row,
        'INVENTORY_STOCK': finalStock,
        'PRODUCT_PRICE': parsedHarga > 0 ? parsedHarga : row['PRODUCT_PRICE']
      };
    }
    
    // Jika tidak ditemukan di mapping (Lookup gagal)
    return {
      ...row,
      'INVENTORY_STOCK': 0
    };
  });

  return Papa.unparse(updatedData);
};


