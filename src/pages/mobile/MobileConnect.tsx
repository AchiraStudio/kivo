import { useState } from 'react';
import { ScanLine, Wifi, ChevronRight, Smartphone, ArrowLeft, History, CircleHelp } from 'lucide-react';
import KivoLogo from '../../components/common/KivoLogo';
import Button from '../../components/ui/Button';
import BarcodeCameraModal from '../../components/ui/BarcodeCameraModal';
import { toast } from '../../components/ui/Toast';
import { decodeSessionPayload, useAuthStore } from '../../store/AuthStore';
import { parseHostLink, setHostUrl, setMobileMode, clearSkipAutoJoin } from '../../lib/runtime';

interface MobileConnectProps {
  /** "first-run" offers the standalone option, "switch" is shown when changing server. */
  variant: 'first-run' | 'switch';
  onCancel?: () => void;
}

const RECENT_KEY = 'kivo_recent_hosts';

function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string').slice(0, 3) : [];
  } catch {
    return [];
  }
}

function rememberHost(url: string) {
  try {
    const next = [url, ...readRecent().filter((u) => u !== url)].slice(0, 3);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Non-critical
  }
}

async function verifyHost(hostUrl: string): Promise<{ name: string }> {
  let res: Response;
  try {
    res = await fetch(`${hostUrl}/api/lan/info`, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw new Error('Komputer kasir tidak merespons. Pastikan HP dan komputer ada di Wi-Fi yang sama dan Kivo sedang menyala.');
  }
  if (!res.ok) throw new Error(`Server menjawab dengan kesalahan (${res.status}).`);
  const info = await res.json().catch(() => null);
  if (!info || info.app !== 'kivo') throw new Error('Alamat ini bukan komputer kasir Kivo.');
  return { name: String(info.device_name || 'Kasir Utama') };
}

export default function MobileConnect({ variant, onCancel }: MobileConnectProps) {
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const recent = readRecent();

  const connect = async (raw: string) => {
    setError('');
    const parsed = parseHostLink(raw);
    if (!parsed) {
      setError('Alamat tidak valid. Contoh: 192.168.1.8');
      return;
    }
    setBusy(true);
    try {
      const { name } = await verifyHost(parsed.hostUrl);
      setHostUrl(parsed.hostUrl);
      setMobileMode('client');
      rememberHost(parsed.hostUrl);
      clearSkipAutoJoin();

      // The Host QR embeds the cashier's session so the phone signs in automatically.
      const session = parsed.session ? decodeSessionPayload(parsed.session) : null;
      if (session) {
        useAuthStore.getState().setAuth(session.token, session.user);
      } else {
        useAuthStore.getState().clearAuth();
      }
      toast.success('Terhubung', name);
      // Reload so every hook (live sync, session check) starts against the new host.
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || String(e));
      setBusy(false);
    }
  };

  const useStandalone = () => {
    setMobileMode('standalone');
    window.location.reload();
  };

  return (
    <div className="h-[100dvh] w-full bg-background flex flex-col overflow-y-auto select-none">
      <div className="flex-1 w-full max-w-md mx-auto px-5 pt-10 pb-6 flex flex-col">
        {variant === 'switch' && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="self-start -ml-1 mb-4 inline-flex items-center gap-1.5 h-10 px-2 rounded-lg text-sm font-semibold text-dim active:bg-muted cursor-pointer"
          >
            <ArrowLeft size={16} /> Kembali
          </button>
        )}

        <div className="flex flex-col items-center text-center mb-8">
          <KivoLogo size={56} />
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-heading">
            {variant === 'first-run' ? 'Selamat datang di Kivo' : 'Ganti Komputer Kasir'}
          </h1>
          <p className="mt-2 text-sm text-dim max-w-[22rem]">
            Hubungkan HP ini ke komputer kasir untuk berjualan, cek stok, dan lihat laporan secara langsung.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setScanning(true)}
          disabled={busy}
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-primary text-white text-left active:scale-[0.99] transition-transform cursor-pointer disabled:opacity-60"
        >
          <span className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <ScanLine size={24} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-base font-bold">Scan QR dari komputer</span>
            <span className="block text-xs text-white/80 mt-0.5">Cara tercepat, langsung masuk otomatis</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-white/80" />
        </button>

        <div className="flex items-center gap-3 my-5 text-xs font-semibold text-dim">
          <div className="flex-1 h-px bg-line" />
          atau ketik alamat
          <div className="flex-1 h-px bg-line" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            connect(address);
          }}
          className="space-y-3"
        >
          <div className="relative">
            <Wifi size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
            <input
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="192.168.1.8"
              aria-label="Alamat komputer kasir"
              className="w-full h-12 pl-11 pr-3 rounded-xl bg-input border border-line text-base text-heading font-mono placeholder:text-dim focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-danger-soft border border-danger/25 text-danger text-xs font-medium leading-relaxed">
              {error}
            </div>
          )}

          <Button type="submit" variant="outline" size="lg" fullWidth loading={busy} disabled={!address.trim()} className="h-12 rounded-xl">
            Hubungkan
          </Button>
        </form>

        {recent.length > 0 && (
          <div className="mt-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-dim mb-2">
              <History size={13} /> Terakhir dipakai
            </p>
            <div className="space-y-1.5">
              {recent.map((url) => (
                <button
                  key={url}
                  type="button"
                  disabled={busy}
                  onClick={() => connect(url)}
                  className="w-full h-11 px-3.5 rounded-xl border border-line bg-card text-left text-sm font-mono text-heading active:bg-muted cursor-pointer disabled:opacity-60"
                >
                  {url.replace(/^http:\/\//, '')}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="mt-5 self-start inline-flex items-center gap-1.5 h-10 text-xs font-semibold text-primary cursor-pointer"
        >
          <CircleHelp size={14} /> Di mana saya menemukan QR-nya?
        </button>
        {showHelp && (
          <ol className="mt-1 mb-2 space-y-1.5 text-xs text-dim list-decimal pl-5 leading-relaxed">
            <li>Buka Kivo di komputer kasir dan masuk.</li>
            <li>Klik ikon <span className="font-semibold text-heading">QR</span> di bilah atas (Host QR).</li>
            <li>Arahkan kamera HP ke kode yang muncul.</li>
          </ol>
        )}

        {variant === 'first-run' && (
          <div className="mt-auto pt-8">
            <button
              type="button"
              onClick={useStandalone}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-line-strong/60 text-left active:bg-muted cursor-pointer"
            >
              <Smartphone size={18} className="text-dim shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-heading">Pakai mandiri di HP ini</span>
                <span className="block text-xs text-dim">Tanpa komputer kasir. Data disimpan di HP.</span>
              </span>
              <ChevronRight size={16} className="text-dim shrink-0" />
            </button>
          </div>
        )}
      </div>

      <BarcodeCameraModal
        isOpen={scanning}
        onClose={() => setScanning(false)}
        onDetected={(code) => connect(code)}
        title="Scan QR Komputer Kasir"
      />
    </div>
  );
}
