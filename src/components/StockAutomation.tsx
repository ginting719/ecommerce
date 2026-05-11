import React, { useState, useRef, useEffect } from 'react';
import { STORES, StoreType } from '@/src/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, CheckCircle2, AlertCircle, Download, Loader2, RefreshCw, Store } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetchInventoryData, logToSpreadsheet, processHalodocStock, processTokopediaStock, getStoresFromStock, InventoryData } from '@/src/services/stockService';

export default function StockAutomation() {
  const [selectedStore, setSelectedStore] = useState<StoreType | ''>('');
  const [selectedStockCol, setSelectedStockCol] = useState<{name: string, colIndex: number} | null>(null);
  const [storeSearch, setStoreSearch] = useState('');
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [availableStores, setAvailableStores] = useState<{name: string, colIndex: number}[]>([]);
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; url?: string; fileName?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadInventory = async () => {
      setIsLoadingInventory(true);
      try {
        const data = await fetchInventoryData();
        setInventory(data);
        const stores = getStoresFromStock(data.stock);
        setAvailableStores(stores);
      } catch (e: any) {
        console.error('Failed to load stores', e);
        toast.error(e.message || 'Gagal memuat data Toko dari Spreadsheet');
      } finally {
        setIsLoadingInventory(false);
      }
    };
    loadInventory();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
    }
  };

  const handleGenerate = async () => {
    if (!selectedStore || !selectedStockCol || !file || !inventory) {
      toast.error('Pilih Marketplace, Toko (Store), dan upload file terlebih dahulu');
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const fileText = await file.text();
      
      let blobContent: any;
      const store = STORES.find(s => s.id === selectedStore);
      
      // 3. Process based on store
      if (selectedStore === 'halodoc') {
        blobContent = processHalodocStock(fileText, inventory, selectedStockCol);
      } else if (selectedStore === 'tokopedia_tiktok') {
        blobContent = processTokopediaStock(fileText, inventory, selectedStockCol);
      } else {
        throw new Error('Store tidak dikenal');
      }
      
      // 4. Create download URL
      const blob = new Blob([blobContent], { 
        type: store?.outputFormat === 'csv' 
          ? 'text/csv' 
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = URL.createObjectURL(blob);
      const outputFileName = `UPDATE_STOK_${store?.name.replace(/ /g, '_')}_${new Date().getTime()}.${store?.outputFormat}`;

      // 5. Log activity
      await logToSpreadsheet({
        user: selectedStockCol.name,
        storeName: store?.name || 'Unknown',
        fileName: file.name,
        status: 'success'
      });
      
      setResult({
        success: true,
        url,
        fileName: outputFileName
      });
      
      toast.success(`Berhasil generate update stok untuk ${store?.name}`);
    } catch (error: any) {
      console.error('Processing error:', error);
      setResult({ success: false });
      toast.error(error.message || 'Gagal memproses file. Silakan periksa konfigurasi Apps Script.');
      
      // Log failure
      const store = STORES.find(s => s.id === selectedStore);
      logToSpreadsheet({
        user: selectedStockCol?.name || 'Unknown',
        storeName: store?.name || 'Unknown',
        fileName: file?.name || 'unknown',
        status: 'failed'
      }).catch(console.error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (result?.url && result?.fileName) {
      const link = document.createElement('a');
      link.href = result.url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-[10px] font-bold uppercase tracking-widest"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-2 rounded-full bg-brand-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
          </span>
          System Online
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
          Automation <span className="text-brand-600">Update Stok</span>
        </h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
          Update stok Halodoc dan tokopedia tiktok dari template asal platform terkait
        </p>
      </div>

      <Card className="border-slate-200/60 shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden bg-white rounded-3xl">

        <CardContent className="p-8 space-y-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between ml-1 h-5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Marketplace Destination</label>
              </div>
              <Select value={selectedStore} onValueChange={(val) => setSelectedStore(val as StoreType)}>
                <SelectTrigger className="w-full h-[48px] bg-slate-50 border-slate-200 hover:border-brand-300 transition-colors rounded-xl">
                  <SelectValue placeholder="Select destination..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200">
                  {STORES.map((store) => (
                    <SelectItem key={store.id} value={store.id} className="rounded-lg focus:bg-brand-50 focus:text-brand-900">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{store.name}</span>
                        <span className="text-[10px] opacity-50 px-1.5 py-0.5 bg-slate-100 rounded uppercase">{store.outputFormat}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Store (Toko)</label>
                <button 
                  onClick={() => {
                    const loadInventory = async () => {
                      setIsLoadingInventory(true);
                      try {
                        const data = await fetchInventoryData();
                        setInventory(data);
                        const stores = getStoresFromStock(data.stock);
                        setAvailableStores(stores);
                        toast.success('Inventory refreshed');
                      } catch (e: any) {
                        toast.error(e.message || 'Gagal refresh data');
                      } finally {
                        setIsLoadingInventory(false);
                      }
                    };
                    loadInventory();
                  }}
                  disabled={isLoadingInventory}
                  className="text-[10px] font-bold text-brand-600 hover:text-brand-700 uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3 w-3", isLoadingInventory && "animate-spin")} />
                  Refresh
                </button>
              </div>
              
              <div className="relative">
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isStoreOpen}
                  disabled={isLoadingInventory || availableStores.length === 0}
                  onClick={() => setIsStoreOpen(!isStoreOpen)}
                  className="w-full h-[48px] bg-slate-50 border-slate-200 hover:border-brand-300 justify-between px-4 rounded-xl font-normal"
                >
                  {selectedStockCol ? (
                    <div className="flex items-center gap-2 truncate">
                      <Store className="h-4 w-4 opacity-50 shrink-0" />
                      <span className="font-semibold truncate">{selectedStockCol.name}</span>
                    </div>
                  ) : (
                    <span className="text-slate-500">{isLoadingInventory ? "Loading stores..." : "Pilih Toko Sumber Stok..."}</span>
                  )}
                  <RefreshCw className={cn("ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform duration-200", isStoreOpen && "rotate-180")} />
                </Button>

                <AnimatePresence>
                  {isStoreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
                    >
                      <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                          <input
                            autoFocus
                            placeholder="Cari toko (misal: tebet)..."
                            className="w-full h-10 bg-white border border-slate-200 rounded-xl px-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                            value={storeSearch}
                            onChange={(e) => setStoreSearch(e.target.value)}
                          />
                          <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          {storeSearch && (
                            <button 
                              onClick={() => setStoreSearch('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-md text-slate-400"
                            >
                              <AlertCircle className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
                        {availableStores
                          .filter(s => s.name.toLowerCase().includes(storeSearch.toLowerCase()))
                          .map((store) => (
                            <button
                              key={store.name + store.colIndex}
                              onClick={() => {
                                setSelectedStockCol(store);
                                setIsStoreOpen(false);
                                setStoreSearch('');
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 group",
                                selectedStockCol?.name === store.name 
                                  ? "bg-brand-50 text-brand-700" 
                                  : "hover:bg-slate-50 text-slate-700"
                              )}
                            >
                              <div className={cn(
                                "p-2 rounded-lg transition-colors",
                                selectedStockCol?.name === store.name ? "bg-white shadow-sm" : "bg-slate-100 group-hover:bg-white"
                              )}>
                                <Store className="h-4 w-4" />
                              </div>
                              <span className="font-semibold text-sm">{store.name}</span>
                              {selectedStockCol?.name === store.name && (
                                <CheckCircle2 className="h-4 w-4 ml-auto" />
                              )}
                            </button>
                          ))}
                        {availableStores.filter(s => s.name.toLowerCase().includes(storeSearch.toLowerCase())).length === 0 && (
                          <div className="p-8 text-center space-y-2">
                            <Store className="h-10 w-10 text-slate-200 mx-auto" />
                            <p className="text-slate-400 text-sm italic">Toko tidak ditemukan</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Outside click handler */}
              {isStoreOpen && <div className="fixed inset-0 z-40" onClick={() => setIsStoreOpen(false)} />}
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !isGenerating && fileInputRef.current?.click()}
            className={cn(
              "group relative border-2 border-dashed rounded-3xl p-12 transition-all duration-300 flex flex-col items-center justify-center gap-6",
              file 
                ? "border-brand-400 bg-brand-50/30 shadow-inner" 
                : "border-slate-200 hover:border-brand-400 hover:bg-slate-50/50",
              isGenerating && "opacity-50 cursor-not-allowed"
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".csv,.xlsx,.xls"
            />
            
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm",
              file 
                ? "bg-brand-600 text-white rotate-0 scale-110" 
                : "bg-white border border-slate-100 text-slate-300 group-hover:text-brand-500 group-hover:scale-105"
            )}>
              {file ? <FileText className="h-10 w-10" /> : <Upload className="h-10 w-10" />}
            </div>

            <div className="text-center space-y-2">
              {file ? (
                <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-900">{file.name}</p>
                  <p className="text-xs font-mono text-slate-400 uppercase tracking-tighter">
                    {(file.size / 1024).toFixed(2)} KB • {file.name.split('.').pop()?.toUpperCase()}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-900">Drop source file here</p>
                  <p className="text-sm text-slate-400 font-medium">Supports .csv, .xlsx, .xls templates</p>
                </div>
              )}
            </div>

            {file && !isGenerating && (
              <button 
                onClick={(e) => { e.stopPropagation(); reset(); }}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white text-slate-400 hover:text-red-500 transition-colors"
              >
                <AlertCircle className="h-5 w-5" />
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4",
                  result.success ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                    result.success ? "bg-white text-emerald-600" : "bg-white text-red-600"
                  )}>
                    {result.success ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                  </div>
                  <div className="text-center md:text-left">
                    <p className={cn("font-bold text-lg", result.success ? "text-emerald-900" : "text-red-900")}>
                      {result.success ? "Processing Complete" : "Processing Failed"}
                    </p>
                    {result.success && (
                      <p className="text-sm text-emerald-700/80 font-medium">Your marketplace-ready file is ready for download.</p>
                    )}
                  </div>
                </div>
                {result.success && (
                  <Button 
                    onClick={handleDownload}
                    className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-8 rounded-xl shadow-lg shadow-emerald-100 gap-2.5"
                  >
                    <Download className="h-5 w-5" />
                    Download Output
                  </Button>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="pt-4">
            <Button
              onClick={handleGenerate}
              disabled={!file || !selectedStore || !selectedStockCol || isGenerating}
              className="w-full h-14 text-lg font-black bg-brand-600 hover:bg-brand-700 text-white shadow-[0_10px_30px_rgba(102,129,242,0.3)] rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
            >
              {isGenerating ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Executing Transformation...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5" />
                  <span>Generate Update Stok</span>
                </div>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>


    </div>
  );
}
