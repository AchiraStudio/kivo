import { useEffect, useState } from 'react';
import { Copy, Navigation, RefreshCw, ClipboardPaste, Code2 } from 'lucide-react';
import { invoke } from '../../lib/api';
import { isTauri } from '../../lib/runtime';

export default function ContextMenu() {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (e.shiftKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      e.preventDefault();
      setShow(true);

      const x = Math.min(e.clientX, window.innerWidth - 208);
      const y = Math.min(e.clientY, window.innerHeight - 220);
      setPosition({ x: Math.max(8, x), y: Math.max(8, y) });
    };

    const handleClose = () => setShow(false);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShow(false);
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', handleClose);
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', handleClose);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  if (!show) return null;

  const itemClass =
    'w-full px-2.5 py-1.5 rounded-md flex items-center gap-2.5 text-xs sm:text-sm font-medium text-heading hover:bg-muted transition-colors cursor-pointer text-left';

  return (
    <div
      role="menu"
      className="fixed z-[1300] w-48 bg-elevated border border-line rounded-lg shadow-lg shadow-black/15 dark:shadow-black/45 p-1 animate-pop-in origin-top-left"
      style={{ top: position.y, left: position.x }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          navigator.clipboard.writeText(window.getSelection()?.toString() || '');
          setShow(false);
        }}
        className={itemClass}
      >
        <Copy size={14} strokeWidth={1.75} className="text-dim" />
        <span>Salin</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          document.execCommand('paste');
          setShow(false);
        }}
        className={itemClass}
      >
        <ClipboardPaste size={14} strokeWidth={1.75} className="text-dim" />
        <span>Tempel</span>
      </button>

      <div className="h-px bg-line my-1" />

      <button
        type="button"
        role="menuitem"
        onClick={() => window.location.reload()}
        className={itemClass}
      >
        <RefreshCw size={14} strokeWidth={1.75} className="text-dim" />
        <span>Muat Ulang</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          window.history.back();
          setShow(false);
        }}
        className={itemClass}
      >
        <Navigation size={14} strokeWidth={1.75} className="text-dim -rotate-90" />
        <span>Kembali</span>
      </button>

      {isTauri() && (
        <>
          <div className="h-px bg-line my-1" />
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setShow(false);
              try {
                await invoke('open_devtools');
              } catch (err) {
                console.error('Failed to open devtools:', err);
              }
            }}
            className="w-full px-2.5 py-1.5 rounded-md flex items-center gap-2.5 text-xs sm:text-sm font-medium text-warning hover:bg-warning-soft transition-colors cursor-pointer text-left"
          >
            <Code2 size={14} strokeWidth={1.75} />
            <span>Inspeksi</span>
          </button>
        </>
      )}
    </div>
  );
}
