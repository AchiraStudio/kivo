import { useState, useEffect } from 'react';
import { ArrowUpCircle, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { UpdateCheckResult, UpdaterProgress, downloadAndInstallUpdate } from '../../lib/api';
import { listen, UnlistenFn } from '../../lib/events';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateCheckResult | null;
}

export default function UpdateModal({ isOpen, onClose, updateInfo }: UpdateModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<UpdaterProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLaunched, setIsLaunched] = useState(false);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    if (isOpen) {
      listen<UpdaterProgress>('updater://progress', (event) => {
        setProgress(event.payload);
        if (event.payload.status === 'ready') {
          setIsLaunched(true);
        }
      }).then((fn) => {
        unlisten = fn;
      });
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [isOpen]);

  if (!updateInfo) return null;

  const handleInstall = async () => {
    if (!updateInfo.download_url || !updateInfo.asset_name) {
      setError('File installer tidak ditemukan pada rilis ini.');
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      await downloadAndInstallUpdate(updateInfo.download_url, updateInfo.asset_name);
      setIsLaunched(true);
    } catch (err: any) {
      setError(err?.message || String(err) || 'Gagal mengunduh atau menjalankan pembaruan.');
      setIsDownloading(false);
    }
  };

  const sizeMb = updateInfo.asset_size > 0
    ? `${(updateInfo.asset_size / (1024 * 1024)).toFixed(1)} MB`
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isDownloading ? undefined : onClose}
      size="md"
      icon={ArrowUpCircle}
      iconBg="bg-primary-soft text-primary"
      title="Pembaruan Kivo Tersedia"
      subtitle={`Versi ${updateInfo.latest_version} telah dirilis`}
      closeOnBackdropClick={!isDownloading}
      closeOnEsc={!isDownloading}
      showCloseButton={!isDownloading}
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          {!isDownloading && !isLaunched && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-dim hover:text-heading transition-colors"
              >
                Nanti Saja
              </button>
              <button
                type="button"
                onClick={handleInstall}
                disabled={!updateInfo.download_url}
                className="btn-primary flex items-center gap-2 text-xs px-4 py-2"
              >
                <Download size={14} />
                <span>Perbarui Sekarang</span>
              </button>
            </>
          )}

          {isDownloading && !isLaunched && (
            <div className="flex items-center gap-2 text-xs text-primary font-medium">
              <Loader2 size={14} className="animate-spin" />
              <span>Mengunduh installer... Harap tunggu</span>
            </div>
          )}

          {isLaunched && (
            <div className="flex items-center gap-2 text-xs text-success font-semibold">
              <CheckCircle2 size={14} />
              <span>Installer berjalan. Kivo akan restart...</span>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Version Banner */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-surface-alt border border-border">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] uppercase font-bold text-dim tracking-wider">Versi Saat Ini</p>
              <p className="font-mono font-semibold text-heading">v{updateInfo.current_version}</p>
            </div>
            <span className="text-dim">→</span>
            <div>
              <p className="text-[10px] uppercase font-bold text-primary tracking-wider">Versi Terbaru</p>
              <p className="font-mono font-bold text-primary">{updateInfo.latest_version}</p>
            </div>
          </div>
          {sizeMb && (
            <span className="text-[11px] font-medium bg-muted text-dim px-2 py-0.5 rounded-md">
              {sizeMb}
            </span>
          )}
        </div>

        {/* Release Notes */}
        {updateInfo.release_notes ? (
          <div>
            <p className="font-semibold text-heading mb-1.5">Catatan Rilis:</p>
            <div className="max-h-48 overflow-y-auto p-3 rounded-lg bg-muted/50 border border-border/60 text-secondary text-[11px] leading-relaxed whitespace-pre-wrap font-sans">
              {updateInfo.release_notes}
            </div>
          </div>
        ) : (
          <p className="text-dim italic">Pembaruan performa dan perbaikan sistem rutin.</p>
        )}

        {/* Download Progress Bar */}
        {isDownloading && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-medium text-heading">
                {isLaunched ? 'Installer Siap' : 'Mengunduh paket instalasi...'}
              </span>
              <span className="font-mono text-dim font-semibold">
                {progress ? `${Math.round(progress.percentage)}%` : '0%'}
              </span>
            </div>

            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${progress ? progress.percentage : 5}%` }}
              />
            </div>

            {progress && progress.total > 0 && (
              <p className="text-[10px] text-dim text-right font-mono">
                {(progress.downloaded / (1024 * 1024)).toFixed(1)} MB / {(progress.total / (1024 * 1024)).toFixed(1)} MB
              </p>
            )}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-[11px]">Gagal Memperbarui</p>
              <p className="text-[11px] leading-normal">{error}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

