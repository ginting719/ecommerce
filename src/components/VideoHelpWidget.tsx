import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const YOUTUBE_VIDEO_ID = '60iK-66J_2g';

export default function VideoHelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showBubble, setShowBubble] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    setShowBubble(false); // sembunyikan bubble setelah pertama diklik
  };

  const handleFullscreen = () => {
    if (!isFullscreen) {
      iframeRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen((prev) => !prev);
  };

  return (
    <>
      {/* Floating Widget Area */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

        {/* Video Panel */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-[340px] rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.20)] border border-slate-200/60 bg-white"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-brand-600 to-indigo-600">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                    <PlayCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold leading-none">Video Tutorial</p>
                    <p className="text-white/70 text-[10px] mt-0.5">Cara penggunaan aplikasi</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleFullscreen}
                    className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                    title="Fullscreen"
                  >
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                    title="Tutup"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* YouTube Iframe */}
              <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 */ }}>
                <iframe
                  ref={iframeRef}
                  src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0&modestbranding=1`}
                  title="Video Tutorial"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full border-0"
                />
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
                <p className="text-[11px] text-slate-400 text-center">
                  Klik ikon <Maximize2 className="inline h-3 w-3 mx-0.5" /> untuk layar penuh
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Bubble Tooltip */}
        <AnimatePresence>
          {showBubble && !isOpen && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              transition={{ delay: 1.2, type: 'spring', stiffness: 260, damping: 20 }}
              className="flex items-end gap-2"
            >
              {/* Bubble */}
              <div className="relative bg-white border border-slate-200 rounded-2xl rounded-br-sm px-4 py-2.5 shadow-lg max-w-[180px]">
                <p className="text-slate-700 text-sm font-semibold leading-snug">
                  Jika bingung tonton aku ya 👋
                </p>
                {/* Bubble tail */}
                <span className="absolute -bottom-2 right-2 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-white drop-shadow-sm" />
                <span className="absolute -bottom-[9px] right-[7px] w-0 h-0 border-l-[9px] border-l-transparent border-t-[9px] border-t-slate-200" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB Button */}
        <motion.button
          onClick={handleToggle}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'relative w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(102,129,242,0.45)] transition-all duration-300',
            isOpen
              ? 'bg-slate-700 shadow-[0_8px_24px_rgba(0,0,0,0.25)]'
              : 'bg-gradient-to-br from-brand-500 to-indigo-600'
          )}
          aria-label="Buka video tutorial"
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.span
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="h-6 w-6 text-white" />
              </motion.span>
            ) : (
              <motion.span
                key="play"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <PlayCircle className="h-6 w-6 text-white" />
              </motion.span>
            )}
          </AnimatePresence>

          {/* Pulse ring */}
          {!isOpen && (
            <span className="absolute inset-0 rounded-full animate-ping bg-brand-400 opacity-30 pointer-events-none" />
          )}
        </motion.button>
      </div>
    </>
  );
}
