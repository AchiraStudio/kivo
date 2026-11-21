import { useState } from 'react';
import {
  Building2,
  Cloud,
  CheckCircle2,
  ArrowLeft,
  Store,
  Users,
  FileSpreadsheet,
  Lock,
  Eye,
  EyeOff,
  Server,
  Check,
  AlertCircle,
  Upload,
  MapPin,
  Phone,
  Sun,
  Moon,
  Pill,
  ShoppingCart,
  Coffee,
  Wrench,
  Briefcase,
  KeyRound,
  Download,
  ExternalLink,
  Copy,
  CheckCheck,
  MessageSquare,
  Plug,
} from 'lucide-react';
import {
  setSetting,
  createWorkspace,
  joinWorkspace,
  createUser,
  getUsers,
  loginUser,
  importItemsExcel,
  triggerSyncPull,
  WorkspaceInfo,
  setCloudConfig,
  testCloudConnection,
  getBootstrapSql,
  openBrowserUrl,
  invoke,
} from '../../lib/api';
import { open } from '@tauri-apps/plugin-dialog';
import { useAuthStore } from '../../store/AuthStore';
import { supabase, updateSupabaseCredentials, getSavedSupabaseCredentials } from '../../lib/supabase';
import KivoLogo from '../../components/common/KivoLogo';
import TitleBar from '../../components/TitleBar';
import { useTheme } from '../../components/ThemeProvider';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';

type SetupMode = 'new' | 'join' | 'restore';

interface SetupWizardProps {
  onComplete: () => void;
  onCancel?: () => void;
}

const BUSINESS_TYPES = [
  { id: 'pharmacy', label: 'Apotek', icon: Pill },
  { id: 'retail', label: 'Retail', icon: ShoppingCart },
  { id: 'fnb', label: 'F&B', icon: Coffee },
  { id: 'hardware', label: 'Bangunan', icon: Wrench },
  { id: 'general', label: 'Umum', icon: Briefcase },
];

const INPUT_CLASS =
  'w-full h-9 px-3 bg-input border border-line rounded-lg text-heading placeholder:text-dim text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

const ICON_INPUT_CLASS =
  'w-full h-9 pl-9 pr-3 bg-input border border-line rounded-lg text-heading placeholder:text-dim text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

const LABEL_CLASS = 'text-xs font-semibold text-heading block';

export default function SetupWizard({ onComplete, onCancel }: SetupWizardProps) {
  const [step, setStep] = useState<number>(0);
  const [mode, setMode] = useState<SetupMode>('new');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { setAuth } = useAuthStore();
  const { theme, setTheme } = useTheme();

  // Mode NEW: Store Identity
  const [companyName, setCompanyName] = useState('Kivo Store');
  const [branchName, setBranchName] = useState('Cabang Utama');
  const [businessType, setBusinessType] = useState('retail');
  const [currency, setCurrency] = useState('IDR');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');

  // Mode NEW: Cloud & Workspace
  const [enableCloud, setEnableCloud] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('Kivo Store');
  const [workspaceCode, setWorkspaceCode] = useState('');
  const [createdWorkspace, setCreatedWorkspace] = useState<WorkspaceInfo | null>(null);

  // Mode NEW: BYOK Cloud (Supabase)
  const [supabaseUrl, setSupabaseUrl] = useState(() => getSavedSupabaseCredentials().url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => getSavedSupabaseCredentials().anonKey);
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestStatus, setSupabaseTestStatus] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    latency?: number;
    error?: string;
  }>({ status: 'idle' });
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Mode NEW: Kivo AI (OpenAI)
  const [openaiApiKey, setOpenaiApiKey] = useState(() => localStorage.getItem('kivo_openai_api_key') || '');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  // Mode NEW: Owner Account
  const [ownerName, setOwnerName] = useState('Pemilik Usaha');
  const [ownerUsername, setOwnerUsername] = useState('owner');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Mode NEW: Seed Config
  const [hppMethod, setHppMethod] = useState<'avg' | 'fifo' | 'lifo'>('avg');
  const [taxRate, setTaxRate] = useState('0');
  const [memberDiscount, setMemberDiscount] = useState('5');
  const [vipDiscount, setVipDiscount] = useState('10');
  const [importedRowCount, setImportedRowCount] = useState<number | null>(null);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);

  // Mode JOIN State
  const [joinCodeOrToken, setJoinCodeOrToken] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinTab, setJoinTab] = useState<'existing' | 'new_cashier'>('existing');
  const [joinCashierName, setJoinCashierName] = useState('Kasir 1');
  const [joinUsername, setJoinUsername] = useState('');
  const [joinUserPassword, setJoinUserPassword] = useState('');
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('');

  // Mode RESTORE State
  const [restoreCode, setRestoreCode] = useState('');
  const [restoreWsPassword, setRestoreWsPassword] = useState('');
  const [restoreUsername, setRestoreUsername] = useState('');
  const [restorePassword, setRestorePassword] = useState('');

  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val);
    setWorkspaceName(val);
    const clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    if (!workspaceCode || workspaceCode.startsWith('KV-')) {
      setWorkspaceCode(`KV-${clean || 'STORE'}-${randomSuffix}`);
    }
  };

  const handleTestCloudConnection = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setSupabaseTestStatus({ status: 'error', error: 'Isi URL dan Anon Key terlebih dahulu.' });
      return;
    }
    setTestingSupabase(true);
    setSupabaseTestStatus({ status: 'testing' });
    try {
      const res = await testCloudConnection(supabaseUrl.trim(), supabaseAnonKey.trim());
      if (res.success) {
        setSupabaseTestStatus({ status: 'success', latency: res.latency_ms });
      } else {
        setSupabaseTestStatus({ status: 'error', error: res.error || 'Gagal terhubung ke Supabase.' });
      }
    } catch (e: any) {
      setSupabaseTestStatus({ status: 'error', error: e.message || String(e) });
    } finally {
      setTestingSupabase(false);
    }
  };

  const handleCopySchemaNotice = async () => {
    try {
      const sql = await getBootstrapSql();
      await navigator.clipboard.writeText(sql);
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 3000);
    } catch (e: any) {
      setError('Gagal menyalin skema SQL: ' + (e.message || String(e)));
    }
  };

  const handleNewStep2Next = async () => {
    setError('');
    if (enableCloud) {
      if (!supabaseUrl.trim()) {
        setError('Supabase Project URL wajib diisi.');
        return;
      }
      if (!supabaseAnonKey.trim()) {
        setError('Supabase Anon Key wajib diisi.');
        return;
      }
      if (!workspaceCode.trim()) {
        setError('Kode workspace wajib diisi.');
        return;
      }
      setLoading(true);
      try {
        await setCloudConfig(supabaseUrl.trim(), supabaseAnonKey.trim());
        updateSupabaseCredentials(supabaseUrl.trim(), supabaseAnonKey.trim());
        const ws = await createWorkspace(workspaceName.trim() || companyName, workspaceCode.trim().toUpperCase());
        setCreatedWorkspace(ws);
        setStep(3);
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
      return;
    }
    setStep(3);
  };

  const handleNewStep3Next = () => {
    setError('');
    if (!ownerName.trim()) {
      setError('Nama pemilik wajib diisi.');
      return;
    }
    if (!ownerUsername.trim()) {
      setError('Username wajib diisi.');
      return;
    }
    if (!ownerPassword || ownerPassword.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    if (ownerPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    setStep(4);
  };

  const handlePickExcel = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx', 'xls'] }],
      });
      if (!selected || typeof selected !== 'string') return;

      setLoading(true);
      setError('');
      const res = await importItemsExcel(selected);
      if (res.success) {
        setImportedRowCount(res.rows_imported);
        setImportedFileName(selected.split(/[\\/]/).pop() || 'File Excel');
      } else {
        setError(`Gagal import: ${res.errors.join(', ')}`);
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleNewFinish = async () => {
    setLoading(true);
    setError('');
    try {
      const wsId = createdWorkspace?.id || null;
      const users = await getUsers().catch(() => []);
      const existingUser = users.find(u => u.username.toLowerCase() === ownerUsername.trim().toLowerCase());

      if (existingUser) {
        await invoke('update_user', {
          id: existingUser.id,
          name: ownerName.trim(),
          username: ownerUsername.trim().toLowerCase(),
          role: 'owner',
          workspaceId: wsId,
        });
        await invoke('reset_user_password', {
          id: existingUser.id,
          newPassword: ownerPassword,
        });
      } else {
        await createUser(
          ownerName.trim(),
          ownerUsername.trim().toLowerCase(),
          ownerPassword,
          'owner',
          wsId
        );
      }

      const settingsToSave: [string, string][] = [
        ['has_completed_setup', 'true'],
        ['company_name', companyName.trim() || 'Kivo Store'],
        ['branch_name', branchName.trim() || 'Cabang Utama'],
        ['business_type', businessType],
        ['currency', currency],
        ['company_address', companyAddress.trim()],
        ['company_phone', companyPhone.trim()],
        ['hpp_method_default', hppMethod],
        ['tax_rate', taxRate || '0'],
        ['tier_member_discount', memberDiscount || '5'],
        ['tier_vip_discount', vipDiscount || '10'],
        ['receipt_header', (companyName.trim() || 'KIVO STORE').toUpperCase()],
        ['receipt_footer', 'Terima kasih atas kunjungan Anda!'],
        ['auto_sync', enableCloud ? 'true' : 'false'],
        ['lan_auto_connect', 'false'],
      ];

      for (const [key, value] of settingsToSave) {
        await setSetting(key, value);
      }

      if (openaiApiKey.trim()) {
        await setSetting('openai_api_key', openaiApiKey.trim());
        localStorage.setItem('kivo_openai_api_key', openaiApiKey.trim());
      }
      if (enableCloud && supabaseUrl.trim() && supabaseAnonKey.trim()) {
        await setCloudConfig(supabaseUrl.trim(), supabaseAnonKey.trim());
        updateSupabaseCredentials(supabaseUrl.trim(), supabaseAnonKey.trim());
      }

      const loginRes = await loginUser(ownerUsername.trim().toLowerCase(), ownerPassword);
      if (loginRes.supabase_token) {
        await supabase.auth.setSession({ access_token: loginRes.supabase_token, refresh_token: '' });
      }
      setAuth(loginRes.token, loginRes.user);
      onComplete();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinStep1Next = async () => {
    setError('');
    if (!joinCodeOrToken.trim()) {
      setError('Kode workspace wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      if (supabaseUrl.trim() && supabaseAnonKey.trim()) {
        await setCloudConfig(supabaseUrl.trim(), supabaseAnonKey.trim());
        updateSupabaseCredentials(supabaseUrl.trim(), supabaseAnonKey.trim());
      }
      const ws = await joinWorkspace(joinCodeOrToken.trim(), joinPassword || undefined);
      setCreatedWorkspace(ws);
      setStep(2);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinStep2Next = async () => {
    setError('');
    setLoading(true);
    try {
      const wsId = createdWorkspace?.id || null;
      if (joinTab === 'existing') {
        if (!joinUsername.trim() || !joinUserPassword) {
          setError('Username dan password wajib diisi.');
          setLoading(false);
          return;
        }
        await triggerSyncPull(true).catch(() => {});
        const loginRes = await loginUser(joinUsername.trim().toLowerCase(), joinUserPassword);
        if (loginRes.supabase_token) {
          await supabase.auth.setSession({ access_token: loginRes.supabase_token, refresh_token: '' });
        }
        setAuth(loginRes.token, loginRes.user);
      } else {
        if (!joinCashierName.trim() || !joinUsername.trim() || !joinUserPassword) {
          setError('Semua data kasir wajib diisi.');
          setLoading(false);
          return;
        }
        if (joinUserPassword !== joinConfirmPassword) {
          setError('Konfirmasi password tidak cocok.');
          setLoading(false);
          return;
        }
        await createUser(
          joinCashierName.trim(),
          joinUsername.trim().toLowerCase(),
          joinUserPassword,
          'staff',
          wsId
        );
        const loginRes = await loginUser(joinUsername.trim().toLowerCase(), joinUserPassword);
        if (loginRes.supabase_token) {
          await supabase.auth.setSession({ access_token: loginRes.supabase_token, refresh_token: '' });
        }
        setAuth(loginRes.token, loginRes.user);
      }
      setStep(3);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinFinish = async () => {
    setLoading(true);
    try {
      await setSetting('has_completed_setup', 'true');
      if (createdWorkspace?.name) {
        await setSetting('company_name', createdWorkspace.name);
      }
      await setSetting('branch_name', 'Titik Kasir');
      await setSetting('auto_sync', 'false');
      await setSetting('lan_auto_connect', 'false');
      await triggerSyncPull(true).catch(() => {});
      onComplete();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreStep1Next = async () => {
    setError('');
    if (!restoreCode.trim()) {
      setError('Kode toko wajib diisi.');
      return;
    }
    if (!restoreUsername.trim() || !restorePassword) {
      setError('Username dan password pemilik wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      if (supabaseUrl.trim() && supabaseAnonKey.trim()) {
        await setCloudConfig(supabaseUrl.trim(), supabaseAnonKey.trim());
        updateSupabaseCredentials(supabaseUrl.trim(), supabaseAnonKey.trim());
      }
      const ws = await joinWorkspace(restoreCode.trim(), restoreWsPassword || undefined);
      setCreatedWorkspace(ws);
      setStep(2);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreDownload = async () => {
    setError('');
    setLoading(true);
    try {
      await triggerSyncPull(true);
      const loginRes = await loginUser(restoreUsername.trim().toLowerCase(), restorePassword);
      if (loginRes.supabase_token) {
        await supabase.auth.setSession({ access_token: loginRes.supabase_token, refresh_token: '' });
      }
      setAuth(loginRes.token, loginRes.user);

      await setSetting('has_completed_setup', 'true');
      if (createdWorkspace?.name) {
        await setSetting('company_name', createdWorkspace.name);
      }
      await setSetting('auto_sync', 'false');
      await setSetting('lan_auto_connect', 'false');

      setStep(3);
    } catch (err: any) {
      setError(`Gagal memulihkan database: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const modeLabel = mode === 'new' ? 'Toko Baru' : mode === 'join' ? 'Gabung Workspace' : 'Pulihkan Cloud';

  return (
    <div className="h-[100dvh] w-full bg-background text-heading flex flex-col overflow-hidden select-none">
      <TitleBar
        leftContent={
          <div className="flex items-center gap-2">
            <KivoLogo size={18} showText textClassName="text-xs font-bold" />
            <span className="text-[11px] font-mono text-dim">1.5.4</span>
          </div>
        }
        centerContent={<span className="text-xs font-semibold text-dim">Setup · {modeLabel}</span>}
        rightExtra={
          <button
            type="button"
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Ganti tema"
            className="h-full px-3 flex items-center justify-center text-dim hover:text-heading hover:bg-muted transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        }
      />

      <main className="flex-1 min-h-0 max-w-2xl w-full mx-auto px-4 py-5 flex flex-col justify-center overflow-hidden">
        {error && (
          <div className="mb-3 p-3 rounded-lg bg-danger-soft border border-danger/25 text-danger text-xs flex items-center gap-2 shrink-0">
            <AlertCircle size={15} className="shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        <div className="bg-card border border-line rounded-xl p-5 sm:p-6 overflow-y-auto max-h-full custom-scrollbar">
          {/* STEP 0: Mode Selection */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-heading">Mulai Setup Kivo</h2>
                <p className="text-xs text-dim mt-0.5">Pilih cara menyiapkan perangkat ini.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'new' as const, icon: Store, title: 'Buat Toko Baru', desc: 'Data tersimpan lokal, siap offline.' },
                  { id: 'join' as const, icon: Cloud, title: 'Gabung Workspace', desc: 'Hubungkan kasir ke toko yang ada.' },
                  { id: 'restore' as const, icon: Server, title: 'Pulihkan Cloud', desc: 'Unduh seluruh data dari Supabase.' },
                ].map(opt => {
                  const Icon = opt.icon;
                  const active = mode === opt.id;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setMode(opt.id)}
                      className={`p-4 rounded-xl border text-left transition-colors cursor-pointer space-y-2 ${
                        active
                          ? 'border-primary bg-primary-soft'
                          : 'border-line bg-card hover:bg-muted/60 hover:border-line-strong'
                      }`}
                    >
                      <Icon size={18} className={active ? 'text-primary' : 'text-dim'} />
                      <div>
                        <p className="font-bold text-sm text-heading">{opt.title}</p>
                        <p className="text-xs text-dim mt-0.5">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-line">
                {onCancel ? (
                  <Button type="button" variant="outline" size="md" onClick={onCancel}>
                    <ArrowLeft size={14} />
                    Login
                  </Button>
                ) : (
                  <div />
                )}
                <Button type="button" variant="primary" size="md" onClick={() => { setError(''); setStep(1); }}>
                  Lanjut
                </Button>
              </div>
            </div>
          )}

          {/* NEW - STEP 1: Store Identity */}
          {mode === 'new' && step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-heading">Identitas Toko</h2>
                <p className="text-xs text-dim mt-0.5">Dipakai pada struk dan laporan.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Nama Toko *</label>
                  <div className="relative flex items-center">
                    <Building2 size={15} className="absolute left-3 text-dim pointer-events-none" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => handleCompanyNameChange(e.target.value)}
                      placeholder="Nama toko"
                      className={ICON_INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Cabang</label>
                  <div className="relative flex items-center">
                    <Store size={15} className="absolute left-3 text-dim pointer-events-none" />
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="Cabang Utama"
                      className={ICON_INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Mata Uang</label>
                  <Select value={currency} onChange={(v) => setCurrency(v)} className="w-full">
                    <option value="IDR">IDR (Rp)</option>
                    <option value="USD">USD ($)</option>
                    <option value="SGD">SGD (S$)</option>
                    <option value="MYR">MYR (RM)</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Kontak</label>
                  <div className="relative flex items-center">
                    <Phone size={15} className="absolute left-3 text-dim pointer-events-none" />
                    <input
                      type="text"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className={ICON_INPUT_CLASS}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLASS}>Alamat</label>
                <div className="relative flex items-start">
                  <MapPin size={15} className="absolute left-3 top-2.5 text-dim pointer-events-none" />
                  <textarea
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    rows={2}
                    placeholder="Alamat toko"
                    className="w-full pl-9 pr-3 py-2 bg-input border border-line rounded-lg text-heading placeholder:text-dim text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={LABEL_CLASS}>Jenis Usaha</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {BUSINESS_TYPES.map((b) => {
                    const IconComp = b.icon;
                    const isSelected = businessType === b.id;
                    return (
                      <button
                        type="button"
                        key={b.id}
                        onClick={() => setBusinessType(b.id)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-colors flex flex-col items-center gap-1.5 ${
                          isSelected
                            ? 'border-primary bg-primary-soft text-primary'
                            : 'border-line bg-card hover:bg-muted text-dim hover:text-heading'
                        }`}
                      >
                        <IconComp size={16} />
                        <span className="font-semibold text-xs text-heading">{b.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t border-line">
                <Button type="button" variant="outline" size="md" onClick={() => setStep(0)}>
                  Kembali
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (!companyName.trim()) {
                      setError('Nama toko wajib diisi.');
                      return;
                    }
                    setError('');
                    setStep(2);
                  }}
                >
                  Lanjut
                </Button>
              </div>
            </div>
          )}

          {/* NEW - STEP 2: Cloud & AI (Optional) */}
          {mode === 'new' && step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-heading">Cloud &amp; AI (Opsional)</h2>
                <p className="text-xs text-dim mt-0.5">Lewati untuk bekerja 100% lokal di perangkat ini.</p>
              </div>

              <button
                type="button"
                onClick={() => setEnableCloud(!enableCloud)}
                className={`w-full p-3.5 rounded-lg border text-left cursor-pointer transition-colors flex items-center gap-3 ${
                  enableCloud ? 'border-primary bg-primary-soft' : 'border-line bg-card hover:bg-muted/60'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                    enableCloud ? 'bg-primary text-white' : 'border border-line-strong'
                  }`}
                >
                  {enableCloud && <Check size={12} strokeWidth={3} />}
                </span>
                <div>
                  <p className="font-semibold text-sm text-heading">Aktifkan sinkronisasi Supabase</p>
                  <p className="text-xs text-dim">Gunakan project Supabase milik Anda sendiri.</p>
                </div>
              </button>

              {enableCloud && (
                <div className="p-4 rounded-xl bg-muted/40 border border-line space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-heading">Kredensial Supabase</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openBrowserUrl(supabaseUrl ? supabaseUrl.replace(/\/$/, '') : 'https://supabase.com/dashboard/new')}
                      >
                        Dashboard
                        <ExternalLink size={12} />
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleCopySchemaNotice}>
                        {copiedSchema ? <CheckCheck size={12} className="text-success" /> : <Copy size={12} />}
                        {copiedSchema ? 'Tersalin' : 'Salin SQL'}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Project URL *</label>
                    <input
                      type="url"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value.trim())}
                      placeholder="https://xyz.supabase.co"
                      className={`${INPUT_CLASS} font-mono text-xs`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Anon Key *</label>
                    <div className="relative flex items-center">
                      <input
                        type={showAnonKey ? 'text' : 'password'}
                        value={supabaseAnonKey}
                        onChange={(e) => setSupabaseAnonKey(e.target.value.trim())}
                        placeholder="eyJhbGci..."
                        className={`${INPUT_CLASS} pr-9 font-mono text-xs`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAnonKey(!showAnonKey)}
                        aria-label="Toggle key"
                        className="absolute right-2.5 p-1 text-dim hover:text-heading cursor-pointer"
                      >
                        {showAnonKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>Nama Workspace</label>
                      <input
                        type="text"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>Kode Workspace *</label>
                      <input
                        type="text"
                        value={workspaceCode}
                        onChange={(e) => setWorkspaceCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                        placeholder="KV-TOKO-01"
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTestCloudConnection}
                      disabled={testingSupabase || !supabaseUrl || !supabaseAnonKey}
                      loading={testingSupabase}
                    >
                      <Plug size={13} />
                      Tes Koneksi
                    </Button>

                    {supabaseTestStatus.status === 'success' && (
                      <span className="text-xs text-success font-semibold">
                        Terhubung ({supabaseTestStatus.latency}ms)
                      </span>
                    )}
                    {supabaseTestStatus.status === 'error' && (
                      <span className="text-xs text-danger truncate max-w-[240px]">
                        {supabaseTestStatus.error}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-muted/40 border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-heading flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-dim" />
                    OpenAI API Key (opsional)
                  </span>
                  <button
                    type="button"
                    onClick={() => openBrowserUrl('https://platform.openai.com/api-keys')}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Dapatkan Key
                    <ExternalLink size={11} />
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value.trim())}
                    placeholder="sk-proj-..."
                    className={`${INPUT_CLASS} pr-9 font-mono text-xs`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    aria-label="Toggle API key"
                    className="absolute right-2.5 p-1 text-dim hover:text-heading cursor-pointer"
                  >
                    {showOpenaiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t border-line">
                <Button type="button" variant="outline" size="md" onClick={() => setStep(1)}>
                  Kembali
                </Button>
                <Button type="button" variant="primary" size="md" onClick={handleNewStep2Next} loading={loading}>
                  {enableCloud ? 'Verifikasi & Lanjut' : 'Lanjut Lokal'}
                </Button>
              </div>
            </div>
          )}

          {/* NEW - STEP 3: Owner Account */}
          {mode === 'new' && step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-heading">Akun Pemilik</h2>
                <p className="text-xs text-dim mt-0.5">Akun utama dengan akses penuh.</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Nama Lengkap *</label>
                  <div className="relative flex items-center">
                    <Users size={15} className="absolute left-3 text-dim pointer-events-none" />
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Nama lengkap"
                      className={ICON_INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Username *</label>
                  <input
                    type="text"
                    value={ownerUsername}
                    onChange={(e) => setOwnerUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    placeholder="owner"
                    className={`${INPUT_CLASS} font-mono`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Password *</label>
                    <div className="relative flex items-center">
                      <Lock size={15} className="absolute left-3 text-dim pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        placeholder="Min. 6 karakter"
                        className={`${ICON_INPUT_CLASS} pr-9`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label="Toggle password"
                        className="absolute right-2.5 text-dim hover:text-heading p-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Konfirmasi Password *</label>
                    <div className="relative flex items-center">
                      <Lock size={15} className="absolute left-3 text-dim pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ulangi password"
                        className={ICON_INPUT_CLASS}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t border-line">
                <Button type="button" variant="outline" size="md" onClick={() => setStep(2)}>
                  Kembali
                </Button>
                <Button type="button" variant="primary" size="md" onClick={handleNewStep3Next}>
                  Lanjut
                </Button>
              </div>
            </div>
          )}

          {/* NEW - STEP 4: Operational Defaults */}
          {mode === 'new' && step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-heading">Pengaturan Awal</h2>
                <p className="text-xs text-dim mt-0.5">Bisa diubah kapan saja di menu Pengaturan.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>Metode HPP</label>
                  <div className="space-y-1.5">
                    {[
                      { id: 'avg', title: 'Moving Average' },
                      { id: 'fifo', title: 'FIFO' },
                      { id: 'lifo', title: 'LIFO' },
                    ].map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setHppMethod(m.id as any)}
                        className={`w-full px-3 py-2 rounded-lg border text-left text-xs font-semibold transition-colors cursor-pointer ${
                          hppMethod === m.id
                            ? 'border-primary bg-primary-soft text-primary'
                            : 'border-line bg-card text-heading hover:bg-muted'
                        }`}
                      >
                        {m.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>Tarif PPN (%)</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['0', '11', '12'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setTaxRate(val)}
                          className={`h-9 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                            taxRate === val
                              ? 'border-primary bg-primary text-white'
                              : 'border-line bg-card text-heading hover:bg-muted'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>Diskon Member %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={memberDiscount}
                        onChange={(e) => setMemberDiscount(e.target.value)}
                        className={`${INPUT_CLASS} font-mono tnum`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>Diskon VIP %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={vipDiscount}
                        onChange={(e) => setVipDiscount(e.target.value)}
                        className={`${INPUT_CLASS} font-mono tnum`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-line flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet size={16} className="text-success shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-heading truncate">
                      {importedRowCount !== null ? `${importedRowCount} produk dimuat` : 'Import produk Excel (.xlsx)'}
                    </p>
                    {importedFileName && <p className="text-[11px] text-dim truncate">{importedFileName}</p>}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handlePickExcel} disabled={loading}>
                  <Upload size={13} />
                  {importedRowCount !== null ? 'Ganti' : 'Pilih File'}
                </Button>
              </div>

              <div className="flex justify-between pt-3 border-t border-line">
                <Button type="button" variant="outline" size="md" onClick={() => setStep(3)}>
                  Kembali
                </Button>
                <Button type="button" variant="primary" size="md" onClick={() => setStep(5)}>
                  Lanjut
                </Button>
              </div>
            </div>
          )}

          {/* NEW - STEP 5: Summary */}
          {mode === 'new' && step === 5 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-success-soft text-success flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-heading">Siap Digunakan</h2>
                  <p className="text-xs text-dim">Periksa ringkasan lalu mulai.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-lg bg-muted/50 border border-line">
                  <span className="text-dim">Toko</span>
                  <p className="font-semibold text-heading mt-0.5 truncate">{companyName} · {branchName}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-line">
                  <span className="text-dim">Pemilik</span>
                  <p className="font-semibold text-heading mt-0.5 truncate">{ownerName} (@{ownerUsername})</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-line">
                  <span className="text-dim">Mode</span>
                  <p className="font-semibold text-heading mt-0.5 truncate">
                    {createdWorkspace ? createdWorkspace.code : enableCloud ? workspaceCode : 'Lokal'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-line">
                  <span className="text-dim">PPN / Katalog</span>
                  <p className="font-semibold text-heading mt-0.5 truncate">
                    {taxRate}% · {importedRowCount !== null ? `${importedRowCount} item` : 'Kosong'}
                  </p>
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t border-line">
                <Button type="button" variant="outline" size="md" onClick={() => setStep(4)} disabled={loading}>
                  Kembali
                </Button>
                <Button type="button" variant="primary" size="md" onClick={handleNewFinish} loading={loading}>
                  Mulai Kivo
                </Button>
              </div>
            </div>
          )}

          {/* JOIN - STEP 1 */}
          {mode === 'join' && step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-heading">Gabung Workspace</h2>
                <p className="text-xs text-dim mt-0.5">Masukkan kode workspace dari toko utama.</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Kode Workspace *</label>
                  <div className="relative flex items-center">
                    <KeyRound size={15} className="absolute left-3 text-dim pointer-events-none" />
                    <input
                      type="text"
                      value={joinCodeOrToken}
                      onChange={(e) => setJoinCodeOrToken(e.target.value.trim())}
                      placeholder="KV-TOKO-01"
                      className={`${ICON_INPUT_CLASS} font-mono`}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Password Workspace (opsional)</label>
                  <div className="relative flex items-center">
                    <Lock size={15} className="absolute left-3 text-dim pointer-events-none" />
                    <input
                      type="password"
                      value={joinPassword}
                      onChange={(e) => setJoinPassword(e.target.value)}
                      placeholder="Opsional"
                      className={ICON_INPUT_CLASS}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t border-line">
                <Button type="button" variant="outline" size="md" onClick={() => setStep(0)}>
                  Kembali
                </Button>
                <Button type="button" variant="primary" size="md" onClick={handleJoinStep1Next} loading={loading}>
                  Hubungkan
                </Button>
              </div>
            </div>
          )}

          {/* JOIN - STEP 2 */}
          {mode === 'join' && step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-heading">Akun Perangkat</h2>
                <p className="text-xs text-dim mt-0.5">
                  Terhubung ke {createdWorkspace?.name} ({createdWorkspace?.code})
                </p>
              </div>

              <div className="flex rounded-lg bg-muted p-1 border border-line">
                <button
                  type="button"
                  onClick={() => setJoinTab('existing')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    joinTab === 'existing' ? 'bg-card text-heading border border-line' : 'text-dim hover:text-heading border border-transparent'
                  }`}
                >
                  Akun yang Ada
                </button>
                <button
                  type="button"
                  onClick={() => setJoinTab('new_cashier')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    joinTab === 'new_cashier' ? 'bg-card text-heading border border-line' : 'text-dim hover:text-heading border border-transparent'
                  }`}
                >
                  Buat Kasir Baru
                </button>
              </div>

              {joinTab === 'existing' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Username *</label>
                    <input
                      type="text"
                      value={joinUsername}
                      onChange={(e) => setJoinUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                      placeholder="Username"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Password *</label>
                    <input
                      type="password"
                      value={joinUserPassword}
                      onChange={(e) => setJoinUserPassword(e.target.value)}
                      placeholder="Password"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Nama Kasir *</label>
                    <input
                      type="text"
                      value={joinCashierName}
                      onChange={(e) => setJoinCashierName(e.target.value)}
                      placeholder="Kasir 1"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>Username *</label>
                      <input
                        type="text"
                        value={joinUsername}
                        onChange={(e) => setJoinUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                        placeholder="kasir1"
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={LABEL_CLASS}>Password *</label>
                      <input
                        type="password"
                        value={joinUserPassword}
                        onChange={(e) => setJoinUserPassword(e.target.value)}
                        placeholder="Min. 6 karakter"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Konfirmasi Password *</label>
                    <input
                      type="password"
                      value={joinConfirmPassword}
                      onChange={(e) => setJoinConfirmPassword(e.target.value)}
                      placeholder="Ulangi password"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-3 border-t border-line">
                <Button type="button" variant="outline" size="md" onClick={() => setStep(1)}>
                  Kembali
                </Button>
                <Button type="button" variant="primary" size="md" onClick={handleJoinStep2Next} loading={loading}>
                  Lanjut
                </Button>
              </div>
            </div>
          )}

          {/* JOIN - STEP 3 */}
          {mode === 'join' && step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-success-soft text-success flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-heading">Perangkat Terhubung</h2>
                  <p className="text-xs text-dim">
                    {createdWorkspace?.name} ({createdWorkspace?.code}) · @{joinUsername}
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-line">
                <Button type="button" variant="primary" size="md" onClick={handleJoinFinish} loading={loading}>
                  Buka Kasir
                </Button>
              </div>
            </div>
          )}

          {/* RESTORE - STEP 1 */}
          {mode === 'restore' && step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-heading">Pulihkan dari Cloud</h2>
                <p className="text-xs text-dim mt-0.5">Masukkan kode workspace dan akun pemilik.</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Kode Workspace *</label>
                  <input
                    type="text"
                    value={restoreCode}
                    onChange={(e) => setRestoreCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    placeholder="KV-TOKO-01"
                    className={`${INPUT_CLASS} font-mono`}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Username Pemilik *</label>
                    <input
                      type="text"
                      value={restoreUsername}
                      onChange={(e) => setRestoreUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                      placeholder="owner"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL_CLASS}>Password *</label>
                    <input
                      type="password"
                      value={restorePassword}
                      onChange={(e) => setRestorePassword(e.target.value)}
                      placeholder="Password"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLASS}>Password Workspace (opsional)</label>
                  <input
                    type="password"
                    value={restoreWsPassword}
                    onChange={(e) => setRestoreWsPassword(e.target.value)}
                    placeholder="Opsional"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t border-line">
                <Button type="button" variant="outline" size="md" onClick={() => setStep(0)}>
                  Kembali
                </Button>
                <Button type="button" variant="primary" size="md" onClick={handleRestoreStep1Next} loading={loading}>
                  Cari Workspace
                </Button>
              </div>
            </div>
          )}

          {/* RESTORE - STEP 2 */}
          {mode === 'restore' && step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-heading">Workspace Ditemukan</h2>
                <p className="text-xs text-dim mt-0.5">Unduh data ke penyimpanan lokal perangkat ini.</p>
              </div>

              <div className="p-3.5 rounded-lg bg-muted/50 border border-line space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-dim">Toko</span>
                  <span className="font-semibold text-heading">{createdWorkspace?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Kode</span>
                  <span className="font-mono font-semibold text-primary">{createdWorkspace?.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Pemilik</span>
                  <span className="font-semibold text-heading">@{restoreUsername}</span>
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t border-line">
                <Button type="button" variant="outline" size="md" onClick={() => setStep(1)} disabled={loading}>
                  Batal
                </Button>
                <Button type="button" variant="primary" size="md" onClick={handleRestoreDownload} loading={loading}>
                  <Download size={14} />
                  Unduh &amp; Pulihkan
                </Button>
              </div>
            </div>
          )}

          {/* RESTORE - STEP 3 */}
          {mode === 'restore' && step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-success-soft text-success flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-heading">Pemulihan Selesai</h2>
                  <p className="text-xs text-dim">Data toko siap digunakan di perangkat ini.</p>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-line">
                <Button type="button" variant="primary" size="md" onClick={onComplete}>
                  Buka Kivo
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
