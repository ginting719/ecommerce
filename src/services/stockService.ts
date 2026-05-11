import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface InventoryData {
  stock: any[][];
  halodoc: any[][];
  log?: any[][];
}

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby5BpmcGqqB7JOGCj1th-LZ7aPSxdHcNOquk2dMeF2rudxMsOsgkth7LfRN9GSq-df47Q/exec";

export const fetchInventoryData = async (retries = 12, delay = 2500): Promise<InventoryData> => {
  try {
    // Talk directly to Google Apps Script
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // GAS sometimes prefers this for CORS
      },
      body: JSON.stringify({ action: "getData" }),
      redirect: 'follow'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: Gagal mengambil data dari Google Sheets.`);
    }

    const data = await response.json();
    
    // Basic validation to ensure we have stock data
    if (!data.stock || data.stock.length === 0) {
      throw new Error('Data Stock tidak ditemukan atau kosong di Spreadsheet');
    }
    
    return data;
  } catch (error: any) {
    console.error('fetchInventoryData final error:', error);
    throw error;
  }
};

export const fetchLogs = async () => {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action: "getLogs" }),
      redirect: 'follow'
    });
    
    if (!response.ok) throw new Error('Gagal memuat log');
    
    const data = await response.json();
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
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'addLog',
        log: log
      }),
      redirect: 'follow'
    });
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
  // 1. Mapping Halodoc: ID Jembatan -> { MotherCode, QtyConversion, HargaProduct }
  const halodocMap = new Map();
  for (let i = 1; i < inventory.halodoc.length; i++) {
    const row = inventory.halodoc[i];
    const motherCode = row[0]; // MOTHER CODE (Col A)
    const idJembatan = row[3]; // ID JEMBATAN (Col D)
    const hargaProduct = row[6]; // HARGA PRODUCT (Col G)
    const qtyConvertion = parseFloat(row[7]) || 1; // QTY CONVERTION (Col H)
    if (idJembatan) {
      halodocMap.set(String(idJembatan).trim(), { motherCode, qtyConvertion, hargaProduct });
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
      // Filter by Store Name in Col A (index 0)
      if (String(row[0] || '').trim() === storeSelection.name) {
        itemCode = row[2]; // ITEM CODE is index 2 (Col C)
        stok = parseFloat(row[4]) || 0; // STOK is index 4 (Col E)
        shouldInclude = true;
      }
    } else {
      // Column-based: Col B (index 1) is Item Code, selected col is Stok
      itemCode = row[1];
      stok = parseFloat(row[storeSelection.colIndex]) || 0;
      shouldInclude = true;
    }

    if (shouldInclude && itemCode) {
      stockMap.set(String(itemCode).trim(), stok);
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

      const rawStock = stockMap.get(String(mapping.motherCode)) || 0;
      // User requested division: "dibagi oleh QTY konversion"
      const divisor = mapping.qtyConvertion || 1;
      const convertedStock = Math.floor(rawStock / divisor);
      
      // Ambil 80% dari stok
      const finalStock = Math.floor(convertedStock * 0.8);
      
      return {
        ...row,
        'INVENTORY_STOCK': finalStock
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

export const processTokopediaStock = (
  csvContent: string,
  inventory: InventoryData,
  storeSelection: { colIndex: number; name?: string }
): Uint8Array => {
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

      const rawStock = stockMap.get(String(mapping.motherCode)) || 0;
      const divisor = mapping.qtyConvertion || 1;
      const convertedStock = Math.floor(rawStock / divisor);
      
      // Ambil 80% dari stok
      const finalStock = Math.floor(convertedStock * 0.8);
      
      return {
        ...row,
        'INVENTORY_STOCK': finalStock
      };
    }
    
    // Jika tidak ditemukan di mapping (Lookup gagal)
    return {
      ...row,
      'INVENTORY_STOCK': 0
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(updatedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Update');
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(excelBuffer);
};
