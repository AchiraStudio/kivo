import { useState, useEffect } from 'react';
import {
  Database, CheckCircle2, Loader2, Save, AlertTriangle, Globe, RefreshCw, LogOut,
  Building2, MapPin, Lock, Printer, Sliders, UserCheck, Download, Trash2, UploadCloud,
  DownloadCloud, ChevronDown, ChevronUp, Network, Link2, Flame, Activity, Plus,
  Eye, EyeOff, ExternalLink, Copy, CheckCheck, Server, Cloud, ShieldCheck,
  ArrowUpCircle, Plug, Layers, Cpu
} from 'lucide-react';
import {
  optimizeDatabase, exportDatabase, getSettings, setSetting, getSyncStatus, SyncStatus,
  leaveWorkspace, joinWorkspace, createWorkspace, getAvailableWorkspaces,
  sysadminGetWorkspaces, sysadminCreateWorkspace, sysadminDeleteWorkspace,
  WorkspaceListInfo, UserRowFull, getUsers, assignUserWorkspace, triggerSyncPush,
  triggerSyncPull, resetDbSpecific, nukeCloudWorkspaceData, getCloudConfig,
  setCloudConfig, testCloudConnection, getBootstrapSql, getTruncateSql,
  openBrowserUrl, invoke
} from '../../lib/api';
import { save } from '@tauri-apps/plugin-dialog';
import { useAuthStore } from '../../store/AuthStore';
import { useUpdaterStore } from '../../store/UpdaterStore';
import { supabase, updateSupabaseCredentials, getSavedSupabaseCredentials } from '../../lib/supabase';
import UserManagement from './UserManagement';
import HardwareSettings from './HardwareSettings';
import LanSyncSettings from './LanSyncSettings';
import McpSettings from './McpSettings';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TabBar, { TabItem } from '../../components/ui/TabBar';
import Select from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import { isMobilePlatform } from '../../lib/runtime';
import { usePermissions } from '../../lib/permissions';

const APP_VERSION = __APP_VERSION__;
const RELEASES_URL = 'https://github.com/AchiraStudio/kivo/releases/latest';

// Keys that render as a unified <Select> instead of a text input
const SELECT_OPTIONS: Record<string, { label: string; value: string }[]> = {
  hpp_method: [
    { label: 'Average (AVG)', value: 'avg' },
    { label: 'First In First Out (FIFO)', value: 'fifo' },
    { label: 'Last In First Out (LIFO)', value: 'lifo' },
  ],
  hpp_method_default: [
    { label: 'Average (AVG)', value: 'avg' },
    { label: 'First In First Out (FIFO)', value: 'fifo' },
    { label: 'Last In First Out (LIFO)', value: 'lifo' },
  ],
  tax_mode: [
    { label: 'Tanpa Pajak (0%)', value: 'none' },
    { label: 'Include (Termasuk Pajak)', value: 'include' },
    { label: 'Exclude (Ditambah di Akhir)', value: 'exclude' },
  ],
  tax_rate: [
    { label: '0% (Tanpa Pajak)', value: '0' },
    { label: '11% (PPN)', value: '11' },
    { label: '12% (PPN 2025)', value: '12' },
    { label: '10%', value: '10' },
    { label: '5%', value: '5' },
  ],
  transaction_reset: [
    { label: 'Harian', value: 'daily' },
    { label: 'Bulanan', value: 'monthly' },
    { label: 'Tidak Pernah', value: 'never' },
  ],
  sync_mode: [
    { label: 'Lokal (Offline)', value: 'local' },
    { label: 'Cloud Sync (Online)', value: 'cloud' },
  ],
  auto_sync: [
    { label: 'Aktif (Otomatis)', value: 'true' },
    { label: 'Nonaktif (Manual)', value: 'false' },
  ],
  language: [
    { label: 'Bahasa Indonesia (ID)', value: 'id' },
    { label: 'English (EN)', value: 'en' },
  ],
  print_receipt_auto: [
    { label: 'Ya (Otomatis)', value: 'true' },
    { label: 'Tidak (Manual)', value: 'false' },
  ],
  cash_drawer_auto_open: [
    { label: 'Ya (Otomatis)', value: 'true' },
    { label: 'Tidak (Manual)', value: 'false' },
  ],
  auto_backup: [
    { label: 'Harian', value: 'daily' },
    { label: 'Mingguan', value: 'weekly' },
    { label: 'Nonaktif', value: 'disabled' },
  ],
  tier_member_duration_months: [
    { label: '3 Bulan', value: '3' },
    { label: '6 Bulan', value: '6' },
    { label: '12 Bulan', value: '12' },
    { label: '24 Bulan', value: '24' },
    { label: 'Selamanya', value: '0' },
  ],
  tier_vip_duration_months: [
    { label: '6 Bulan', value: '6' },
    { label: '12 Bulan', value: '12' },
    { label: '24 Bulan', value: '24' },
    { label: '36 Bulan', value: '36' },
    { label: 'Selamanya', value: '0' },
  ],
  tier_member_discount: [
    { label: '0%', value: '0' },
    { label: '2%', value: '2' },
    { label: '5%', value: '5' },
    { label: '10%', value: '10' },
    { label: '15%', value: '15' },
  ],
  tier_vip_discount: [
    { label: '5%', value: '5' },
    { label: '10%', value: '10' },
    { label: '15%', value: '15' },
    { label: '20%', value: '20' },
    { label: '25%', value: '25' },
  ],
  openai_model: [
    { label: 'GPT-4o Mini (Cepat & Hemat)', value: 'gpt-4o-mini' },
    { label: 'GPT-4o (Akurat)', value: 'gpt-4o' },
    { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
  ],
};

// Keys managed separately in the Profil section, hide from General list
const PROFILE_KEYS = ['company_name', 'branch_name'];
const MEMBER_KEYS = ['tier_member_discount', 'tier_vip_discount', 'tier_member_duration_months', 'tier_vip_duration_months'];

// Internal/diagnostic keys owned by other screens (LAN tab, Cloud tab, SetupWizard), never editable here
const INTERNAL_KEYS = new Set([
  'has_completed_setup', 'workspace_id', 'workspace_name', 'workspace_code', 'last_pull_at', 'auto_sync',
  'lan_role', 'lan_udp_port', 'lan_http_port', 'lan_device_name', 'lan_auto_connect',
  'lan_last_pull_at', 'lan_last_sync_error', 'lan_last_sync_status', 'lan_last_sync_time',
]);

// Curated, ordered system fields with clean labels
const SYSTEM_SETTING_FIELDS: { key: string; label: string }[] = [
  { key: 'company_address', label: 'Alamat Toko' },
  { key: 'company_phone', label: 'Nomor Telepon' },
  { key: 'receipt_header', label: 'Header Struk' },
  { key: 'receipt_footer', label: 'Footer Struk' },
  { key: 'tax_rate', label: 'Tarif Pajak (PPN)' },
  { key: 'hpp_method_default', label: 'Metode HPP Default' },
  { key: 'fiscal_year_start', label: 'Awal Tahun Fiskal' },
  { key: 'language', label: 'Bahasa Aplikasi' },
  { key: 'openai_api_key', label: 'OpenAI API Key' },
  { key: 'openai_model', label: 'Model OpenAI' },
];

const FIELD_LABELS: Record<string, string> = {
  ...Object.fromEntries(SYSTEM_SETTING_FIELDS.map(f => [f.key, f.label])),
  tier_member_discount: 'Diskon Member',
  tier_vip_discount: 'Diskon VIP',
  tier_member_duration_months: 'Durasi Member',
  tier_vip_duration_months: 'Durasi VIP',
};

export default function Settings() {
  const { user } = useAuthStore();
  const { can, isOwner, isAdmin } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [configs, setConfigs] = useState<{ key: string; value: string; description?: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'system' | 'users' | 'sync' | 'lan' | 'hardware' | 'mcp'>(() => {
    if (can('settings.general')) return 'system';
    if (can('settings.lan')) return 'lan';
    if (can('settings.hardware')) return 'hardware';
    if (can('settings.database')) return 'sync';
    if (can('settings.users') || isAdmin) return 'users';
    return 'lan';
  });

  // Profile settings
  const [companyName, setCompanyName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');

  // Confirm modals
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'primary' | 'logout';
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  // DB Reset state
  const [resetTarget, setResetTarget] = useState<'sales' | 'inventory' | 'all' | 'maintenance' | null>(null);
  const [confirmText, setConfirmText] = useState('');

  // Nuke Supabase state
  const [nukeStep, setNukeStep] = useState<0 | 1 | 2>(0);
  const [nukeConfirmText, setNukeConfirmText] = useState('');
  const [nukeAllData, setNukeAllData] = useState(true);

  // App Updater State
  const { updateInfo, isChecking: isCheckingUpdate, lastChecked: updateLastChecked, checkUpdates, openModal } = useUpdaterStore();

  const handleManualUpdateCheck = async () => {
    const res = await checkUpdates(true);
    if (res && !res.has_update) {
      toast.success(`Kivo sudah menggunakan versi terbaru (v${APP_VERSION}).`);
    } else if (res && res.has_update) {
      openModal();
    } else {
      toast.error('Tidak dapat memeriksa pembaruan. Pastikan perangkat terhubung ke internet.');
    }
  };

  // Sync / workspace state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  // Manual Workspace Join state
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showSwitchWorkspace, setShowSwitchWorkspace] = useState(false);
  const [syncSubTab, setSyncSubTab] = useState<'connection' | 'manage'>('connection');

  // Supabase Cloud interactive states
  const [connectMode, setConnectMode] = useState<'join' | 'create'>('join');
  const [createWsName, setCreateWsName] = useState('');
  const [createWsCode, setCreateWsCode] = useState('');
  const [isCreatingWs, setIsCreatingWs] = useState(false);
  const [supabasePing, setSupabasePing] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; latency?: number; error?: string }>({ status: 'idle' });
  const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceListInfo[]>([]);

  // Supabase BYOK Cloud Credentials state
  const [cloudUrl, setCloudUrl] = useState(() => getSavedSupabaseCredentials().url);
  const [cloudAnonKey, setCloudAnonKey] = useState(() => getSavedSupabaseCredentials().anonKey);
  const [showCloudKey, setShowCloudKey] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [isTestingCloud, setIsTestingCloud] = useState(false);
  const [cloudTestStatus, setCloudTestStatus] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; latency?: number; error?: string }>({ status: 'idle' });
  const [cloudConfigOpen, setCloudConfigOpen] = useState(false);
  const [copiedSqlSchema, setCopiedSqlSchema] = useState(false);
  const [copiedTruncateSql, setCopiedTruncateSql] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlModalTab, setSqlModalTab] = useState<'bootstrap' | 'truncate'>('bootstrap');
  const [sqlContent, setSqlContent] = useState('');

  const loadCloudConfig = async () => {
    try {
      const cfg = await getCloudConfig();
      if (cfg.supabase_url) setCloudUrl(cfg.supabase_url);
      if (cfg.supabase_anon_key) setCloudAnonKey(cfg.supabase_anon_key);
    } catch (e) {
      console.warn('Could not load cloud config:', e);
    }
  };

  const handleSaveCloudConfig = async () => {
    if (!cloudUrl || !cloudAnonKey) {
      toast.error('URL dan Anon Key Supabase harus diisi.');
      return;
    }
    setIsSavingCloud(true);
    try {
      await setCloudConfig(cloudUrl.trim(), cloudAnonKey.trim());
      updateSupabaseCredentials(cloudUrl.trim(), cloudAnonKey.trim());
      toast.success('Kredensial Supabase disimpan dan diaktifkan.');
      setCloudConfigOpen(false);
      await loadSyncStatus();
    } catch (e: any) {
      toast.error('Gagal menyimpan kredensial Supabase: ' + (e.message || String(e)));
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleTestCloud = async () => {
    if (!cloudUrl || !cloudAnonKey) {
      toast.error('Isi URL dan Anon Key terlebih dahulu.');
      return;
    }
    setIsTestingCloud(true);
    setCloudTestStatus({ status: 'testing' });
    try {
      const result = await testCloudConnection(cloudUrl.trim(), cloudAnonKey.trim());
      if (result.success) {
        setCloudTestStatus({ status: 'success', latency: result.latency_ms });
        toast.success(`Koneksi Supabase berhasil (${result.latency_ms}ms).`);
      } else {
        setCloudTestStatus({ status: 'error', error: result.error || 'Gagal tersambung' });
        toast.error(`Koneksi gagal: ${result.error}`);
      }
    } catch (e: any) {
      const msg = e.message || String(e);
      setCloudTestStatus({ status: 'error', error: msg });
      toast.error(`Koneksi gagal: ${msg}`);
    } finally {
      setIsTestingCloud(false);
    }
  };

  const handleCopyBootstrapSql = async () => {
    try {
      const sql = await getBootstrapSql();
      await navigator.clipboard.writeText(sql);
      setCopiedSqlSchema(true);
      toast.success('Skema SQL (34 tabel) disalin ke clipboard.');
      setTimeout(() => setCopiedSqlSchema(false), 3000);
    } catch (e: any) {
      toast.error('Gagal mengambil skema SQL: ' + (e.message || String(e)));
    }
  };

  const handleCopyTruncateSql = async () => {
    try {
      const sql = await getTruncateSql();
      await navigator.clipboard.writeText(sql);
      setCopiedTruncateSql(true);
      toast.success('Skrip SQL TRUNCATE disalin ke clipboard.');
      setTimeout(() => setCopiedTruncateSql(false), 3000);
    } catch (e: any) {
      toast.error('Gagal mengambil skrip TRUNCATE: ' + (e.message || String(e)));
    }
  };

  const handleViewSqlModal = async (tab: 'bootstrap' | 'truncate' = 'bootstrap') => {
    try {
      setSqlModalTab(tab);
      const sql = tab === 'bootstrap' ? await getBootstrapSql() : await getTruncateSql();
      setSqlContent(sql);
      setShowSqlModal(true);
    } catch (e: any) {
      toast.error('Gagal memuat skrip SQL: ' + (e.message || String(e)));
    }
  };

  const handleSwitchSqlModalTab = async (tab: 'bootstrap' | 'truncate') => {
    setSqlModalTab(tab);
    try {
      const sql = tab === 'bootstrap' ? await getBootstrapSql() : await getTruncateSql();
      setSqlContent(sql);
    } catch (e: any) {
      toast.error('Gagal memuat skrip SQL: ' + (e.message || String(e)));
    }
  };

  useEffect(() => {
    if (activeTab === 'system' && !can('settings.general')) {
      if (can('settings.lan')) setActiveTab('lan');
      else if (can('settings.hardware')) setActiveTab('hardware');
      else if (can('settings.database')) setActiveTab('sync');
      else if (can('settings.users') || isAdmin) setActiveTab('users');
    }
  }, [can, isAdmin, activeTab]);

  const handleJoinWorkspace = async () => {
    const trimmedCode = joinCode.trim();
    if (!trimmedCode) {
      setJoinError('Masukkan Kode Workspace atau Token.');
      return;
    }
    setIsJoining(true);
    setJoinError(null);
    try {
      const ws = await joinWorkspace(trimmedCode, joinPassword.trim() || undefined);
      setSuccessMsg(`Terhubung ke Workspace: ${ws.name} (${ws.code})`);
      setJoinCode('');
      setJoinPassword('');
      setShowSwitchWorkspace(false);
      await loadSyncStatus();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      setJoinError(err.message || String(err));
    } finally {
      setIsJoining(false);
    }
  };

  const handleTestSupabase = async () => {
    setSupabasePing({ status: 'testing' });
    const start = performance.now();
    try {
      const { error } = await supabase.from('workspaces').select('id', { count: 'exact', head: true });
      const latency = Math.round(performance.now() - start);
      if (error) throw error;
      setSupabasePing({ status: 'success', latency });
      setTimeout(() => setSupabasePing({ status: 'idle' }), 7000);
    } catch (e: any) {
      setSupabasePing({ status: 'error', error: e.message || String(e) });
    }
  };

  const handleFetchAvailableWorkspaces = async () => {
    try {
      const list = await getAvailableWorkspaces();
      setAvailableWorkspaces(list);
    } catch (e) {
      console.warn('Could not fetch available workspaces:', e);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = createWsName.trim() || companyName || 'Toko Kivo';
    const trimmedCode = (createWsCode.trim() || trimmedName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)).toUpperCase();
    if (!trimmedName) {
      setJoinError('Masukkan nama workspace.');
      return;
    }
    setIsCreatingWs(true);
    setJoinError(null);
    try {
      const ws = await createWorkspace(trimmedName, trimmedCode);
      setSuccessMsg(`Workspace dibuat dan terhubung: ${ws.name} (${ws.code})`);
      setCreateWsName('');
      setCreateWsCode('');
      await loadSyncStatus();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      setJoinError(err.message || String(err));
    } finally {
      setIsCreatingWs(false);
    }
  };

  const handleManualPush = async () => {
    setIsPushing(true);
    try {
      await triggerSyncPush();
      await loadSyncStatus();
    } catch (err: any) {
      setConfirmModal({
        title: 'Gagal Push',
        message: `Gagal mengunggah ke Cloud: ${err.message || err}`,
        variant: 'warning',
        confirmLabel: 'OK',
        onConfirm: () => setConfirmModal(null),
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handleManualPull = async (fullPull: boolean = false) => {
    setIsPulling(true);
    try {
      await triggerSyncPull(fullPull);
      await loadSyncStatus();
    } catch (err: any) {
      setConfirmModal({
        title: 'Gagal Pull',
        message: `Gagal mengunduh dari Cloud: ${err.message || err}`,
        variant: 'warning',
        confirmLabel: 'OK',
        onConfirm: () => setConfirmModal(null),
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handleToggleAutoSync = async (enabled: boolean) => {
    try {
      await setSetting('auto_sync', enabled ? 'true' : 'false');
      window.dispatchEvent(new CustomEvent('kivo:auto_sync_changed'));
      await loadSyncStatus();
      await loadSettings();
    } catch (e: any) {
      setConfirmModal({
        title: 'Gagal Mengubah Pengaturan',
        message: e.message || String(e),
        variant: 'warning',
        confirmLabel: 'OK',
        onConfirm: () => setConfirmModal(null),
      });
    }
  };

  useEffect(() => {
    loadSettings();
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const s = await getSyncStatus();
      setSyncStatus(s);
    } catch { /* offline */ }
    handleFetchAvailableWorkspaces();
    loadCloudConfig();
  };

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setConfigs(data);
      const co = data.find(s => s.key === 'company_name');
      const br = data.find(s => s.key === 'branch_name');
      if (co) setCompanyName(co.value);
      if (br) setBranchName(br.value);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileSuccess('');
    try {
      if (isOwner) await setSetting('company_name', companyName);
      if (isAdmin) await setSetting('branch_name', branchName);
      setProfileSuccess('Tersimpan');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (e) {
      setConfirmModal({
        title: 'Gagal Menyimpan',
        message: `Terjadi kesalahan: ${e}`,
        variant: 'warning',
        confirmLabel: 'OK',
        onConfirm: () => setConfirmModal(null),
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleExportDB = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const defaultPath = `kivo_backup_${today}.db`;
      const filePath = await save({
        defaultPath,
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
      });

      if (!filePath) return;

      setLoading(true);
      setSuccessMsg('');
      const msg = await exportDatabase(filePath);
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (e) {
      setConfirmModal({
        title: 'Ekspor Gagal',
        message: `Gagal mengekspor database: ${e}`,
        variant: 'danger',
        confirmLabel: 'OK',
        onConfirm: () => setConfirmModal(null),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetDB = async () => {
    if (!resetTarget) return;
    const role = (user?.role || 'staff').toLowerCase();
    if (resetTarget !== 'maintenance' && role !== 'owner' && role !== 'admin' && role !== 'sysadmin') {
      toast.error('Akses Ditolak', 'Hanya Admin atau Owner yang dapat mereset database.');
      return;
    }
    if (resetTarget !== 'maintenance' && confirmText !== 'DELETE') return;

    setLoading(true);
    setSuccessMsg('');
    try {
      if (resetTarget === 'maintenance') {
        const msg = await optimizeDatabase();
        setSuccessMsg(msg);
      } else {
        const msg = await resetDbSpecific(resetTarget);
        setSuccessMsg(msg);
      }
      setTimeout(() => setSuccessMsg(''), 6000);
      setResetTarget(null);
      setConfirmText('');
    } catch (e) {
      setConfirmModal({
        title: 'Reset Gagal',
        message: `Reset gagal: ${e}`,
        variant: 'danger',
        confirmLabel: 'OK',
        onConfirm: () => setConfirmModal(null),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNukeCloudData = async () => {
    if (nukeConfirmText !== 'NUKE CLOUD DATA') return;
    setLoading(true);
    try {
      const msg = await nukeCloudWorkspaceData(nukeAllData);
      setSuccessMsg(msg);
      toast.success(msg);
      setTimeout(() => setSuccessMsg(''), 8000);
      setNukeStep(0);
      setNukeConfirmText('');
      await loadSyncStatus();
    } catch (e: any) {
      setConfirmModal({
        title: 'Penghapusan Cloud Gagal',
        message: `Gagal menghapus data Cloud: ${e.message || String(e)}`,
        variant: 'danger',
        confirmLabel: 'OK',
        onConfirm: () => setConfirmModal(null),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (key: string, value: string) => {
    setSaving(true);
    try {
      await setSetting(key, value);
      await loadSettings();
    } catch (e) {
      setConfirmModal({
        title: 'Gagal Menyimpan',
        message: `Gagal menyimpan pengaturan: ${e}`,
        variant: 'warning',
        confirmLabel: 'OK',
        onConfirm: () => setConfirmModal(null),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveWorkspace = () => {
    setConfirmModal({
      title: 'Putuskan Workspace?',
      message: 'Data lokal tetap aman, tetapi sinkronisasi Cloud akan berhenti.',
      variant: 'danger',
      confirmLabel: 'Putuskan',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await leaveWorkspace();
          setSyncStatus(null);
          await loadSyncStatus();
          await handleFetchAvailableWorkspaces();
        } catch (e) { console.error(e); }
      },
    });
  };

  const byKey = new Map(configs.map(c => [c.key, c]));
  const knownKeys = new Set(SYSTEM_SETTING_FIELDS.map(f => f.key));
  const generalConfigs = SYSTEM_SETTING_FIELDS
    .map(f => byKey.get(f.key) || { key: f.key, value: '', description: f.label });
  const advancedConfigs = configs.filter(
    c => !INTERNAL_KEYS.has(c.key) && !PROFILE_KEYS.includes(c.key) && !MEMBER_KEYS.includes(c.key) && !knownKeys.has(c.key)
  );
  const memberConfigs = configs.filter(c => MEMBER_KEYS.includes(c.key));

  type TabType = 'system' | 'hardware' | 'sync' | 'lan' | 'mcp' | 'users';
  type SyncSubTabType = 'connection' | 'manage';

  const settingTabs: TabItem<TabType>[] = [
    ...(can('settings.general') ? [{ id: 'system' as TabType, label: 'Umum', icon: Sliders }] : []),
    ...(can('settings.hardware') ? [{ id: 'hardware' as TabType, label: 'Hardware POS', icon: Printer }] : []),
    ...(can('settings.database') ? [{ id: 'sync' as TabType, label: 'Cloud & Workspace', icon: Globe, badge: syncStatus?.pending_count ? syncStatus.pending_count : undefined }] : []),
    { id: 'lan' as TabType, label: 'Jaringan LAN', icon: Network },
    { id: 'mcp' as TabType, label: 'MCP & AI', icon: Cpu },
    ...((can('settings.users') || isAdmin) ? [{ id: 'users' as TabType, label: 'Pengguna', icon: UserCheck }] : []),
  ];

  const syncSubTabs: TabItem<SyncSubTabType>[] = [
    { id: 'connection', label: 'Koneksi & Sinkronisasi', icon: Cloud },
    { id: 'manage', label: 'Kelola Workspace', icon: Layers },
  ];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar pb-8 flex flex-col gap-4 animate-fade-in w-full">
      {/* Top Navigation Bar */}
      <div className="shrink-0">
        <TabBar
          tabs={settingTabs}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === 'sync') loadSyncStatus();
          }}
        />
      </div>

      {/* Main Content Areas */}
      {activeTab === 'hardware' ? (
        <HardwareSettings />
      ) : activeTab === 'users' ? (
        <UserManagement />
      ) : activeTab === 'lan' ? (
        <LanSyncSettings />
      ) : activeTab === 'mcp' ? (
        <McpSettings />
      ) : activeTab === 'sync' ? (
        <div className="flex flex-col gap-4 w-full">
          {/* Sub Tab Switcher */}
          {(user?.username === 'admin' || isAdmin) && (
            <TabBar
              tabs={syncSubTabs}
              activeTab={syncSubTab}
              onTabChange={setSyncSubTab}
            />
          )}

          {syncSubTab === 'manage' && (user?.username === 'admin' || isAdmin) ? (
            <SysadminWorkspaceManagement onWorkspaceChanged={() => { loadSyncStatus(); handleFetchAvailableWorkspaces(); }} />
          ) : (
            <div className="flex flex-col gap-4 w-full">
              {/* Cloud Status Card */}
              <div className="bg-card rounded-xl border border-line p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      syncStatus?.workspace_id ? 'bg-success-soft text-success' : 'bg-muted border border-line text-heading'
                    }`}>
                      <Globe size={18} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold text-heading">Cloud & Workspace</h2>
                        {syncStatus?.workspace_id ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-success-soft text-success inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" />
                            Terhubung
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-dim">
                            Belum Terhubung
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-dim mt-0.5 truncate">
                        {syncStatus?.workspace_id
                          ? `${syncStatus.workspace_name} (${syncStatus.workspace_code})`
                          : 'Sinkronisasi multi-cabang via Supabase Cloud'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTestSupabase}
                      disabled={supabasePing.status === 'testing'}
                    >
                      {supabasePing.status === 'testing' ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Activity size={13} />
                      )}
                      <span className="tnum">
                        {supabasePing.status === 'testing'
                          ? 'Menguji...'
                          : supabasePing.status === 'success'
                          ? `${supabasePing.latency} ms`
                          : supabasePing.status === 'error'
                          ? 'Gagal'
                          : 'Ping'}
                      </span>
                    </Button>
                    <button
                      type="button"
                      onClick={loadSyncStatus}
                      aria-label="Segarkan status sync"
                      title="Segarkan Status"
                      className="w-8 h-8 inline-flex items-center justify-center text-dim hover:text-heading rounded-lg hover:bg-muted border border-line transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>

                {/* Metrics row when connected */}
                {syncStatus?.workspace_id && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-muted/50 border border-line flex flex-col gap-0.5">
                      <p className="text-xs font-medium text-dim">Pending</p>
                      <p className={`text-lg font-bold tnum ${syncStatus.pending_count > 0 ? 'text-warning' : 'text-heading'}`}>
                        {syncStatus.pending_count}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-line flex flex-col gap-0.5">
                      <p className="text-xs font-medium text-dim">Gagal</p>
                      <p className={`text-lg font-bold tnum ${syncStatus.failed_count > 0 ? 'text-danger' : 'text-heading'}`}>
                        {syncStatus.failed_count}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-line flex flex-col justify-between gap-1">
                      <p className="text-xs font-medium text-dim">Auto Sync</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-semibold ${syncStatus.auto_sync ? 'text-success' : 'text-dim'}`}>
                          {syncStatus.auto_sync ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleAutoSync(!syncStatus.auto_sync)}
                          role="switch"
                          aria-checked={syncStatus.auto_sync}
                          aria-label="Auto Sync"
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            syncStatus.auto_sync ? 'bg-primary' : 'bg-line-strong'
                          }`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-card transition-transform ${
                            syncStatus.auto_sync ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-line flex flex-col justify-between gap-1">
                      <p className="text-xs font-medium text-dim">Sync Terakhir</p>
                      <p className="text-xs font-semibold text-heading tnum truncate">
                        {syncStatus.last_synced ? new Date(syncStatus.last_synced).toLocaleTimeString('id-ID') : '-'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* BYOK Supabase Cloud Configuration Panel */}
              <div className="bg-card rounded-xl border border-line overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCloudConfigOpen(!cloudConfigOpen)}
                  className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                      <Cloud size={16} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-heading truncate">
                          Kredensial Supabase (BYOK)
                        </h3>
                      </div>
                      <p className="text-xs text-dim truncate mt-0.5 font-mono">
                        {cloudUrl
                          ? `${cloudUrl.replace(/^https?:\/\//, '').split('.')[0]}.supabase.co`
                          : 'Belum dikonfigurasi'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-dim">
                    <span className="text-xs font-medium hidden sm:inline">
                      {cloudConfigOpen ? 'Tutup' : 'Ubah'}
                    </span>
                    {cloudConfigOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {cloudConfigOpen && (
                  <div className="p-4 border-t border-line space-y-4 bg-muted/20">
                    <div className="p-3 rounded-lg bg-muted/50 border border-line text-xs text-body flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Server size={14} className="text-dim shrink-0 mt-0.5" />
                        <span>
                          Jalankan skema SQL bootstrap di SQL Editor Supabase Anda untuk menyiapkan 34 tabel.
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openBrowserUrl(cloudUrl ? `${cloudUrl.replace(/\/$/, '')}` : 'https://supabase.com/dashboard/new')}
                        >
                          <span>Dashboard</span>
                          <ExternalLink size={11} />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewSqlModal('bootstrap')}
                        >
                          Lihat SQL
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCopyBootstrapSql}
                        >
                          {copiedSqlSchema ? <CheckCheck size={12} className="text-success" /> : <Copy size={12} />}
                          <span>{copiedSqlSchema ? 'Tersalin' : 'Salin SQL'}</span>
                        </Button>
                        {isAdmin && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setNukeStep(1)}
                            className="text-danger border-danger/30 hover:bg-danger-soft"
                          >
                            <Trash2 size={12} /> Kosongkan Cloud
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-heading mb-1.5">
                          Project URL <span className="text-danger">*</span>
                        </label>
                        <input
                          type="url"
                          value={cloudUrl}
                          onChange={(e) => setCloudUrl(e.target.value.trim())}
                          placeholder="https://xyzcompany.supabase.co"
                          className="w-full h-9 px-3 rounded-lg border border-line bg-input text-heading font-mono text-xs placeholder:text-dim focus:border-primary focus:ring-2 focus:ring-primary/25 outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-heading">
                            Anon / Public Key <span className="text-danger">*</span>
                          </label>
                          <span className="text-[11px] text-dim">Project Settings &gt; API</span>
                        </div>
                        <div className="relative flex items-center">
                          <input
                            type={showCloudKey ? 'text' : 'password'}
                            value={cloudAnonKey}
                            onChange={(e) => setCloudAnonKey(e.target.value.trim())}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            className="w-full h-9 pl-3 pr-9 rounded-lg border border-line bg-input text-heading font-mono text-xs placeholder:text-dim focus:border-primary focus:ring-2 focus:ring-primary/25 outline-none transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCloudKey(!showCloudKey)}
                            aria-label={showCloudKey ? 'Sembunyikan key' : 'Tampilkan key'}
                            className="absolute right-2.5 p-1 text-dim hover:text-heading transition-colors cursor-pointer"
                          >
                            {showCloudKey ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleTestCloud}
                            disabled={isTestingCloud || !cloudUrl || !cloudAnonKey}
                          >
                            {isTestingCloud ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />}
                            <span>{isTestingCloud ? 'Menguji...' : 'Uji Koneksi'}</span>
                          </Button>
                          {cloudTestStatus.status === 'success' && (
                            <span className="text-xs text-success font-semibold inline-flex items-center gap-1 tnum">
                              <CheckCircle2 size={13} /> Terhubung ({cloudTestStatus.latency} ms)
                            </span>
                          )}
                          {cloudTestStatus.status === 'error' && (
                            <span className="text-xs text-danger font-medium truncate max-w-[240px]" title={cloudTestStatus.error}>
                              Gagal: {cloudTestStatus.error}
                            </span>
                          )}
                        </div>

                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={handleSaveCloudConfig}
                          loading={isSavingCloud}
                        >
                          {!isSavingCloud && <Save size={13} />}
                          <span>Simpan Kredensial</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pending Queue Banner */}
              {syncStatus && syncStatus.pending_count > 0 && (
                <div className="p-4 rounded-xl bg-warning-soft border border-warning/30 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UploadCloud size={16} className="text-warning shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-heading tnum">
                        {syncStatus.pending_count} perubahan menunggu diunggah ke Cloud
                      </p>
                      <p className="text-xs text-dim mt-0.5">
                        {!syncStatus.workspace_id
                          ? 'Hubungkan ke workspace untuk mengunggah data.'
                          : 'Klik Push untuk mengunggah sekarang.'}
                      </p>
                    </div>
                  </div>
                  {syncStatus.workspace_id && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleManualPush}
                      disabled={isPushing || isPulling}
                      loading={isPushing}
                    >
                      {!isPushing && <UploadCloud size={13} />}
                      Push ({syncStatus.pending_count})
                    </Button>
                  )}
                </div>
              )}

              {/* Actions Card (when connected) OR Connect / Create Workspace Card */}
              {syncStatus?.workspace_id ? (
                <div className="bg-card rounded-xl border border-line p-4 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleManualPush}
                    disabled={isPushing || isPulling}
                    loading={isPushing}
                  >
                    {!isPushing && <UploadCloud size={14} />}
                    Push ke Cloud
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => handleManualPull(true)}
                    disabled={isPushing || isPulling}
                    loading={isPulling}
                  >
                    {!isPulling && <DownloadCloud size={14} />}
                    Pull dari Cloud
                  </Button>

                  <div className="flex-1" />

                  {isAdmin && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={() => setShowSwitchWorkspace(!showSwitchWorkspace)}
                      >
                        <Link2 size={14} /> Ganti Workspace
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={handleLeaveWorkspace}
                        className="text-danger border-danger/30 hover:bg-danger-soft"
                      >
                        <LogOut size={14} /> Putuskan
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-line p-5 space-y-4">
                  {/* Mode Segmented Switcher */}
                  <div className="flex items-center gap-0.5 p-1 bg-muted rounded-lg border border-line w-fit">
                    <button
                      type="button"
                      onClick={() => setConnectMode('join')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        connectMode === 'join'
                          ? 'bg-card text-heading border border-line'
                          : 'text-dim hover:text-heading border border-transparent'
                      }`}
                    >
                      <Link2 size={13} /> Hubungkan Workspace
                    </button>
                    <button
                      type="button"
                      onClick={() => { setConnectMode('create'); if (!createWsName && companyName) setCreateWsName(companyName); }}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        connectMode === 'create'
                          ? 'bg-card text-heading border border-line'
                          : 'text-dim hover:text-heading border border-transparent'
                      }`}
                    >
                      <Plus size={13} /> Buat Workspace
                    </button>
                  </div>

                  {joinError && (
                    <div className="p-3 bg-danger-soft border border-danger/30 rounded-lg flex items-center gap-2 text-danger text-xs font-medium">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>{joinError}</span>
                    </div>
                  )}

                  {connectMode === 'join' ? (
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-heading mb-1.5">
                            Kode Workspace <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            placeholder="WS-ABC123"
                            className="w-full h-9 px-3 rounded-lg border border-line bg-input text-heading text-sm font-mono font-semibold placeholder:text-dim focus:border-primary focus:ring-2 focus:ring-primary/25 outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-heading mb-1.5">
                            Password (Opsional)
                          </label>
                          <input
                            type="password"
                            value={joinPassword}
                            onChange={(e) => setJoinPassword(e.target.value)}
                            placeholder="Kosongkan jika tidak ada"
                            className="w-full h-9 px-3 rounded-lg border border-line bg-input text-heading text-sm placeholder:text-dim focus:border-primary focus:ring-2 focus:ring-primary/25 outline-none transition-colors"
                          />
                        </div>
                      </div>

                      {availableWorkspaces.length > 0 && (
                        <div className="p-3 rounded-lg bg-muted/40 border border-line flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-dim">Terdeteksi:</span>
                          {availableWorkspaces.map(ws => (
                            <button
                              key={ws.id}
                              type="button"
                              onClick={() => setJoinCode(ws.code)}
                              className="px-2.5 py-1 rounded-md bg-card border border-line hover:border-primary text-xs font-medium text-heading transition-colors cursor-pointer"
                            >
                              {ws.name} <span className="font-mono text-dim">({ws.code})</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          variant="primary"
                          size="md"
                          onClick={handleJoinWorkspace}
                          disabled={!joinCode.trim()}
                          loading={isJoining}
                        >
                          {!isJoining && <Plug size={14} />}
                          {isJoining ? 'Menghubungkan...' : 'Hubungkan'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleCreateWorkspace} className="space-y-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-heading mb-1.5">
                            Nama Workspace <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            value={createWsName}
                            onChange={(e) => {
                              setCreateWsName(e.target.value);
                              if (!createWsCode) setCreateWsCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase());
                            }}
                            placeholder="Kivo Store Pusat"
                            className="w-full h-9 px-3 rounded-lg border border-line bg-input text-heading text-sm placeholder:text-dim focus:border-primary focus:ring-2 focus:ring-primary/25 outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-heading mb-1.5">
                            Kode Workspace
                          </label>
                          <input
                            type="text"
                            value={createWsCode}
                            onChange={(e) => setCreateWsCode(e.target.value.toUpperCase())}
                            placeholder="KIVOPST"
                            className="w-full h-9 px-3 rounded-lg border border-line bg-input text-heading text-sm font-mono font-semibold placeholder:text-dim focus:border-primary focus:ring-2 focus:ring-primary/25 outline-none transition-colors"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end">
                        <Button
                          type="submit"
                          variant="primary"
                          size="md"
                          disabled={!createWsName.trim()}
                          loading={isCreatingWs}
                        >
                          {!isCreatingWs && <Plus size={14} />}
                          {isCreatingWs ? 'Membuat...' : 'Buat & Hubungkan'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Switch Workspace Panel */}
              {showSwitchWorkspace && syncStatus?.workspace_id && (
                <div className="bg-card rounded-xl border border-line p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Link2 size={14} className="text-dim" />
                    <h4 className="text-xs font-bold text-heading">Pindah Workspace</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Kode Workspace Baru"
                      className="w-full h-9 px-3 rounded-lg border border-line bg-input text-heading text-xs font-mono font-semibold focus:border-primary focus:ring-2 focus:ring-primary/25 outline-none"
                    />
                    <input
                      type="password"
                      value={joinPassword}
                      onChange={(e) => setJoinPassword(e.target.value)}
                      placeholder="Password (opsional)"
                      className="w-full h-9 px-3 rounded-lg border border-line bg-input text-heading text-xs focus:border-primary focus:ring-2 focus:ring-primary/25 outline-none"
                    />
                  </div>
                  {joinError && (
                    <div className="p-2.5 bg-danger-soft border border-danger/30 rounded-lg flex items-center gap-2 text-danger text-xs">
                      <AlertTriangle size={13} className="shrink-0" />
                      <span>{joinError}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowSwitchWorkspace(false)}>
                      Batal
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleJoinWorkspace}
                      disabled={!joinCode.trim()}
                      loading={isJoining}
                    >
                      {!isJoining && <Plug size={13} />}
                      {isJoining ? 'Menghubungkan...' : 'Hubungkan'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* TAB 1: KONFIGURASI UMUM */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full">
          {/* App Version & Updates Card (12 Cols) */}
          <div className="lg:col-span-12 bg-card rounded-xl border border-line p-4 sm:px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                <ArrowUpCircle size={18} strokeWidth={1.75} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-heading">{isMobilePlatform() ? 'Kivo Android' : 'Kivo Desktop'}</h3>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-dim">
                    v{APP_VERSION}
                  </span>
                  {updateInfo?.has_update && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary-soft text-primary">
                      Update {updateInfo.latest_version.startsWith('v') ? updateInfo.latest_version : `v${updateInfo.latest_version}`} tersedia
                    </span>
                  )}
                </div>
                <p className="text-xs text-dim mt-0.5">
                  {updateLastChecked
                    ? `Diperiksa pukul ${updateLastChecked.toLocaleTimeString('id-ID')}`
                    : 'Rilis resmi GitHub (AchiraStudio/kivo)'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {updateInfo?.has_update ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={
                    isMobilePlatform()
                      ? () => {
                          // Android installs APKs from the browser, so hand over the release link.
                          navigator.clipboard
                            .writeText(RELEASES_URL)
                            .then(() => toast.success('Tautan rilis disalin', 'Tempel di browser HP untuk mengunduh APK terbaru.'))
                            .catch(() => toast.info('Unduh APK terbaru di', RELEASES_URL));
                        }
                      : openModal
                  }
                  className="w-full sm:w-auto"
                >
                  <Download size={14} />
                  <span>{isMobilePlatform() ? `Salin tautan v${updateInfo.latest_version.replace(/^v/i, '')}` : `Perbarui (${updateInfo.latest_version})`}</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleManualUpdateCheck}
                  disabled={isCheckingUpdate}
                  className="w-full sm:w-auto"
                >
                  <RefreshCw size={13} className={isCheckingUpdate ? 'animate-spin' : ''} />
                  <span>{isCheckingUpdate ? 'Memeriksa...' : 'Periksa Pembaruan'}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Profil Perusahaan & Cabang (8 Cols) */}
          <div className="lg:col-span-8 bg-card rounded-xl border border-line p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                  <Building2 size={16} strokeWidth={1.75} />
                </div>
                <h2 className="text-sm font-bold text-heading">Profil Perusahaan & Cabang</h2>
              </div>
              {profileSuccess && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success bg-success-soft px-2.5 py-0.5 rounded-md">
                  <CheckCircle2 size={13} /> {profileSuccess}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-heading mb-1.5">
                  <Building2 size={13} className="text-dim" /> Nama Perusahaan / Toko
                  {!isOwner && <Lock size={11} className="text-dim ml-0.5" />}
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  disabled={!isOwner}
                  placeholder="Apotek Terang"
                  className={`w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading font-medium placeholder:text-dim outline-none transition-colors ${
                    isOwner
                      ? 'focus:border-primary focus:ring-2 focus:ring-primary/25'
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-heading mb-1.5">
                  <MapPin size={13} className="text-dim" /> Nama Cabang POS
                  {!isAdmin && <Lock size={11} className="text-dim ml-0.5" />}
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={e => setBranchName(e.target.value)}
                  disabled={!isAdmin}
                  placeholder="Cabang Utama"
                  className={`w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading font-medium placeholder:text-dim outline-none transition-colors ${
                    isAdmin
                      ? 'focus:border-primary focus:ring-2 focus:ring-primary/25'
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                />
              </div>
            </div>

            {isAdmin && (
              <div className="pt-1 flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleSaveProfile}
                  loading={profileSaving}
                >
                  {!profileSaving && <Save size={14} />}
                  Simpan Profil
                </Button>
              </div>
            )}
          </div>

          {/* Database Maintenance (4 Cols) */}
          {isAdmin && (
            <div className="lg:col-span-4 bg-card rounded-xl border border-line p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 border-b border-line pb-3.5">
                  <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                    <Database size={16} strokeWidth={1.75} />
                  </div>
                  <h2 className="text-sm font-bold text-heading">Backup & Optimasi DB</h2>
                </div>
                <p className="text-xs text-dim leading-snug">
                  Ekspor cadangan SQLite atau jalankan VACUUM untuk menjaga performa kueri.
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={handleExportDB}
                  disabled={loading}
                >
                  <Download size={14} /> Ekspor Backup (.db)
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  fullWidth
                  onClick={() => setResetTarget('maintenance')}
                  disabled={loading}
                >
                  <Database size={14} /> Optimalkan DB (VACUUM)
                </Button>

                {successMsg && (
                  <p className="text-xs text-center font-semibold text-success flex items-center justify-center gap-1.5 pt-1">
                    <CheckCircle2 size={13} className="shrink-0" /> {successMsg}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* System Preferences & Accounting Config (7 Cols) */}
          <div className="lg:col-span-7 bg-card rounded-xl border border-line p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-line pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                  <Sliders size={16} strokeWidth={1.75} />
                </div>
                <h2 className="text-sm font-bold text-heading">Konfigurasi Sistem & Keuangan</h2>
              </div>
              {saving && <Loader2 size={15} className="animate-spin text-primary" />}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
              {generalConfigs.map((c) => (
                <SettingRow key={c.key} config={c} onSave={handleSaveConfig} disabled={!isAdmin} />
              ))}
              {generalConfigs.length === 0 && (
                <p className="text-xs text-dim py-4 text-center sm:col-span-2">Tidak ada variabel sistem tambahan.</p>
              )}
            </div>

            {advancedConfigs.length > 0 && (
              <details className="group border-t border-line pt-3">
                <summary className="text-xs font-semibold text-dim cursor-pointer hover:text-heading select-none">
                  Pengaturan Lanjutan ({advancedConfigs.length})
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5 pt-3">
                  {advancedConfigs.map((c) => (
                    <SettingRow key={c.key} config={c} onSave={handleSaveConfig} disabled={!isAdmin} />
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Danger Zone (5 Cols) */}
          {isAdmin && (
            <div className="lg:col-span-5 bg-card rounded-xl border border-danger/30 p-5 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 border-b border-line pb-3.5">
                  <div className="w-8 h-8 rounded-lg bg-danger-soft text-danger flex items-center justify-center shrink-0">
                    <AlertTriangle size={16} strokeWidth={1.75} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-danger">Zona Berbahaya</h2>
                    <p className="text-xs text-dim">Tindakan penghapusan data permanen</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-line">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-heading">Reset Data Penjualan</p>
                      <p className="text-[11px] text-dim">Hapus transaksi POS dan jurnal kasir.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setResetTarget('sales')}
                      disabled={loading}
                      className="text-danger border-danger/30 hover:bg-danger-soft shrink-0"
                    >
                      Reset
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-line">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-heading">Reset Stok & Pembelian</p>
                      <p className="text-[11px] text-dim">Hapus kartu stok, mutasi, dan PO.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setResetTarget('inventory')}
                      disabled={loading}
                      className="text-danger border-danger/30 hover:bg-danger-soft shrink-0"
                    >
                      Reset
                    </Button>
                  </div>

                  <div className="pt-2 border-t border-line space-y-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="md"
                      fullWidth
                      onClick={() => setResetTarget('all')}
                      disabled={loading}
                    >
                      Factory Reset Database Lokal
                    </Button>
                    <p className="text-[11px] text-dim text-center">
                      Menghapus seluruh master data dan transaksi lokal.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-line space-y-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="md"
                      fullWidth
                      onClick={() => setNukeStep(1)}
                      disabled={loading}
                    >
                      <Trash2 size={14} /> Kosongkan Data Cloud
                    </Button>
                    <p className="text-[11px] text-dim text-center">
                      Mengosongkan transaksi dan katalog Cloud tanpa menghapus akun pengguna.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Membership Configurations Card */}
          {memberConfigs.length > 0 && (
            <div className="lg:col-span-12 bg-card rounded-xl border border-line p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-line pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                    <UserCheck size={16} strokeWidth={1.75} />
                  </div>
                  <h2 className="text-sm font-bold text-heading">Pengaturan Membership</h2>
                </div>
                {saving && <Loader2 size={14} className="animate-spin text-primary" />}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {memberConfigs.map((c) => (
                  <SettingRow key={c.key} config={c} onSave={handleSaveConfig} disabled={!isAdmin} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DB Reset / Maintenance Modal */}
      {resetTarget !== null && (
        <Modal
          isOpen={true}
          onClose={() => { setResetTarget(null); setConfirmText(''); }}
          size="md"
          title={resetTarget === 'maintenance' ? 'Optimalkan Database?' : 'Konfirmasi Reset Database'}
          icon={resetTarget === 'maintenance' ? Database : AlertTriangle}
          iconBg={resetTarget === 'maintenance' ? 'bg-muted text-heading' : 'bg-danger-soft text-danger'}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => { setResetTarget(null); setConfirmText(''); }}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant={resetTarget === 'maintenance' ? 'primary' : 'danger'}
                size="md"
                onClick={handleResetDB}
                disabled={resetTarget !== 'maintenance' && confirmText !== 'DELETE'}
                loading={loading}
              >
                {loading ? 'Memproses...' : resetTarget === 'maintenance' ? 'Jalankan VACUUM' : 'Eksekusi Reset'}
              </Button>
            </>
          }
        >
          <div className="space-y-3.5">
            {resetTarget === 'maintenance' ? (
              <p className="text-sm text-body leading-relaxed">
                Menjalankan <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono">VACUUM</code> dan <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono">ANALYZE</code> untuk mengompresi SQLite tanpa menghapus data.
              </p>
            ) : (
              <>
                <div className="p-3.5 bg-danger-soft border border-danger/30 rounded-lg text-xs text-danger font-medium leading-relaxed">
                  {resetTarget === 'sales' && 'Seluruh transaksi kasir, pembayaran, dan laporan penjualan akan dihapus permanen.'}
                  {resetTarget === 'inventory' && 'Seluruh kartu stok, mutasi barang, dan PO pembelian akan dihapus permanen.'}
                  {resetTarget === 'all' && 'Seluruh master data, stok, dan transaksi lokal akan dihapus permanen.'}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-heading mb-1.5">
                    Ketik <code className="font-mono text-danger">DELETE</code> untuk konfirmasi
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full h-9 bg-input border border-danger/40 rounded-lg px-3 text-sm font-bold text-danger outline-none uppercase font-mono focus:ring-2 focus:ring-danger/25"
                  />
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Nuke Supabase Modal Step 1: Warning & Scope */}
      {nukeStep === 1 && (
        <Modal
          isOpen={true}
          onClose={() => setNukeStep(0)}
          size="md"
          title="Kosongkan Data Cloud"
          icon={AlertTriangle}
          iconBg="bg-danger-soft text-danger"
          footer={
            <>
              <Button type="button" variant="outline" size="md" onClick={() => setNukeStep(0)}>
                Batal
              </Button>
              <Button type="button" variant="danger" size="md" onClick={() => setNukeStep(2)}>
                Lanjut Konfirmasi
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-body leading-relaxed">
              Seluruh transaksi, pembelian, stok, dan produk di Supabase Cloud akan dihapus permanen.
            </p>

            {/* Guarantees Box */}
            <div className="p-3.5 rounded-lg bg-success-soft border border-success/30 space-y-1.5">
              <div className="flex items-center gap-2 text-success font-semibold text-xs">
                <ShieldCheck size={15} className="shrink-0" />
                <span>Data yang tetap aman</span>
              </div>
              <ul className="text-xs text-body space-y-1 pl-5 list-disc">
                <li>Akun pengguna, peran, dan hak akses</li>
                <li>Workspace dan koneksi cabang</li>
                <li>Struktur seluruh 34 tabel database</li>
              </ul>
            </div>

            {/* Scope Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-heading">
                Cakupan Pembersihan
              </label>
              <div className="space-y-2">
                <label
                  className={`p-3 rounded-lg border flex items-start gap-2.5 cursor-pointer transition-colors ${
                    nukeAllData
                      ? 'border-danger bg-danger-soft/50'
                      : 'border-line bg-card hover:bg-muted/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="nukeScope"
                    checked={nukeAllData}
                    onChange={() => setNukeAllData(true)}
                    className="mt-0.5 accent-danger"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-heading">Seluruh Data Cloud (Semua Cabang)</p>
                    <p className="text-[11px] text-dim mt-0.5">Menghapus seluruh transaksi dan data uji di semua workspace.</p>
                  </div>
                </label>

                {syncStatus?.workspace_id && (
                  <label
                    className={`p-3 rounded-lg border flex items-start gap-2.5 cursor-pointer transition-colors ${
                      !nukeAllData
                        ? 'border-danger bg-danger-soft/50'
                        : 'border-line bg-card hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="nukeScope"
                      checked={!nukeAllData}
                      onChange={() => setNukeAllData(false)}
                      className="mt-0.5 accent-danger"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-heading">Hanya Workspace {syncStatus.workspace_name}</p>
                      <p className="text-[11px] text-dim mt-0.5">Menghapus baris data pada workspace aktif saja.</p>
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Nuke Supabase Modal Step 2: Text Confirmation */}
      {nukeStep === 2 && (
        <Modal
          isOpen={true}
          onClose={() => { setNukeStep(0); setNukeConfirmText(''); }}
          size="md"
          title="Konfirmasi Akhir"
          icon={Trash2}
          iconBg="bg-danger-soft text-danger"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => { setNukeStep(0); setNukeConfirmText(''); }}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={handleNukeCloudData}
                disabled={nukeConfirmText !== 'NUKE CLOUD DATA'}
                loading={loading}
              >
                {!loading && <Flame size={14} />}
                {loading ? 'Mengosongkan...' : 'Kosongkan Data Cloud'}
              </Button>
            </>
          }
        >
          <div className="space-y-3.5">
            <p className="text-xs text-body leading-relaxed">
              Target: <strong className="text-heading">{nukeAllData ? 'Seluruh Data Cloud' : `Workspace ${syncStatus?.workspace_name || 'Aktif'}`}</strong>. Ketik <code className="bg-danger-soft text-danger font-mono px-1.5 py-0.5 rounded-md font-semibold">NUKE CLOUD DATA</code> untuk melanjutkan.
            </p>
            <input
              type="text"
              placeholder="NUKE CLOUD DATA"
              value={nukeConfirmText}
              onChange={e => setNukeConfirmText(e.target.value)}
              className="w-full h-10 bg-input border border-danger/50 rounded-lg px-3 text-sm font-bold text-danger outline-none uppercase font-mono text-center focus:ring-2 focus:ring-danger/25"
            />
          </div>
        </Modal>
      )}

      {/* Bootstrap & Truncate SQL Viewer Modal */}
      {showSqlModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowSqlModal(false)}
          size="2xl"
          title={sqlModalTab === 'bootstrap' ? 'Skema SQL Supabase (34 Tabel)' : 'Skrip SQL TRUNCATE'}
          icon={Database}
          footer={
            <div className="flex items-center justify-between gap-2 w-full flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openBrowserUrl(cloudUrl ? `${cloudUrl.replace(/\/$/, '')}/sql` : 'https://supabase.com/dashboard/project/_/sql')}
              >
                <span>Buka SQL Editor</span>
                <ExternalLink size={12} />
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowSqlModal(false)}>
                  Tutup
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={sqlModalTab === 'bootstrap' ? handleCopyBootstrapSql : handleCopyTruncateSql}
                >
                  {(sqlModalTab === 'bootstrap' ? copiedSqlSchema : copiedTruncateSql) ? <CheckCheck size={13} /> : <Copy size={13} />}
                  <span>
                    {(sqlModalTab === 'bootstrap' ? copiedSqlSchema : copiedTruncateSql)
                      ? 'Tersalin'
                      : 'Salin SQL'}
                  </span>
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-3">
            {/* Tab switch inside modal */}
            <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-lg border border-line">
              <button
                type="button"
                onClick={() => handleSwitchSqlModalTab('bootstrap')}
                className={`py-1.5 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  sqlModalTab === 'bootstrap'
                    ? 'bg-card text-heading border border-line'
                    : 'text-dim hover:text-heading border border-transparent'
                }`}
              >
                Skema Bootstrap (34 Tabel)
              </button>
              <button
                type="button"
                onClick={() => handleSwitchSqlModalTab('truncate')}
                className={`py-1.5 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  sqlModalTab === 'truncate'
                    ? 'bg-danger-soft text-danger border border-danger/25'
                    : 'text-dim hover:text-heading border border-transparent'
                }`}
              >
                Kosongkan Data (TRUNCATE)
              </button>
            </div>

            <p className="text-xs text-dim">
              {sqlModalTab === 'bootstrap'
                ? 'Jalankan di SQL Editor Supabase untuk menyiapkan seluruh tabel, indeks, dan RLS.'
                : 'Mengosongkan transaksi, stok, dan produk di Cloud. Akun pengguna dan struktur tabel tetap aman.'}
            </p>
            <div className="rounded-lg border border-line bg-muted/40 p-3 max-h-[380px] overflow-y-auto custom-scrollbar font-mono text-[11px] text-body">
              <pre className="whitespace-pre-wrap select-all">{sqlContent}</pre>
            </div>
          </div>
        </Modal>
      )}

      {/* Global Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          variant={confirmModal.variant ?? 'danger'}
          confirmLabel={confirmModal.confirmLabel ?? 'Lanjutkan'}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}

function SettingRow({
  config,
  onSave,
  disabled,
}: {
  config: { key: string; value: string; description?: string };
  onSave: (k: string, v: string) => void;
  disabled?: boolean;
}) {
  const [val, setVal] = useState(config.value);
  const [showSecret, setShowSecret] = useState(false);
  const isApiKey = config.key === 'openai_api_key';
  const label = FIELD_LABELS[config.key] || config.key.replace(/_/g, ' ');

  const options = SELECT_OPTIONS[config.key] || (
    config.value === '1' || config.value === '0' || config.value === 'true' || config.value === 'false'
      ? [
          { label: 'Aktif', value: config.value === 'true' || config.value === '1' ? config.value : '1' },
          { label: 'Nonaktif', value: config.value === 'false' || config.value === '0' ? config.value : '0' },
        ]
      : null
  );

  useEffect(() => {
    setVal(config.value);
  }, [config.value]);

  const [applyingHpp, setApplyingHpp] = useState(false);

  const handleChange = (newVal: string) => {
    setVal(newVal);
    onSave(config.key, newVal);
  };

  const handleApplyHpp = async () => {
    setApplyingHpp(true);
    try {
      const msg = await invoke<string>('apply_hpp_retroactive', { method: val });
      toast.success('HPP diterapkan', msg);
    } catch (e) {
      toast.error('Gagal menerapkan HPP', String(e));
    } finally {
      setApplyingHpp(false);
    }
  };

  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-heading truncate">
          {label}
        </label>
        {isApiKey && (
          <button
            type="button"
            onClick={() => openBrowserUrl('https://platform.openai.com/api-keys')}
            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-medium cursor-pointer shrink-0"
          >
            <span>Dapatkan Key</span>
            <ExternalLink size={10} />
          </button>
        )}
      </div>

      <div className="flex gap-2 items-center">
        {options ? (
          <Select
            value={val}
            options={options}
            onChange={handleChange}
            disabled={disabled}
            className="flex-1 min-w-0"
          />
        ) : (
          <div className="relative flex-1 flex items-center min-w-0">
            <input
              type={isApiKey && !showSecret ? 'password' : 'text'}
              value={val}
              placeholder={isApiKey ? 'sk-proj-...' : ''}
              onChange={(e) => setVal(e.target.value)}
              disabled={disabled}
              onBlur={() => {
                if (val !== config.value) {
                  if (isApiKey) {
                    localStorage.setItem('kivo_openai_api_key', val.trim());
                  }
                  onSave(config.key, val);
                }
              }}
              className={`w-full h-9 bg-input border border-line rounded-lg text-sm text-heading placeholder:text-dim outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isApiKey ? 'pl-3 pr-9 font-mono text-xs' : 'px-3'
              }`}
            />
            {isApiKey && (
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                aria-label={showSecret ? 'Sembunyikan' : 'Tampilkan'}
                className="absolute right-2.5 p-1 text-dim hover:text-heading transition-colors cursor-pointer"
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
          </div>
        )}

        {(config.key === 'hpp_method' || config.key === 'hpp_method_default') && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleApplyHpp}
            disabled={applyingHpp || disabled}
            loading={applyingHpp}
          >
            {applyingHpp ? 'Menerapkan...' : 'Terapkan'}
          </Button>
        )}
      </div>
      {config.description && config.description !== label && (
        <p className="text-[11px] text-dim">{config.description}</p>
      )}
    </div>
  );
}

function SysadminWorkspaceManagement({ onWorkspaceChanged }: { onWorkspaceChanged?: () => void }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceListInfo[]>([]);
  const [allUsers, setAllUsers] = useState<UserRowFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedWs, setExpandedWs] = useState<string | null>(null);
  const [assignPick, setAssignPick] = useState('');
  const [assigningUser, setAssigningUser] = useState<string | null>(null);
  const [wsToDelete, setWsToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingWsId, setDeletingWsId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [ws, users] = await Promise.all([
        sysadminGetWorkspaces(),
        getUsers()
      ]);
      setWorkspaces(ws);
      setAllUsers(users);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await sysadminCreateWorkspace(newName, newCode);
      setShowCreate(false);
      setNewName('');
      setNewCode('');
      onWorkspaceChanged?.();
      await loadData();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!wsToDelete) return;
    const targetId = wsToDelete.id;
    setDeletingWsId(targetId);
    try {
      await sysadminDeleteWorkspace(targetId);
      toast.success('Workspace Dihapus', `Workspace "${wsToDelete.name}" dihapus.`);
      setWsToDelete(null);
      setWorkspaces(prev => prev.filter(w => w.id !== targetId));
      setAllUsers(prev => prev.map(u => u.workspace_id === targetId ? { ...u, workspace_id: undefined } : u));
      onWorkspaceChanged?.();
      await loadData();
    } catch (e: any) {
      toast.error('Gagal Menghapus Workspace', e.message || String(e));
    } finally {
      setDeletingWsId(null);
    }
  };

  const handleAssignWorkspace = async (userId: string, workspaceId: string | null) => {
    setAssigningUser(userId);
    try {
      await assignUserWorkspace(userId, workspaceId);
      await loadData();
    } catch (e: any) {
      toast.error('Gagal Menugaskan Workspace', e.message || String(e));
    } finally {
      setAssigningUser(null);
    }
  };

  const getUsersInWorkspace = (wsId: string) => allUsers.filter(u => u.workspace_id === wsId);
  const getUnassignedUsers = () => allUsers.filter(u => !u.workspace_id);

  return (
    <div className="bg-card rounded-xl border border-line p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
            <Globe size={16} strokeWidth={1.75} />
          </div>
          <h2 className="text-sm font-bold text-heading">Kelola Workspace</h2>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus size={14} /> Workspace Baru
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-danger-soft border border-danger/30 text-danger rounded-lg text-xs font-medium flex items-center justify-between gap-2">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={loadData}>
            Coba Lagi
          </Button>
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="p-4 bg-muted/40 rounded-lg border border-line space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-heading block mb-1.5">Nama Workspace</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Apotek Terang Pusat"
                className="w-full h-9 px-3 bg-input border border-line rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 text-sm text-heading"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-heading block mb-1.5">Kode Unik</label>
              <input
                type="text"
                value={newCode}
                onChange={e => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                placeholder="TERANG-01"
                className="w-full h-9 px-3 bg-input border border-line rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 uppercase font-mono text-sm font-semibold text-heading"
                maxLength={32}
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={creating}>
              Buat Workspace
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-dim">
          <Loader2 size={22} className="animate-spin text-primary" />
          <span className="text-xs">Memuat workspace...</span>
        </div>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-10 text-dim text-xs">Belum ada workspace Cloud.</div>
      ) : (
        <div className="space-y-2.5">
          {workspaces.map(ws => {
            const wsUsers = getUsersInWorkspace(ws.id);
            const isExpanded = expandedWs === ws.id;
            return (
              <div key={ws.id} className="border border-line rounded-xl overflow-hidden bg-card">
                <div
                  className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setExpandedWs(isExpanded ? null : ws.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                      <Globe size={15} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-heading truncate">{ws.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-[11px] font-mono text-body bg-muted px-1.5 py-0.5 rounded-md font-semibold">{ws.code}</code>
                        <span className="text-xs text-dim tnum">{wsUsers.length} anggota</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWsToDelete({ id: ws.id, name: ws.name });
                      }}
                      disabled={deletingWsId === ws.id}
                      aria-label={`Hapus ${ws.name}`}
                      title="Hapus Workspace"
                      className="w-8 h-8 inline-flex items-center justify-center text-dim hover:text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Trash2 size={14} />
                    </button>
                    <span className="text-dim p-1">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-line bg-muted/30 p-3 space-y-2">
                    {wsUsers.length === 0 ? (
                      <p className="text-xs text-dim py-1">Belum ada anggota di workspace ini.</p>
                    ) : wsUsers.map(u => (
                      <div key={u.id} className="flex items-center justify-between py-2 px-3 bg-card rounded-lg border border-line gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-muted border border-line text-heading flex items-center justify-center text-xs font-bold shrink-0">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-heading truncate">{u.name}</p>
                            <p className="text-[11px] text-dim truncate">@{u.username} · {u.role}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignWorkspace(u.id, null)}
                          disabled={assigningUser === u.id}
                          className="text-danger border-danger/30 hover:bg-danger-soft shrink-0"
                        >
                          {assigningUser === u.id ? '...' : 'Lepas'}
                        </Button>
                      </div>
                    ))}

                    {getUnassignedUsers().length > 0 && (
                      <div className="pt-1">
                        <Select
                          size="sm"
                          className="w-full"
                          value={assignPick}
                          placeholder="Tambahkan anggota ke workspace..."
                          onChange={v => {
                            if (v) {
                              handleAssignWorkspace(v, ws.id);
                              setAssignPick('');
                            }
                          }}
                        >
                          <option value="" disabled>Tambahkan anggota ke workspace...</option>
                          {getUnassignedUsers().map(u => (
                            <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                          ))}
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unassigned users section */}
      {!loading && getUnassignedUsers().length > 0 && (
        <div className="p-3.5 bg-warning-soft border border-warning/30 rounded-xl space-y-2.5">
          <p className="text-xs font-semibold text-warning flex items-center gap-1.5 tnum">
            <AlertTriangle size={14} /> Pengguna Tanpa Workspace ({getUnassignedUsers().length})
          </p>
          <div className="space-y-2">
            {getUnassignedUsers().map(u => (
              <div key={u.id} className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-heading truncate">
                  {u.name} <span className="text-dim font-mono">(@{u.username})</span>
                </span>
                <Select
                  size="sm"
                  className="w-48 shrink-0"
                  value={assignPick}
                  placeholder="Pilih workspace..."
                  onChange={v => {
                    if (v) {
                      handleAssignWorkspace(u.id, v);
                      setAssignPick('');
                    }
                  }}
                >
                  <option value="" disabled>Pilih workspace...</option>
                  {workspaces.map(ws => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}

      {wsToDelete && (
        <ConfirmModal
          title="Hapus Workspace?"
          message={`Workspace "${wsToDelete.name}" akan dihapus permanen dari Supabase Cloud.`}
          confirmLabel={deletingWsId ? 'Menghapus...' : 'Hapus Workspace'}
          cancelLabel="Batal"
          variant="danger"
          loading={!!deletingWsId}
          onConfirm={handleDeleteWorkspace}
          onCancel={() => setWsToDelete(null)}
        />
      )}
    </div>
  );
}
