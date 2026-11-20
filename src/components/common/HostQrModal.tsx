import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Radio, Laptop, RefreshCw } from 'lucide-react';
import { getLanStatus, LanStatus, getLanPeers, LanPeer } from '../../lib/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useAuthStore, encodeSessionPayload } from '../../store/AuthStore';

interface HostQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HostQrModal({ isOpen, onClose }: HostQrModalProps) {
  const { token, user } = useAuthStore();
  const [status, setStatus] = useState<LanStatus | null>(null);
  const [peers, setPeers] = useState<LanPeer[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchHostInfo = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        getLanStatus(),
        getLanPeers().catch(() => []),
      ]);
      setStatus(s);
      setPeers(p);
    } catch (err) {
      console.warn('Failed to load host LAN status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHostInfo();
    }
  }, [isOpen]);

  const localIp = status?.local_ip || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1');
  const isDev = typeof window !== 'undefined' && window.location.port === '1420';
  const webPort = isDev ? '1420' : (status?.http_port || 3699);

  const sessionPayload = token && user ? encodeSessionPayload(token, user) : '';
  const autoLoginParam = sessionPayload
    ? `?session=${encodeURIComponent(sessionPayload)}&auth_token=${encodeURIComponent(token || '')}`
    : token
    ? `?auth_token=${encodeURIComponent(token)}`
    : '';
  const hostWebUrl = `http://${localIp}:${webPort}${autoLoginParam}`;
  const displayUrl = `http://${localIp}:${webPort}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(hostWebUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Akses Kasir LAN"
      subtitle="Buka di HP atau tablet pada Wi-Fi yang sama"
      size="sm"
      headerRight={
        <button
          type="button"
          onClick={fetchHostInfo}
          disabled={loading}
          aria-label="Muat ulang status"
          className="w-8 h-8 flex items-center justify-center text-dim hover:text-heading hover:bg-muted rounded-lg transition-colors cursor-pointer"
          title="Muat ulang"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-primary' : ''} />
        </button>
      }
      footer={
        <Button variant="primary" size="sm" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between px-3 py-2.5 bg-muted/60 border border-line rounded-lg text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Radio size={15} className="text-success shrink-0" />
            <span className="font-semibold text-heading truncate">
              {status?.device_name || 'Host Kasir'}
            </span>
          </div>
          <span className="font-mono text-dim shrink-0">Port {webPort}</span>
        </div>

        <div className="flex flex-col items-center p-5 bg-card border border-line rounded-xl">
          <div className="p-3 bg-white rounded-lg border border-line">
            <QRCodeSVG value={hostWebUrl} size={172} level="M" includeMargin={false} />
          </div>

          <div className="mt-3.5 w-full flex items-center justify-between gap-2 bg-muted/60 px-3 py-2 rounded-lg border border-line">
            <span className="font-mono text-xs font-semibold text-heading select-all truncate">
              {displayUrl}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Salin URL"
              className="p-1 text-dim hover:text-heading transition-colors cursor-pointer shrink-0"
              title="Salin tautan"
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </button>
          </div>

          {user && (
            <p className="text-[11px] text-dim mt-2">
              Otomatis masuk sebagai <span className="font-semibold text-heading">{user.name}</span>
            </p>
          )}
        </div>

        {peers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-dim">Perangkat terhubung ({peers.length})</p>
            <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
              {peers.map((peer, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg bg-muted/50 border border-line"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Laptop size={13} className="text-dim shrink-0" />
                    <span className="font-semibold text-heading truncate">{peer.device_name}</span>
                    <span className="text-[11px] font-mono text-dim">{peer.ip_address}</span>
                  </div>
                  <span className="text-[11px] font-medium text-dim shrink-0">
                    {peer.role === 'parent' ? 'Host' : 'Client'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
