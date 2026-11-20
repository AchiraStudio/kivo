import { useState, useEffect } from 'react';
import {
  Sliders, Loader2, Check, Search, CheckSquare, Square, AlertCircle, X
} from 'lucide-react';
import {
  getPermissionDefinitions,
  getRoleDefaultPermissions,
  updateRoleDefaultPermissions,
  PermissionDef,
  RolePermissionItem
} from '../../lib/api';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import PermissionCategoryList from './PermissionCategoryList';

interface RoleDefaultsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const EDITABLE_ROLES = [
  { value: 'staff', label: 'Staff', desc: 'Kasir dan operasional harian' },
  { value: 'admin', label: 'Admin', desc: 'Supervisi cabang dan operasional' },
];

export default function RoleDefaultsModal({ onClose, onSuccess }: RoleDefaultsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [definitions, setDefinitions] = useState<PermissionDef[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<Record<string, Set<string>>>({});
  const [activeRole, setActiveRole] = useState<'staff' | 'admin'>('staff');

  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const [defs, defaultsList] = await Promise.all([
          getPermissionDefinitions(),
          getRoleDefaultPermissions(),
        ]);
        setDefinitions(defs);

        const map: Record<string, Set<string>> = { staff: new Set(), admin: new Set() };
        defaultsList.forEach((item: RolePermissionItem) => {
          const r = item.role.toLowerCase();
          if (map[r]) map[r] = new Set(item.permissions);
        });

        setRoleDefaults(map);
      } catch (err: any) {
        console.error('Failed to load role defaults:', err);
        setErrorMsg(err?.toString() || 'Gagal memuat aturan hak akses peran.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const currentPerms = roleDefaults[activeRole] || new Set<string>();

  const handleToggle = (key: string) => {
    const next = new Set(currentPerms);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setRoleDefaults(prev => ({ ...prev, [activeRole]: next }));
  };

  const handleToggleCategory = (categoryName: string, enable: boolean) => {
    const next = new Set(currentPerms);
    const catItems = definitions.filter(d => d.category === categoryName);
    catItems.forEach(d => {
      if (enable) next.add(d.key);
      else next.delete(d.key);
    });
    setRoleDefaults(prev => ({ ...prev, [activeRole]: next }));
  };

  const handleSelectAll = () => {
    setRoleDefaults(prev => ({
      ...prev,
      [activeRole]: new Set(definitions.map(d => d.key))
    }));
  };

  const handleDeselectAll = () => {
    setRoleDefaults(prev => ({
      ...prev,
      [activeRole]: new Set()
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      await updateRoleDefaultPermissions(activeRole, Array.from(currentPerms));
      setSuccessMsg(`Hak akses peran "${activeRole}" tersimpan.`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Failed to save role defaults:', err);
      setErrorMsg(err?.toString() || 'Gagal menyimpan aturan hak akses peran.');
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="3xl"
      title="Hak Akses Baku Peran"
      subtitle="Izin bawaan untuk pengguna dengan peran standar"
      icon={Sliders}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="text-xs text-dim tnum">
            {successMsg ? (
              <span className="text-success font-semibold flex items-center gap-1.5">
                <Check size={14} /> {successMsg}
              </span>
            ) : (
              <span>
                Peran <strong className="text-heading capitalize">{activeRole}</strong>: <strong className="text-heading">{currentPerms.size}</strong> izin aktif
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
              disabled={loading}
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
          <p className="text-xs font-medium">Memuat hak akses peran...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Role Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1 bg-muted rounded-lg border border-line">
            {EDITABLE_ROLES.map((role) => {
              const isSelected = activeRole === role.value;
              const count = (roleDefaults[role.value] || new Set()).size;

              return (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => setActiveRole(role.value as 'staff' | 'admin')}
                  className={`p-3 rounded-md text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected
                      ? 'bg-card border border-line text-heading'
                      : 'border border-transparent text-dim hover:text-heading'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-bold text-sm">{role.label}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md tnum ${
                      isSelected
                        ? 'bg-primary-soft text-primary'
                        : 'bg-card/70 text-dim'
                    }`}>
                      {count} izin
                    </span>
                  </div>
                  <p className="text-xs text-dim truncate">
                    {role.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Search & Bulk Selection Toolbar */}
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

            <div className="flex items-center gap-2 shrink-0">
              <Button type="button" variant="secondary" size="sm" onClick={handleSelectAll}>
                <CheckSquare size={13} /> Pilih Semua
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleDeselectAll}>
                <Square size={13} /> Matikan Semua
              </Button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-danger-soft border border-danger/30 rounded-lg text-xs text-danger flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <PermissionCategoryList
            definitions={definitions}
            selectedPerms={currentPerms}
            searchQuery={searchQuery}
            onTogglePerm={handleToggle}
            onToggleCategory={handleToggleCategory}
          />
        </div>
      )}
    </Modal>
  );
}
