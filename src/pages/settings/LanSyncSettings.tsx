import { useState, useEffect } from 'react';
import { Wifi, Server, Laptop, RefreshCw, AlertTriangle, CheckCircle2, Radio, Loader2, Network, Unplug, Activity, Terminal, Copy, Check, X, Plug } from 'lucide-react';
import {
  getLanStatus,
  getLanPeers,
  scanLanSubnet,
  setLanRole,
  setLanDeviceName,
  setLanAutoConnect,
  connectLanParent,
  disconnectLanParent,
  parentRequestConnectChild,
  testLanConnection,
  triggerLanSyncNow,
  LanStatus,
  LanPeer,
  LanConnectionTestResult,
  LanSyncResult
} from '../../lib/api';
import { listen } from '../../lib/events';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Button from '../../components/ui/Button';

export default function LanSyncSettings() {
  const [status, setStatus] = useState<LanStatus | null>(null);
  const [peers, setPeers] = useState<LanPeer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isScanningSubnet, setIsScanningSubnet] = useState(false);
  const [parentConnectingChild, setParentConnectingChild] = useState<string | null>(null);
  const [connectingPeer, setConnectingPeer] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Manual IP Connect state
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState('3699');
  const [isTestingManual, setIsTestingManual] = useState(false);
  const [isConnectingManual, setIsConnectingManual] = useState(false);
  const [manualTestResult, setManualTestResult] = useState<LanConnectionTestResult | null>(null);

  // Instant Sync state
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncResult, setSyncResult] = useState<LanSyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Diagnostics Modal State
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticTarget, setDiagnosticTarget] = useState<{ ip: string; port: number; name: string } | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<LanConnectionTestResult | null>(null);
  const [isTestingDiagnostics, setIsTestingDiagnostics] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);

  // Disconnect confirmation modal
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Connection Feedback Banner State
  const [connectFeedback, setConnectFeedback] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);

  const handleScanSubnet = async () => {
    setIsScanningSubnet(true);
    try {
      const p = await scanLanSubnet();
      setPeers(p);
    } catch (err) {
      console.error('Failed to scan subnet:', err);
    } finally {
      setIsScanningSubnet(false);
    }
  };

  const loadData = async () => {
    setLoadError('');
    try {
      const [s, p] = await Promise.all([getLanStatus(), getLanPeers()]);
      setStatus(s);
      setPeers(p);
      setDeviceName(s.device_name);
      if (s.paired_parent_ip && !manualIp) {
        setManualIp(s.paired_parent_ip);
      }
    } catch (err: any) {
      console.error('Failed to fetch LAN status:', err);
      setLoadError(err?.message || String(err) || 'Gagal memuat status jaringan LAN.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    let unlistenPeers: (() => void) | undefined;
    listen<LanPeer[]>('kivo:lan_peers_updated', (event) => {
      setPeers(event.payload);
    }).then(unsub => {
      unlistenPeers = unsub;
    });

    let unlistenStatus: (() => void) | undefined;
    listen('kivo:lan_status_updated', () => {
      loadData();
    }).then(unsub => {
      unlistenStatus = unsub;
    });

    const timer = setInterval(() => {
      getLanPeers().then(setPeers).catch(() => {});
    }, 4000);

    return () => {
      clearInterval(timer);
      if (unlistenPeers) unlistenPeers();
      if (unlistenStatus) unlistenStatus();
    };
  }, []);

  const handleRoleChange = async (newRole: 'parent' | 'child') => {
    if (!status) return;
    try {
      await setLanRole(newRole);
      setStatus({ ...status, role: newRole });
      loadData();
    } catch (err) {
      console.error('Failed to set LAN role:', err);
    }
  };

  const handleSaveDeviceName = async () => {
    if (!deviceName.trim() || !status) return;
    setIsSavingName(true);
    try {
      await setLanDeviceName(deviceName.trim());
      setStatus({ ...status, device_name: deviceName.trim() });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } catch (err) {
      console.error('Failed to set device name:', err);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleToggleAutoConnect = async () => {
    if (!status) return;
    const nextVal = !status.auto_connect;
    try {
      await setLanAutoConnect(nextVal);
      setStatus({ ...status, auto_connect: nextVal });
    } catch (err) {
      console.error('Failed to toggle auto connect:', err);
    }
  };

  const handleConnectPeer = async (peer: LanPeer) => {
    setConnectingPeer(peer.device_id);
    setConnectFeedback(null);
    try {
      const res = await connectLanParent(peer.ip_address, peer.http_port, peer.device_name);
      if (res.success) {
        await loadData();
        setConnectFeedback({
          type: 'success',
          message: `Terhubung ke Server Induk "${peer.device_name}".`
        });
      }
    } catch (err: any) {
      setConnectFeedback({
        type: 'danger',
        message: `Gagal menghubungkan ke "${peer.device_name}": ${typeof err === 'string' ? err : 'Pastikan perangkat berada di jaringan Wi-Fi/LAN yang sama.'}`
      });
    } finally {
      setConnectingPeer(null);
    }
  };

  const handleParentRequestConnectChild = async (peer: LanPeer) => {
    setParentConnectingChild(peer.device_id);
    setConnectFeedback(null);
    try {
      const msg = await parentRequestConnectChild(peer.ip_address, peer.http_port);
      setConnectFeedback({
        type: 'success',
        message: msg || 'Instruksi koneksi dikirim ke kasir klien.'
      });
      await loadData();
    } catch (err: any) {
      setConnectFeedback({
        type: 'danger',
        message: `Gagal menghubungkan kasir: ${typeof err === 'string' ? err : 'Error koneksi'}`
      });
    } finally {
      setParentConnectingChild(null);
    }
  };

  const handleDisconnectConfirm = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectLanParent();
      setSyncResult(null);
      setSyncError(null);
      setShowDisconnectConfirm(false);
      setConnectFeedback({
        type: 'success',
        message: 'Koneksi ke Perangkat Induk diputuskan.'
      });
      await loadData();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTestManualIp = async () => {
    if (!manualIp.trim()) return;
    setIsTestingManual(true);
    setManualTestResult(null);
    try {
      const port = parseInt(manualPort) || 3699;
      const res = await testLanConnection(manualIp.trim(), port);
      setManualTestResult(res);
    } catch (err: any) {
      setManualTestResult({
        success: false,
        latency_ms: 0,
        ip_address: manualIp.trim(),
        http_port: parseInt(manualPort) || 3699,
        device_id: '',
        device_name: '',
        role: '',
        workspace_id: '',
        items_count: 0,
        version: '',
        server_time: '',
        error: typeof err === 'string' ? err : 'Gagal menghubungi alamat IP'
      });
    } finally {
      setIsTestingManual(false);
    }
  };

  const handleConnectManual = async () => {
    if (!manualIp.trim()) return;
    setIsConnectingManual(true);
    setConnectFeedback(null);
    try {
      const port = parseInt(manualPort) || 3699;
      const res = await connectLanParent(manualIp.trim(), port);
      if (res.success) {
        await loadData();
        setConnectFeedback({
          type: 'success',
          message: `Terhubung ke Server Induk (${res.device_name || manualIp.trim()}).`
        });
      }
    } catch (err: any) {
      setConnectFeedback({
        type: 'danger',
        message: `Gagal menghubungkan: ${typeof err === 'string' ? err : 'Koneksi gagal'}`
      });
    } finally {
      setIsConnectingManual(false);
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncingNow(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const res = await triggerLanSyncNow();
      setSyncResult(res);
      await loadData();
    } catch (err: any) {
      setSyncError(typeof err === 'string' ? err : 'Gagal sinkronisasi data.');
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleOpenDiagnostics = async (ip?: string, port?: number, name?: string) => {
    const targetIp = ip || status?.paired_parent_ip || status?.local_ip || '127.0.0.1';
    const targetPort = port || status?.paired_parent_port || status?.http_port || 3699;
    const targetName = name || status?.paired_parent_name || 'Server Induk';

    setDiagnosticTarget({ ip: targetIp, port: targetPort, name: targetName });
    setShowDiagnostics(true);
    setIsTestingDiagnostics(true);
    setDiagnosticResult(null);

    try {
      const res = await testLanConnection(targetIp, targetPort);
      setDiagnosticResult(res);
    } catch (err: any) {
      setDiagnosticResult({
        success: false,
        latency_ms: 0,
        ip_address: targetIp,
        http_port: targetPort,
        device_id: '',
        device_name: '',
        role: '',
        workspace_id: '',
        items_count: 0,
        version: '',
        server_time: '',
        error: typeof err === 'string' ? err : 'Koneksi gagal'
      });
    } finally {
      setIsTestingDiagnostics(false);
    }
  };

  const copyDiagnosticLogs = () => {
    if (!diagnosticResult) return;
    const logs = JSON.stringify({
      tested_at: new Date().toISOString(),
      target: diagnosticTarget,
      result: diagnosticResult,
      client_status: status
    }, null, 2);
    navigator.clipboard.writeText(logs);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-2.5 text-dim">
        <Loader2 className="animate-spin text-primary" size={24} />
        <p className="text-xs font-medium">Memuat jaringan lokal (LAN)...</p>
      </div>
    );
  }

  if (loadError && !status) {
    return (
      <div className="py-16 px-4 text-center flex flex-col items-center justify-center gap-2.5 bg-card rounded-xl border border-line">
        <AlertTriangle size={22} className="text-danger" />
        <p className="text-sm font-semibold text-heading">Gagal memuat status LAN</p>
        <p className="text-xs text-dim max-w-sm">{loadError}</p>
        <Button type="button" variant="outline" size="sm" onClick={loadData} className="mt-1">
          <RefreshCw size={13} /> Coba Lagi
        </Button>
      </div>
    );
  }

  const isChild = status?.role === 'child';
  const isParent = status?.role === 'parent';
  const isConnected = isChild && !!status?.paired_parent_ip;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Feedback Banner */}
      {connectFeedback && (
        <div className={`px-4 py-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
          connectFeedback.type === 'success'
            ? 'bg-success-soft text-success border-success/30'
            : 'bg-danger-soft text-danger border-danger/30'
        }`}>
          <div className="flex items-center gap-2.5">
            {connectFeedback.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
            <span>{connectFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setConnectFeedback(null)}
            aria-label="Tutup notifikasi"
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Network Overview & Active Status Card */}
      <div className="bg-card rounded-xl border border-line p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isParent
                ? 'bg-primary-soft text-primary'
                : isConnected
                ? 'bg-success-soft text-success'
                : 'bg-warning-soft text-warning'
            }`}>
              {isParent ? <Server size={18} /> : isConnected ? <Activity size={18} /> : <Unplug size={18} />}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-heading">
                  {isParent
                    ? 'Server Induk Aktif'
                    : isConnected
                    ? `Terhubung ke ${status?.paired_parent_name || 'Server Induk'}`
                    : 'Kasir Mandiri (Belum Terhubung)'}
                </h2>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1.5 ${
                  isParent || isConnected
                    ? 'bg-success-soft text-success'
                    : 'bg-warning-soft text-warning'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isParent || isConnected ? 'bg-success' : 'bg-warning'}`} />
                  {isParent ? 'Induk' : isConnected ? 'Tersambung' : 'Offline'}
                </span>
                {isConnected && (
                  <span className="px-2 py-0.5 rounded-md bg-muted text-body text-[11px] font-mono font-semibold">
                    {status?.paired_parent_ip}:{status?.paired_parent_port}
                  </span>
                )}
              </div>
              <p className="text-xs text-dim mt-0.5">
                {isParent
                  ? 'Pusat database LAN untuk semua kasir klien.'
                  : isConnected
                  ? status?.last_sync_time
                    ? `Sinkronisasi terakhir: ${new Date(status.last_sync_time).toLocaleTimeString('id-ID')}`
                    : 'Transaksi disinkronkan ke Server Induk.'
                  : 'Hubungkan ke Server Induk di bawah untuk sinkronisasi lokal.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="h-8 px-2.5 rounded-lg bg-muted border border-line text-xs font-mono font-semibold text-heading inline-flex items-center gap-1.5">
              <span className="text-[11px] font-sans font-medium text-dim">IP:</span>
              {status?.local_ip}:{status?.http_port}
            </div>

            {isParent ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenDiagnostics(status?.local_ip, status?.http_port, 'Server Induk Ini')}
              >
                <Terminal size={13} /> Diagnostik
              </Button>
            ) : isConnected ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleTriggerSync}
                  disabled={isSyncingNow}
                >
                  <RefreshCw size={13} className={isSyncingNow ? 'animate-spin' : ''} />
                  {isSyncingNow ? 'Menyinkronkan...' : 'Sinkronkan'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenDiagnostics(status.paired_parent_ip, status.paired_parent_port, status.paired_parent_name)}
                >
                  <Terminal size={13} /> Diagnostik
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="text-danger border-danger/30 hover:bg-danger-soft hover:border-danger/40"
                >
                  <Unplug size={13} /> Putuskan
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {/* Sync Feedback */}
        {syncResult && (
          <div className="p-3 rounded-lg bg-success-soft border border-success/30 text-xs text-success flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 size={14} className="shrink-0" /> {syncResult.message}
            </span>
            <span className="text-[11px] font-mono tnum shrink-0">{syncResult.latency_ms} ms</span>
          </div>
        )}

        {syncError && (
          <div className="p-3 rounded-lg bg-danger-soft border border-danger/30 text-xs text-danger flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={14} className="shrink-0" /> {syncError}
          </div>
        )}

        {/* Auto-Connect Switch */}
        <div className="pt-3.5 border-t border-line flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-heading">Sinkronisasi Otomatis LAN</p>
            <p className="text-xs text-dim">
              Hubungkan dan sinkronkan antrean data otomatis di latar belakang.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!status?.auto_connect}
            aria-label="Sinkronisasi Otomatis LAN"
            onClick={handleToggleAutoConnect}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-card ${
              status?.auto_connect ? 'bg-primary' : 'bg-line-strong'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-card transition-transform ${
                status?.auto_connect ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Grid: Device Info & Role Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Device Info & Name */}
        <div className="bg-card rounded-xl border border-line p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                <Laptop size={15} strokeWidth={1.75} />
              </div>
              <h3 className="text-sm font-bold text-heading">Identitas Perangkat</h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-heading mb-1.5">Nama Perangkat</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="Kasir 1 Depan"
                  className="flex-1 min-w-0 h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading placeholder:text-dim outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleSaveDeviceName}
                  disabled={isSavingName || !deviceName.trim()}
                >
                  {isSavingName ? <Loader2 size={14} className="animate-spin" /> : nameSaved ? <Check size={14} /> : 'Simpan'}
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-line space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-dim">Device ID</span>
              <span className="font-mono font-semibold text-heading truncate">{status?.device_id}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-dim">Server Lokal</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-success bg-success-soft px-2 py-0.5 rounded-md font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-success" /> :{status?.http_port || 3699}
              </span>
            </div>
          </div>
        </div>

        {/* Role Selector: Parent vs Child */}
        <div className="md:col-span-2 bg-card rounded-xl border border-line p-5 space-y-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
              <Server size={15} strokeWidth={1.75} />
            </div>
            <h3 className="text-sm font-bold text-heading">Peran Perangkat</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* PARENT OPTION */}
            <button
              type="button"
              onClick={() => handleRoleChange('parent')}
              className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                status?.role === 'parent'
                  ? 'border-primary bg-primary-soft/60'
                  : 'border-line bg-card hover:border-line-strong hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    status?.role === 'parent' ? 'bg-primary text-white' : 'bg-muted text-heading border border-line'
                  }`}>
                    <Server size={14} />
                  </div>
                  <span className="font-bold text-xs text-heading">Server Induk (Parent)</span>
                </div>
                {status?.role === 'parent' && <CheckCircle2 size={15} className="text-primary shrink-0" />}
              </div>
              <p className="text-xs text-dim leading-snug">
                Pusat database utama yang melayani sinkronisasi kasir klien.
              </p>
            </button>

            {/* CHILD OPTION */}
            <button
              type="button"
              onClick={() => handleRoleChange('child')}
              className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                status?.role === 'child'
                  ? 'border-primary bg-primary-soft/60'
                  : 'border-line bg-card hover:border-line-strong hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    status?.role === 'child' ? 'bg-primary text-white' : 'bg-muted text-heading border border-line'
                  }`}>
                    <Laptop size={14} />
                  </div>
                  <span className="font-bold text-xs text-heading">Kasir Klien (Child)</span>
                </div>
                {status?.role === 'child' && <CheckCircle2 size={15} className="text-primary shrink-0" />}
              </div>
              <p className="text-xs text-dim leading-snug">
                Terminal kasir yang mengirim transaksi dan mengambil katalog dari Induk.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Discovered LAN Peers List */}
      <div className="bg-card rounded-xl border border-line overflow-hidden flex flex-col">
        <div className="p-4 sm:px-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-card border border-line text-heading flex items-center justify-center shrink-0">
              <Radio size={15} strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-heading">Perangkat di Jaringan</h3>
                <span className="px-2 py-0.5 rounded-md bg-muted text-dim text-[11px] font-semibold tnum">
                  {peers.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isScanningSubnet}
            >
              <RefreshCw size={13} /> Segarkan
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleScanSubnet}
              disabled={isScanningSubnet}
            >
              {isScanningSubnet ? <Loader2 size={13} className="animate-spin" /> : <Radio size={13} />}
              <span>{isScanningSubnet ? 'Memindai...' : 'Pindai Subnet'}</span>
            </Button>
          </div>
        </div>

        <div className="divide-y divide-line">
          {peers.length === 0 ? (
            <div className="py-10 text-center px-4">
              <Wifi size={24} className="mx-auto mb-2 text-dim" />
              <p className="text-sm font-semibold text-heading">Belum ada perangkat terdeteksi</p>
              <p className="text-xs text-dim mt-1 max-w-md mx-auto">
                Pastikan Kivo terbuka di perangkat lain dalam jaringan yang sama, lalu klik Pindai Subnet.
              </p>
            </div>
          ) : (
            peers.map((peer) => {
              const isParentPeer = peer.role === 'parent';
              const isPairedWithThis = isChild && status?.paired_parent_ip === peer.ip_address;

              return (
                <div
                  key={peer.device_id}
                  className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                      isParentPeer
                        ? 'bg-primary-soft text-primary border-primary/25'
                        : 'bg-muted text-heading border-line'
                    }`}>
                      {isParentPeer ? <Server size={16} /> : <Laptop size={16} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-heading truncate">{peer.device_name}</span>
                        {peer.is_self && (
                          <span className="px-1.5 py-0.5 rounded-md bg-muted text-dim text-[10px] font-semibold">
                            Perangkat Ini
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                          isParentPeer
                            ? 'bg-primary-soft text-primary'
                            : 'bg-info-soft text-info'
                        }`}>
                          {isParentPeer ? 'Induk' : 'Klien'}
                        </span>
                        {isPairedWithThis && (
                          <span className="px-1.5 py-0.5 rounded-md bg-success-soft text-success text-[10px] font-semibold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" /> Terhubung
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-dim font-mono">
                        <span>{peer.ip_address}:{peer.http_port}</span>
                        <span className="font-sans text-success inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-success" /> Online
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this peer */}
                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDiagnostics(peer.ip_address, peer.http_port, peer.device_name)}
                    >
                      <Terminal size={12} /> Ping
                    </Button>

                    {isChild && !peer.is_self && (
                      isPairedWithThis ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDisconnectConfirm(true)}
                          className="text-danger border-danger/30 hover:bg-danger-soft"
                        >
                          <Unplug size={12} /> Putuskan
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => handleConnectPeer(peer)}
                          disabled={connectingPeer === peer.device_id}
                        >
                          {connectingPeer === peer.device_id ? (
                            <><Loader2 size={13} className="animate-spin" /> Menghubungkan...</>
                          ) : (
                            <><Plug size={13} /> Hubungkan</>
                          )}
                        </Button>
                      )
                    )}

                    {isParent && !peer.is_self && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleParentRequestConnectChild(peer)}
                        disabled={parentConnectingChild === peer.device_id}
                      >
                        <Plug size={13} />
                        {parentConnectingChild === peer.device_id ? 'Mengirim...' : 'Hubungkan Klien'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MANUAL IP CONNECTION FORM */}
      {isChild && (
        <div className="bg-card rounded-xl border border-line p-5 space-y-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
              <Network size={15} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-heading">Koneksi Manual via IP</h3>
              <p className="text-xs text-dim">Gunakan jika pencarian otomatis diblokir router Wi-Fi.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6">
              <label className="block text-xs font-semibold text-heading mb-1.5">Alamat IP Induk</label>
              <input
                type="text"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                placeholder="192.168.1.100"
                className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm font-mono text-heading placeholder:text-dim outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-heading mb-1.5">Port</label>
              <input
                type="text"
                value={manualPort}
                onChange={(e) => setManualPort(e.target.value)}
                placeholder="3699"
                className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm font-mono text-heading placeholder:text-dim outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors"
              />
            </div>

            <div className="sm:col-span-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleTestManualIp}
                disabled={isTestingManual || !manualIp.trim()}
                className="flex-1"
              >
                {isTestingManual ? <Loader2 size={13} className="animate-spin" /> : <Terminal size={13} />}
                Ping
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleConnectManual}
                disabled={isConnectingManual || !manualIp.trim()}
                className="flex-1"
              >
                {isConnectingManual ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />}
                Hubungkan
              </Button>
            </div>
          </div>

          {manualTestResult && (
            <div className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
              manualTestResult.success
                ? 'bg-success-soft border-success/30 text-success'
                : 'bg-danger-soft border-danger/30 text-danger'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                {manualTestResult.success ? <CheckCircle2 size={15} className="shrink-0" /> : <AlertTriangle size={15} className="shrink-0" />}
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {manualTestResult.success
                      ? `Terhubung ke ${manualTestResult.device_name} (${manualTestResult.role})`
                      : 'Gagal terhubung ke alamat IP'}
                  </p>
                  {manualTestResult.error && (
                    <p className="text-[11px] mt-0.5">{manualTestResult.error}</p>
                  )}
                </div>
              </div>
              {manualTestResult.success && (
                <span className="font-mono text-xs font-semibold tnum shrink-0">
                  {manualTestResult.latency_ms} ms
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* DIAGNOSTICS & DEBUG CONSOLE MODAL */}
      {showDiagnostics && (
        <Modal
          isOpen={true}
          onClose={() => setShowDiagnostics(false)}
          size="lg"
          title="Diagnostik Koneksi LAN"
          subtitle={`${diagnosticTarget?.ip}:${diagnosticTarget?.port}`}
          icon={Terminal}
          footer={
            <div className="flex flex-wrap justify-between items-center gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyDiagnosticLogs}
                disabled={!diagnosticResult}
              >
                {copiedLogs ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                {copiedLogs ? 'Tersalin' : 'Salin Log'}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleOpenDiagnostics(diagnosticTarget?.ip, diagnosticTarget?.port, diagnosticTarget?.name)}
                  disabled={isTestingDiagnostics}
                >
                  <RefreshCw size={13} className={isTestingDiagnostics ? 'animate-spin' : ''} />
                  Uji Ulang
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setShowDiagnostics(false)}
                >
                  Tutup
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {isTestingDiagnostics ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-dim">
                <Loader2 className="animate-spin text-primary" size={24} />
                <p className="text-xs font-medium">Menguji koneksi TCP/HTTP...</p>
              </div>
            ) : diagnosticResult ? (
              <div className="space-y-3.5">
                {/* Status Banner */}
                <div className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 ${
                  diagnosticResult.success
                    ? 'bg-success-soft border-success/30 text-success'
                    : 'bg-danger-soft border-danger/30 text-danger'
                }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    {diagnosticResult.success ? (
                      <CheckCircle2 size={20} className="shrink-0" />
                    ) : (
                      <AlertTriangle size={20} className="shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm">
                        {diagnosticResult.success ? 'Koneksi Responsif (200 OK)' : 'Koneksi Gagal'}
                      </h4>
                      <p className="text-xs mt-0.5 truncate">
                        {diagnosticResult.success
                          ? `Node ${diagnosticResult.device_name}`
                          : diagnosticResult.error || 'Perangkat tidak merespons pada port target.'}
                      </p>
                    </div>
                  </div>

                  {diagnosticResult.success && (
                    <span className="px-2.5 py-1 rounded-md bg-success text-white text-xs font-mono font-bold tnum shrink-0">
                      {diagnosticResult.latency_ms} ms
                    </span>
                  )}
                </div>

                {/* Diagnostic Checklist */}
                <div className="bg-muted/40 rounded-lg border border-line p-3.5 divide-y divide-line text-xs">
                  <div className="flex items-center justify-between py-2 first:pt-0">
                    <span className="text-dim">HTTP Handshake</span>
                    <span className={`font-semibold font-mono tnum ${diagnosticResult.success ? 'text-success' : 'text-danger'}`}>
                      {diagnosticResult.success ? `PASS (${diagnosticResult.latency_ms} ms)` : 'FAIL'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-dim">Perangkat</span>
                    <span className="font-semibold text-heading">
                      {diagnosticResult.success ? `${diagnosticResult.device_name} (${diagnosticResult.role})` : '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-dim">Total Produk Server</span>
                    <span className="font-semibold text-heading tnum">
                      {diagnosticResult.success ? `${diagnosticResult.items_count.toLocaleString('id-ID')} item` : '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 last:pb-0">
                    <span className="text-dim">Workspace ID</span>
                    <span className="font-mono text-body">
                      {diagnosticResult.workspace_id || 'Lokal'}
                    </span>
                  </div>
                </div>

                {/* Raw Debug JSON */}
                <div>
                  <label className="text-xs font-semibold text-heading block mb-1.5">Payload Debug</label>
                  <pre className="p-3 rounded-lg bg-muted/50 text-body font-mono text-[11px] overflow-x-auto max-h-36 border border-line leading-relaxed">
                    {JSON.stringify(diagnosticResult, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        </Modal>
      )}

      {/* Disconnect Confirm Modal */}
      {showDisconnectConfirm && (
        <ConfirmModal
          title="Putuskan Koneksi LAN?"
          message="Perangkat kasir ini akan kembali beroperasi mandiri hingga dihubungkan ulang ke Server Induk."
          variant="danger"
          confirmLabel="Putuskan"
          loading={isDisconnecting}
          onConfirm={handleDisconnectConfirm}
          onCancel={() => setShowDisconnectConfirm(false)}
        />
      )}
    </div>
  );
}
