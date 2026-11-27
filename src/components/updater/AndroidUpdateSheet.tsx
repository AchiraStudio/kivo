import { useEffect, useState } from 'react';
import { ArrowUpCircle, Download, ShieldCheck, ShieldAlert, Loader2, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import { toast } from '../ui/Toast';
import { UpdateCheckResult } from '../../lib/api';
import { ApkUpdateEvent, getAndroidBridge, onApkUpdate } from '../../lib/androidBridge';
import { useUpdaterStore } from '../../store/UpdaterStore';

const RELEASES_URL = 'https://github.com/AchiraStudio/kivo/releases/latest';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateCheckResult | null;
}

/** Phone version of the update dialog: download the new APK inside the app and install it. */
export default function AndroidUpdateSheet({ isOpen, onClose, updateInfo }: Props) {
  const bridge = getAndroidBridge();
  const dismissVersion = useUpdaterStore((s) => s.dismissVersion);
  const [canInstall, setCanInstall] = useState<boolean>(() => bridge?.canInstallPackages() ?? false);
  const [progress, setProgress] = useState<ApkUpdateEvent | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setProgress(null);
    const off = onApkUpdate(setProgress);
    // Coming back from the "Install unknown apps" screen: re-check the permission.
    const recheck = () => {
      if (document.visibilityState === 'visible') setCanInstall(getAndroidBridge()?.canInstallPackages() ?? false);
    };
    recheck();
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    return () => {
      off();
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, [isOpen]);

  if (!isOpen || !updateInfo) return null;

  const version = updateInfo.latest_version.replace(/^v/i, '');
  const sizeMb = updateInfo.asset_size > 0 ? `${(updateInfo.asset_size / (1024 * 1024)).toFixed(1)} MB` : null;
  const working = progress?.status === 'downloading' || progress?.status === 'verifying';
  const installing = progress?.status === 'installing';
  const failed = progress?.status === 'error';

  const startInstall = () => {
    if (!bridge || !updateInfo.download_url) return;
    setProgress({ status: 'downloading', percent: 0 });
    if (!bridge.downloadAndInstall(updateInfo.download_url)) {
      setProgress({ status: 'error', message: 'Pembaruan sedang berjalan atau alamat tidak valid.' });
    }
  };

  const later = () => {
    dismissVersion(updateInfo.latest_version);
    onClose();
  };

  const copyLink = () => {
    navigator.clipboard
      .writeText(RELEASES_URL)
      .then(() => toast.success('Tautan rilis disalin', 'Tempel di browser untuk mengunduh APK.'))
      .catch(() => toast.info('Unduh APK terbaru di', RELEASES_URL));
  };

  let footer: React.ReactNode;
  if (!bridge || !updateInfo.download_url) {
    footer = (
      <Button variant="outline" size="lg" fullWidth onClick={copyLink} className="h-12 rounded-xl">
        <Copy size={16} /> Salin tautan unduhan
      </Button>
    );
  } else if (working || installing) {
    footer = (
      <div className="h-12 flex items-center justify-center gap-2 text-sm font-bold text-primary">
        <Loader2 size={16} className="animate-spin" />
        {installing ? 'Membuka pemasang...' : progress?.status === 'verifying' ? 'Memeriksa berkas...' : 'Mengunduh...'}
      </div>
    );
  } else if (!canInstall) {
    footer = (
      <Button variant="primary" size="lg" fullWidth onClick={() => bridge.openInstallSettings()} className="h-12 rounded-xl">
        <ShieldAlert size={16} /> Izinkan pemasangan
      </Button>
    );
  } else {
    footer = (
      <div className="grid grid-cols-5 gap-2">
        <Button variant="outline" size="lg" onClick={later} className="col-span-2 h-12 rounded-xl">
          Nanti
        </Button>
        <Button variant="primary" size="lg" onClick={startInstall} className="col-span-3 h-12 rounded-xl">
          <Download size={16} /> {failed ? 'Coba lagi' : 'Perbarui'}
        </Button>
      </div>
    );
  }

  return (
    <Sheet isOpen={isOpen} onClose={working ? () => {} : onClose} footer={footer}>
      <div className="flex items-center gap-3 pb-4">
        <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
          <ArrowUpCircle size={26} />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-extrabold text-heading leading-tight">Pembaruan tersedia</p>
          <p className="text-sm text-dim tnum">
            v{updateInfo.current_version} <span className="mx-1">→</span>
            <span className="font-bold text-primary">v{version}</span>
            {sizeMb && <span className="ml-2 text-xs">({sizeMb})</span>}
          </p>
        </div>
      </div>

      {updateInfo.release_notes && !working && !installing && (
        <div className="mb-3 max-h-44 overflow-y-auto custom-scrollbar p-3 rounded-xl bg-muted/50 border border-line text-xs text-body leading-relaxed whitespace-pre-wrap">
          {updateInfo.release_notes}
        </div>
      )}

      {progress?.status === 'downloading' && (
        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-heading">Mengunduh</span>
            <span className="text-dim tnum">{progress.percent ?? 0}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${progress.percent ?? 0}%` }} />
          </div>
        </div>
      )}

      {installing && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-success-soft border border-success/25 text-success text-xs mb-3">
          <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
          <p className="leading-relaxed">Unduhan selesai. Ketuk <b>Pasang</b> pada layar Android, lalu buka kembali Kivo.</p>
        </div>
      )}

      {failed && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-danger-soft border border-danger/25 text-danger text-xs mb-3">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <p className="leading-relaxed">{progress?.message || 'Pembaruan gagal.'}</p>
        </div>
      )}

      {bridge && !canInstall && !working && !installing && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-warning-soft border border-warning/25 text-warning text-xs">
          <ShieldAlert size={15} className="shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Android meminta izin sekali: aktifkan <b>Izinkan dari sumber ini</b> untuk Kivo, lalu kembali ke sini.
          </p>
        </div>
      )}

      {bridge && canInstall && !failed && !working && !installing && (
        <div className="flex items-start gap-2 text-xs text-dim">
          <ShieldCheck size={15} className="shrink-0 mt-0.5 text-success" />
          <p className="leading-relaxed">Berkas diperiksa (checksum dan tanda tangan) sebelum dipasang. Data Kivo di HP tetap aman.</p>
        </div>
      )}
    </Sheet>
  );
}
