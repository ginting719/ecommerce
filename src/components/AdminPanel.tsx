import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Search, X, FileText, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STORES } from '@/src/lib/types';
import { fetchLogs } from '@/src/services/stockService';
import { DateRange } from "react-day-picker";
import * as XLSX from 'xlsx';
import { ChevronLeft as ChevronLeftPagination, ChevronRight as ChevronRightPagination, Download } from 'lucide-react';

export default function AdminPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const realLogs = await fetchLogs();
      setLogs(realLogs);
    } catch (e) {
      console.error('Failed to load logs', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange, selectedMarketplace]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      (log.storeName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
      (log.user?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (log.fileName?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const marketplaceName = STORES.find(s => s.id === selectedMarketplace)?.name;
    const matchesMarketplace = selectedMarketplace === 'all' || log.storeName === marketplaceName || (selectedMarketplace === 'halodoc' && log.storeName === 'Halodoc');
    
    let matchesDate = true;
    if (dateRange?.from) {
      try {
        const logDate = new Date(log.timestamp);
        // Normalize time for comparison
        const d = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        const from = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());
        
        if (dateRange.to) {
          const to = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate());
          matchesDate = d >= from && d <= to;
        } else {
          matchesDate = d.getTime() === from.getTime();
        }
      } catch (e) {
        matchesDate = false;
      }
    }
      
    return matchesSearch && matchesMarketplace && matchesDate;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredLogs.map(log => ({
      Timestamp: format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
      Operator: log.user,
      Marketplace: log.storeName,
      'Source Asset': log.fileName,
      Status: log.status
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Logs");
    XLSX.writeFile(workbook, `StockAuto_Logs_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    toast.success('Logs exported to Excel');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search store or operator..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 h-11 bg-slate-50 border-slate-200 focus:ring-brand-500 rounded-xl"
            />
          </div>

          <div className="w-full md:w-56">
            <Select value={selectedMarketplace} onValueChange={setSelectedMarketplace}>
              <SelectTrigger className="h-11 bg-slate-50 border-slate-200 rounded-xl font-medium text-slate-700">
                <SelectValue placeholder="All Marketplaces" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200">
                <SelectItem value="all" className="rounded-lg">All Marketplaces</SelectItem>
                {STORES.map((store) => (
                  <SelectItem key={store.id} value={store.id} className="rounded-lg">
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <Popover>
            <PopoverTrigger 
              render={
                <Button
                  variant="outline"
                  className={cn(
                    "w-full md:w-[280px] h-11 justify-start text-left font-medium rounded-xl border-slate-200 bg-slate-50",
                    !dateRange && "text-slate-400"
                  )}
                />
              }
            >
              <CalendarIcon className="mr-2.5 h-4 w-4 text-brand-600" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Filter by Date Range</span>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-slate-200 rounded-2xl shadow-2xl" align="end">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                initialFocus
                className="rounded-2xl"
              />
            </PopoverContent>
          </Popover>
          
          {dateRange && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setDateRange(undefined)}
              className="h-11 w-11 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          <div className="w-px h-6 bg-slate-200 mx-1 hidden md:block" />

          <Button
            variant="outline"
            onClick={exportToExcel}
            disabled={filteredLogs.length === 0}
            className="h-11 rounded-xl border-brand-200 bg-brand-50/30 text-brand-700 hover:bg-brand-50 hover:text-brand-800 transition-all font-bold gap-2 px-4 shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_10px_30px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50 border-b border-slate-100">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="h-14 px-6 font-bold text-[10px] uppercase tracking-widest text-slate-400">Timestamp</TableHead>
                <TableHead className="h-14 px-6 font-bold text-[10px] uppercase tracking-widest text-slate-400">Operator</TableHead>
                <TableHead className="h-14 px-6 font-bold text-[10px] uppercase tracking-widest text-slate-400">Marketplace</TableHead>
                <TableHead className="h-14 px-6 font-bold text-[10px] uppercase tracking-widest text-slate-400">Source Asset</TableHead>
                <TableHead className="h-14 px-6 font-bold text-[10px] uppercase tracking-widest text-slate-400 text-right flex items-center justify-end gap-2">
                  Status
                  <Button variant="ghost" size="icon" onClick={loadLogs} disabled={isLoading} className="h-6 w-6 rounded-md">
                    <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 className="h-8 w-8 animate-spin opacity-40" />
                      <p className="text-sm font-medium">Fetching logs from spreadsheet...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => (
                  <TableRow key={log.id} className="group hover:bg-slate-50/50 transition-colors border-slate-100">
                    <TableCell className="px-6 py-4 font-mono text-[11px] text-slate-500">
                      {format(new Date(log.timestamp), 'yyyy-MM-dd • HH:mm:ss')}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {log.user.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-semibold text-sm text-slate-700">{log.user}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge variant="outline" className="bg-brand-50/50 text-brand-700 border-brand-100/50 uppercase text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-md">
                        {log.storeName}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        <FileText className="h-3.5 w-3.5 opacity-40" />
                        <span className="text-xs font-medium truncate max-w-[180px]">{log.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          log.status === 'success' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                        )} />
                        <span className={log.status === 'success' ? "text-emerald-600" : "text-red-600"}>
                          {log.status}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
                      <Search className="h-8 w-8 opacity-20" />
                      <p className="text-sm font-medium">No records found matching your criteria</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50/30 border-t border-slate-100">
            <div className="text-xs text-slate-400 font-medium">
              Showing <span className="text-slate-600">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-600">{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</span> of <span className="text-slate-600">{filteredLogs.length}</span> results
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 rounded-lg border-slate-200"
              >
                <ChevronLeftPagination className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      "h-8 w-8 rounded-lg text-xs font-bold",
                      currentPage === page ? "bg-brand-600 text-white shadow-brand-100 shadow-lg" : "text-slate-400 hover:text-slate-900"
                    )}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 rounded-lg border-slate-200"
              >
                <ChevronRightPagination className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
