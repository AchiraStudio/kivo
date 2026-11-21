import { useEffect, useState } from 'react';
import {
  Cpu,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Power,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import {
  getMcpStatus,
  setMcpEnabled,
  regenerateMcpToken,
  listMcpTools,
  McpStatus,
} from '../../lib/api';
import { isDesktopTauri } from '../../lib/runtime';
import Button from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';

export default function McpSettings() {
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadStatus = async () => {
    if (!isDesktopTauri()) {
      setLoading(false);
      return;
    }
    try {
      const [st, tl] = await Promise.all([getMcpStatus(), listMcpTools()]);
      setStatus(st);
      setTools(tl);
    } catch (e: any) {
      toast.error(`Gagal memuat status MCP: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const copyText = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} disalin ke clipboard.`);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
  };

  const handleToggle = async () => {
    if (!status) return;
    setToggling(true);
    try {
      const next = await setMcpEnabled(!status.running);
      setStatus(next);
      toast.success(next.running ? 'MCP Server diaktifkan.' : 'MCP Server dimatikan.');
    } catch (e: any) {
      toast.error(`Gagal mengubah status MCP: ${e?.message || e}`);
    } finally {
      setToggling(false);
    }
  };

  const handleRegenerate = async () => {
    setRotating(true);
    try {
      const newToken = await regenerateMcpToken();
      setStatus((prev) => (prev ? { ...prev, token: newToken } : prev));
      toast.success('Bearer token MCP diperbarui.');
    } catch (e: any) {
      toast.error(`Gagal memperbarui token: ${e?.message || e}`);
    } finally {
      setRotating(false);
    }
  };

  if (!isDesktopTauri()) {
    return (
      <div className="bg-card border border-line rounded-xl p-6 text-center space-y-2">
        <Cpu size={24} className="text-dim mx-auto" />
        <h3 className="text-sm font-bold text-heading">MCP Server hanya tersedia di Desktop</h3>
        <p className="text-xs text-dim">
          Jalankan aplikasi desktop Kivo di Windows/macOS/Linux untuk mengaktifkan endpoint lokal MCP.
        </p>
      </div>
    );
  }

  const clientConfigJson = status
    ? JSON.stringify(
        {
          mcpServers: {
            kivo: {
              url: status.url,
              headers: {
                Authorization: `Bearer ${status.token}`,
              },
            },
          },
        },
        null,
        2
      )
    : '';

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl">
      {/* Status & Controls Card */}
      <div className="bg-card border border-line rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
                status?.running
                  ? 'bg-success-soft text-success border-success/25'
                  : 'bg-muted text-dim border-line'
              }`}
            >
              <Cpu size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-heading">Kivo MCP Server</h3>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                    status?.running
                      ? 'bg-success-soft text-success'
                      : 'bg-muted text-dim'
                  }`}
                >
                  {loading ? 'Memeriksa...' : status?.running ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <p className="text-xs text-dim mt-0.5">
                Auto-start saat aplikasi dibuka. Hubungkan Claude Desktop, Cursor, atau Antigravity langsung ke data Kivo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={loadStatus} disabled={loading}>
              <RefreshCw size={13} />
              Refresh
            </Button>
            <Button
              variant={status?.running ? 'outline' : 'primary'}
              size="sm"
              onClick={handleToggle}
              loading={toggling}
            >
              <Power size={13} />
              {status?.running ? 'Matikan' : 'Aktifkan'}
            </Button>
          </div>
        </div>

        {status && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-line">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dim">Endpoint Streamable HTTP</label>
              <div className="flex items-center gap-1.5">
                <input
                  readOnly
                  value={status.url}
                  className="flex-1 h-9 px-3 rounded-lg bg-input border border-line text-xs font-mono text-heading"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyText(status.url, 'url', 'Endpoint URL')}
                >
                  {copiedKey === 'url' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-dim">Bearer API Token</label>
              <div className="flex items-center gap-1.5">
                <input
                  readOnly
                  type={showToken ? 'text' : 'password'}
                  value={status.token}
                  className="flex-1 h-9 px-3 rounded-lg bg-input border border-line text-xs font-mono text-heading"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowToken((v) => !v)}
                  title={showToken ? 'Sembunyikan' : 'Tampilkan'}
                >
                  {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyText(status.token, 'token', 'Bearer token')}
                >
                  {copiedKey === 'token' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  loading={rotating}
                  title="Buat token baru"
                >
                  <RefreshCw size={13} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/60 border border-line text-xs text-body">
          <ShieldCheck size={15} className="text-success shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-heading">Batas Keamanan Aktif:</span>{' '}
            MCP hanya bind ke <code className="font-mono text-heading">127.0.0.1</code> dengan Bearer token.
            Operasi admin destruktif (reset DB, hapus user, ubah role permission, API key/cloud config) diblokir secara permanen.
          </div>
        </div>
      </div>

      {/* One-Click Client Config */}
      {status && (
        <div className="bg-card border border-line rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-heading">Konfigurasi Client (Claude / Cursor / Antigravity)</h4>
              <p className="text-xs text-dim">Salin konfigurasi JSON ini ke pengaturan MCP client Anda.</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => copyText(clientConfigJson, 'config', 'Konfigurasi MCP')}
            >
              {copiedKey === 'config' ? <Check size={13} /> : <Copy size={13} />}
              Salin JSON
            </Button>
          </div>
          <pre className="p-3.5 rounded-lg bg-muted border border-line text-xs font-mono text-heading overflow-x-auto custom-scrollbar">
            {clientConfigJson}
          </pre>
        </div>
      )}

      {/* Available Tools List */}
      <div className="bg-card border border-line rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wrench size={15} className="text-primary" />
            <h4 className="text-sm font-bold text-heading">Tool MCP Tersedia ({tools.length})</h4>
          </div>
          {status && (
            <span className="text-xs text-dim tnum">Total panggilan sesi ini: {status.total_calls}</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
          {tools.map((t) => (
            <div key={t.name} className="p-2.5 rounded-lg border border-line bg-background/50">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-semibold text-heading truncate">{t.name}</span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    t.annotations?.readOnlyHint
                      ? 'bg-muted text-dim'
                      : 'bg-primary-soft text-primary'
                  }`}
                >
                  {t.annotations?.readOnlyHint ? 'Read' : 'Write'}
                </span>
              </div>
              <p className="text-[11px] text-dim mt-1 line-clamp-2">{t.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
