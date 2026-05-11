import React, { useState } from 'react';
import StockAutomation from './components/StockAutomation';
import AdminPanel from './components/AdminPanel';
import { Button } from '@/components/ui/button';
import { Lock, Unlock, LayoutDashboard, History, ChevronLeft, RefreshCw } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const handleAdminLogin = () => {
    // Simple demo password
    if (password === 'admin123') {
      setIsAdmin(true);
      setShowAdminPanel(true);
      setIsLoginOpen(false);
      setPassword('');
      toast.success('Berhasil masuk sebagai Admin');
    } else {
      toast.error('Password salah!');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setShowAdminPanel(false);
    toast.info('Keluar dari mode Admin');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-brand-100 selection:text-brand-900">
      <Toaster position="top-center" />

      {/* Navigation / Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => setShowAdminPanel(false)}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <img src="https://cdn.jsdelivr.net/gh/ginting719/Audio/LOGO-01.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-none tracking-tight text-slate-900">Automation Update stock</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Ecommerce Alpro Indonesia</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isAdmin ? (
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-full border border-slate-200">
                <Button
                  variant={!showAdminPanel ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setShowAdminPanel(false)}
                  className={cn(
                    "rounded-full px-4 h-8 text-xs font-semibold transition-all",
                    !showAdminPanel ? "bg-white text-slate-900 shadow-sm hover:bg-white" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
                  Tool
                </Button>
                <Button
                  variant={showAdminPanel ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setShowAdminPanel(true)}
                  className={cn(
                    "rounded-full px-4 h-8 text-xs font-semibold transition-all",
                    showAdminPanel ? "bg-white text-slate-900 shadow-sm hover:bg-white" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <History className="h-3.5 w-3.5 mr-1.5" />
                  Logs
                </Button>
                <div className="w-px h-4 bg-slate-200 mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="rounded-full h-8 text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  Logout
                </Button>
              </div>
            ) : (
              <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
                <DialogTrigger render={<Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 transition-colors" />}>
                  <Lock className="h-4 w-4 text-slate-400" />
                </DialogTrigger>
                <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden border-none shadow-2xl">
                  <div className="bg-brand-600 p-8 text-white text-center space-y-2">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                      <Unlock className="h-6 w-6 text-white" />
                    </div>
                    <DialogTitle className="text-xl font-bold">Admin Access</DialogTitle>
                    <DialogDescription className="text-brand-100 text-sm">
                      Enter your credentials to access the system logs.
                    </DialogDescription>
                  </div>
                  <div className="p-8 space-y-6 bg-white">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-400">Security Key</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-11 border-slate-200 focus:ring-brand-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                      />
                    </div>
                    <Button onClick={handleAdminLogin} className="w-full h-11 bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-100 font-bold">
                      Authenticate
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 md:py-12">
        <AnimatePresence mode="wait">
          {showAdminPanel ? (
            <motion.div
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-4 mb-8">
                <Button variant="ghost" size="sm" onClick={() => setShowAdminPanel(false)} className="gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  Kembali
                </Button>
                <h2 className="text-2xl font-bold">Log Aktivitas Update Stok</h2>
              </div>
              <AdminPanel />
            </motion.div>
          ) : (
            <motion.div
              key="automation"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <StockAutomation />
            </motion.div>
          )}
        </AnimatePresence>
      </main>


    </div>
  );
}
