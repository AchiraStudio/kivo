import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Copy } from 'lucide-react';
import { isTauri } from '../lib/runtime';

interface TitleBarProps {
  className?: string;
  theme?: 'dark' | 'light' | 'auto';
  leftContent?: React.ReactNode;
  centerContent?: React.ReactNode;
  rightExtra?: React.ReactNode;
}

export default function TitleBar({
  className = '',
  leftContent,
  centerContent,
  rightExtra,
}: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    try {
      const win = getCurrentWindow();
      win.isMaximized().then(setIsMaximized);

      let unlisten: (() => void) | undefined;
      win.onResized(async () => {
        const max = await win.isMaximized();
        setIsMaximized(max);
      }).then(fn => { unlisten = fn; });

      return () => { unlisten?.(); };
    } catch (e) {
      console.warn('Could not initialize window controls:', e);
    }
  }, []);

  if (!isTauri()) {
    return null;
  }

  const minimize  = () => { if (isTauri()) getCurrentWindow().minimize(); };
  const toggleMax = () => { if (isTauri()) (isMaximized ? getCurrentWindow().unmaximize() : getCurrentWindow().maximize()); };
  const close     = () => { if (isTauri()) getCurrentWindow().close(); };

  return (
    <div
      data-tauri-drag-region
      className={`h-9 shrink-0 w-full bg-sidebar border-b border-sidebar-line text-body select-none relative flex items-center justify-between z-50 ${className}`}
    >
      <div data-tauri-drag-region className="flex items-center gap-2 h-full z-10 pl-3">
        {leftContent || (
          <div className="flex items-center gap-2 select-none">
            <img src="/kivo.png" alt="Kivo" className="w-4 h-4 rounded-sm object-contain" />
            <span className="text-xs font-bold text-heading tracking-tight">Kivo</span>
            <span className="text-[11px] font-mono text-dim">1.5.3</span>
          </div>
        )}
      </div>

      {centerContent && (
        <div
          data-tauri-drag-region
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          {centerContent}
        </div>
      )}

      <div className="flex items-center h-full shrink-0 z-10">
        {rightExtra}

        <button
          type="button"
          onMouseDown={e => e.stopPropagation()}
          onClick={minimize}
          aria-label="Perkecil jendela"
          className="h-full w-11 flex items-center justify-center text-dim hover:text-heading hover:bg-muted transition-colors cursor-pointer"
          title="Perkecil"
        >
          <Minus size={14} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onMouseDown={e => e.stopPropagation()}
          onClick={toggleMax}
          aria-label={isMaximized ? 'Kembalikan ukuran' : 'Perbesar jendela'}
          className="h-full w-11 flex items-center justify-center text-dim hover:text-heading hover:bg-muted transition-colors cursor-pointer"
          title={isMaximized ? 'Pulihkan' : 'Perbesar'}
        >
          {isMaximized
            ? <Copy size={12} strokeWidth={1.75} />
            : <Square size={12} strokeWidth={1.75} />}
        </button>

        <button
          type="button"
          onMouseDown={e => e.stopPropagation()}
          onClick={close}
          aria-label="Tutup aplikasi"
          className="h-full w-11 flex items-center justify-center text-dim hover:bg-danger hover:text-white transition-colors cursor-pointer"
          title="Tutup"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
