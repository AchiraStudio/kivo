import { useState, useEffect } from 'react';
import { ArrowUpCircle, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
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
      setError('File installer tidak ditemukan.');
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      await downloadAndInstallUpdate(updateInfo.download_url, updateInfo.asset_name);
      setIsLaunched(true);
    } catch (err: any) {
      setError(err?.message || String(err) || 'Gagal mengunduh pembaruan.');
      setIsDownloading(false);
    }
  };

  const sizeMb =
    updateInfo.asset_size > 0
      ? `${(updateInfo.asset_size / (1024 * 1024)).toFixed(1)} MB`
      : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isDownloading ? undefined : onClose}
      size="md"
      icon={ArrowUpCircle}
      iconBg="bg-primary-soft text-primary"
      title="Pembaruan Tersedia"
      closeOnBackdropClick={!isDownloading}
      closeOnEsc={!isDownloading}
      showCloseButton={!isDownloading}
      footer={
        !isDownloading && !isLaunched ? (
          <>
            <Button variant="outline" size="sm" onClick={onClose}>
              Nanti
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleInstall}
              disabled={!updateInfo.download_url}
            >
              <Download size={14} />
              Perbarui
            </Button>
          </>
        ) : isDownloading && !isLaunched ? (
          <span className="inline-flex items-center gap-2 text-xs text-primary font-semibold">
            <Loader2 size={14} className="animate-spin" />
            Mengunduh...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-xs text-success font-semibold">
            <CheckCircle2 size={14} />
            Installer berjalan
          </span>
        )
      }
    >
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/60 border border-line">
          <div className="flex items-center gap-3 font-mono">
            <div>
              <p className="text-[11px] font-sans text-dim">Saat ini</p>
              <p className="font-semibold text-heading">v{updateInfo.current_version}</p>
            </div>
            <span className="text-dim">/</span>
            <div>
              <p className="text-[11px] font-sans text-dim">Terbaru</p>
              <p className="font-bold text-primary">
                {updateInfo.latest_version.startsWith('v')
                  ? updateInfo.latest_version
                  : `v${updateInfo.latest_version}`}
              </p>
            </div>
          </div>
          {sizeMb && (
            <span className="text-[11px] font-mono text-dim bg-card border border-line px-2 py-0.5 rounded-md">
              {sizeMb}
            </span>
          )}
        </div>

        {updateInfo.release_notes && (
          <div>
            <p className="font-semibold text-heading mb-1.5">Catatan Rilis</p>
            <div className="max-h-48 overflow-y-auto custom-scrollbar p-3 rounded-lg bg-muted/40 border border-line text-body text-xs leading-relaxed whitespace-pre-wrap">
              {updateInfo.release_notes}
            </div>
          </div>
        )}

        {isDownloading && (
          <div className="space-y-1.5 pt-2 border-t border-line">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-heading">
                {isLaunched ? 'Siap dipasang' : 'Mengunduh installer'}
              </span>
              <span className="font-mono text-dim font-semibold tnum">
                {progress ? `${Math.round(progress.percentage)}%` : '0%'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200 rounded-full"
                style={{ width: `${progress ? progress.percentage : 5}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-danger-soft border border-danger/25 text-danger">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
