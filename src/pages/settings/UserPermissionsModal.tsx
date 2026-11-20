import { useState, useEffect } from 'react';
import { Shield, Loader2, Check, RotateCcw, Search, CheckSquare, Square, AlertCircle, X, ShieldCheck } from 'lucide-react';
import {
  getPermissionDefinitions,
  getUserPermissions,
  updateUserPermissions,
  PermissionDef,
  UserPermissionsPayload
} from '../../lib/api';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import PermissionCategoryList from './PermissionCategoryList';

interface UserPermissionsModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UserPermissionsModal({ userId, onClose, onSuccess }: UserPermissionsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [definitions, setDefinitions] = useState<PermissionDef[]>([]);
  const [userData, setUserData] = useState<UserPermissionsPayload | null>(null);

  const [isCustom, setIsCustom] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const [defs, userPerms] = await Promise.all([
          getPermissionDefinitions(),
          getUserPermissions(userId),
        ]);
        setDefinitions(defs);
        setUserData(userPerms);
        setIsCustom(userPerms.is_custom);

        if (userPerms.role.toLowerCase() === 'owner') {
          setSelectedPerms(new Set(defs.map((d: PermissionDef) => d.key)));
        } else {
          setSelectedPerms(new Set(userPerms.permissions));
        }
      } catch (err: any) {
        console.error('Failed to load permissions:', err);
        setErrorMsg(err?.toString() || 'Gagal memuat hak akses.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [userId]);

  const handleToggle = (key: string) => {
    if (userData?.role.toLowerCase() === 'owner') return;
    if (!isCustom) setIsCustom(true);

    const next = new Set(selectedPerms);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedPerms(next);
  };

  const handleToggleCategory = (categoryName: string, enable: boolean) => {
    if (userData?.role.toLowerCase() === 'owner') return;
    if (!isCustom) setIsCustom(true);

    const next = new Set(selectedPerms);
    const catItems = definitions.filter(d => d.category === categoryName);
    catItems.forEach(d => {
      if (enable) next.add(d.key);
      else next.delete(d.key);
    });
    setSelectedPerms(next);
  };

  const handleSelectAll = () => {
    if (!isCustom) setIsCustom(true);
    setSelectedPerms(new Set(definitions.map(d => d.key)));
  };

  const handleDeselectAll = () => {
    if (!isCustom) setIsCustom(true);
    setSelectedPerms(new Set());
  };

  const handleResetToDefault = () => {
    if (!userData) return;
    setIsCustom(false);
    setSelectedPerms(new Set(userData.role_defaults));
  };

  const handleSave = async () => {
    if (!userData) return;
    setSaving(true);
    setErrorMsg('');
    try {
      await updateUserPermissions(userId, isCustom, Array.from(selectedPerms));
      setSuccessMsg('Hak akses tersimpan.');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Failed to save user permissions:', err);
      setErrorMsg(err?.toString() || 'Gagal menyimpan hak akses.');
      setSaving(false);
    }
  };

  const isOwner = userData?.role.toLowerCase() === 'owner';

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="3xl"
      title="Hak Akses Pengguna"
      subtitle={userData ? `${userData.user_name} (@${userData.username})` : 'Memuat data...'}
      icon={Shield}
      badge={
        userData ? (
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${
            isOwner
              ? 'bg-primary-soft text-primary'
              : userData.role === 'admin'
              ? 'bg-info-soft text-info'
              : 'bg-success-soft text-success'
          }`}>
            {userData.role}
          </span>
        ) : null
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="text-xs text-dim tnum">
            {successMsg ? (
              <span className="text-success font-semibold flex items-center gap-1.5">
                <Check size={14} /> {successMsg}
              </span>
            ) : (
              <span>
                <strong className="text-heading">{selectedPerms.size}</strong> dari <strong className="text-heading">{definitions.length}</strong> izin aktif
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={loading || isOwner}
              loading={saving}
              onClick={handleSave}
            >
              {!saving && <Check size={15} />}
              <span>{saving ? 'Menyimpan...' : 'Simpan'}</span>
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2.5 text-dim">
          <Loader2 className="animate-spin text-primary" size={24} />
          <p className="text-xs font-medium">Memuat hak akses...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Owner Notice or Mode Banner */}
          {isOwner ? (
            <div className="p-3.5 bg-primary-soft border border-primary/25 rounded-lg flex items-center gap-2.5 text-primary">
              <ShieldCheck size={18} className="shrink-0" />
              <p className="text-xs font-medium">
                Peran <strong>Owner</strong> memiliki akses penuh pada semua fitur.
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-muted/50 border border-line rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-heading">Mode:</span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                    isCustom
                      ? 'bg-warning-soft text-warning'
                      : 'bg-info-soft text-info'
                  }`}>
                    {isCustom ? 'Kustom' : `Default ${userData?.role}`}
                  </span>
                </div>
                <p className="text-xs text-dim mt-0.5">
                  {isCustom
                    ? 'Izin disesuaikan khusus untuk pengguna ini.'
                    : 'Mengikuti aturan baku peran.'}
                </p>
              </div>

              {isCustom && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetToDefault}
                >
                  <RotateCcw size={13} /> Reset ke Default
                </Button>
              )}
            </div>
          )}

          {/* Search & Bulk Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari izin akses..."
                className="w-full h-9 pl-9 pr-8 bg-input border border-line rounded-lg text-xs text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-heading p-0.5 rounded cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {!isOwner && (
              <div className="flex items-center gap-2 shrink-0">
                <Button type="button" variant="secondary" size="sm" onClick={handleSelectAll}>
                  <CheckSquare size={13} /> Pilih Semua
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={handleDeselectAll}>
                  <Square size={13} /> Matikan Semua
                </Button>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-danger-soft border border-danger/30 rounded-lg text-xs text-danger flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <PermissionCategoryList
            definitions={definitions}
            selectedPerms={selectedPerms}
            searchQuery={searchQuery}
            onTogglePerm={handleToggle}
            onToggleCategory={handleToggleCategory}
            disabled={isOwner}
          />
        </div>
      )}
    </Modal>
  );
}
