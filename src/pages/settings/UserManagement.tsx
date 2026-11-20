import { useState, useEffect } from 'react';
import { Loader2, User, Plus, Eye, EyeOff, Power, Save, Pencil, Shield, Sliders, Search, Building2, X, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/AuthStore';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { sysadminGetWorkspaces, getAvailableWorkspaces, WorkspaceListInfo, assignUserWorkspace, UserRowFull, invoke } from '../../lib/api';
import UserPermissionsModal from './UserPermissionsModal';
import RoleDefaultsModal from './RoleDefaultsModal';

const ROLES = [
  { value: 'staff', label: 'Staff', desc: 'POS, inventaris, gudang, dan pelanggan' },
  { value: 'admin', label: 'Admin', desc: 'Akses penuh kecuali pengaturan sistem' },
  { value: 'owner', label: 'Owner', desc: 'Akses penuh termasuk pengaturan sistem' },
];

function getRoleColor(role: string) {
  switch (role.toLowerCase()) {
    case 'owner': return 'bg-primary-soft text-primary';
    case 'admin': return 'bg-info-soft text-info';
    case 'staff': return 'bg-success-soft text-success';
    case 'kasir': return 'bg-success-soft text-success';
    case 'gudang': return 'bg-warning-soft text-warning';
    default: return 'bg-muted text-body';
  }
}

export default function UserManagement() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserRowFull[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceListInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUserModal, setEditUserModal] = useState<UserRowFull | null>(null);
  const [permModalUserId, setPermModalUserId] = useState<string | null>(null);
  const [showRoleDefaultsModal, setShowRoleDefaultsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWsFilter, setSelectedWsFilter] = useState('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'primary' | 'logout';
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [data, wsList] = await Promise.all([
        invoke<UserRowFull[]>('get_users'),
        getAvailableWorkspaces().catch(() => sysadminGetWorkspaces().catch(() => [] as WorkspaceListInfo[])),
      ]);

      const validWsList: WorkspaceListInfo[] = [...(wsList || [])];
      const validWsIds = new Set(validWsList.map(w => w.id));

      // Sanitize users: users referencing a deleted workspace become unassigned
      const sanitizedUsers = (data || []).map(u => {
        if (u.workspace_id && !validWsIds.has(u.workspace_id)) {
          return { ...u, workspace_id: undefined };
        }
        return u;
      });

      setUsers(sanitizedUsers);
      setWorkspaces(validWsList);
    } catch (e: any) {
      console.error(e);
      setLoadError(e?.message || String(e) || 'Gagal memuat daftar pengguna.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = fetchData;

  const handleToggleActive = async (u: UserRowFull) => {
    if (u.id === currentUser?.id) {
      setConfirmModal({
        title: 'Tidak Dapat Menonaktifkan',
        message: 'Akun yang sedang digunakan tidak bisa dinonaktifkan.',
        variant: 'warning',
        confirmLabel: 'OK',
        onConfirm: () => setConfirmModal(null),
      });
      return;
    }
    setConfirmModal({
      title: `${u.is_active ? 'Nonaktifkan' : 'Aktifkan'} Akun?`,
      message: u.is_active
        ? `Akun "${u.name}" tidak akan bisa login setelah dinonaktifkan.`
        : `Aktifkan kembali akun "${u.name}" agar dapat login.`,
      variant: u.is_active ? 'danger' : 'primary',
      confirmLabel: u.is_active ? 'Nonaktifkan' : 'Aktifkan',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await invoke('toggle_user_active', { id: u.id });
          fetchUsers();
        } catch (e: any) {
          setConfirmModal({
            title: 'Gagal',
            message: e.toString(),
            variant: 'warning',
            confirmLabel: 'OK',
            onConfirm: () => setConfirmModal(null),
          });
        }
      },
    });
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery.trim() ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedWsFilter === 'all') return true;
    if (selectedWsFilter === 'unassigned') return !u.workspace_id;
    return u.workspace_id === selectedWsFilter;
  });

  const unassignedCount = users.filter(u => !u.workspace_id).length;

  return (
    <div className="flex flex-col flex-1 h-full gap-4 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-heading">Daftar Pengguna</h2>
          <span className="px-2 py-0.5 rounded-md bg-muted text-dim text-xs font-semibold tnum">
            {users.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => setShowRoleDefaultsModal(true)}
          >
            <Sliders size={14} /> Default Peran
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setShowModal(true)}
          >
            <Plus size={15} /> Tambah Staff
          </Button>
        </div>
      </div>

      {/* Search & Workspace Filter Bar */}
      <div className="bg-card p-3.5 rounded-xl border border-line flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            placeholder="Cari nama atau username..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-8 text-sm bg-input border border-line rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 text-heading placeholder:text-dim transition-colors"
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

        {/* Workspace Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 md:pb-0 custom-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedWsFilter('all')}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              selectedWsFilter === 'all'
                ? 'bg-primary-soft text-primary border-primary/30'
                : 'bg-muted border-line text-body hover:text-heading hover:bg-muted-hover'
            }`}
          >
            <span>Semua</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] tnum ${selectedWsFilter === 'all' ? 'bg-primary/15 text-primary' : 'bg-card text-dim'}`}>
              {users.length}
            </span>
          </button>

          {workspaces.map(ws => {
            const count = users.filter(u => u.workspace_id === ws.id).length;
            const isSelected = selectedWsFilter === ws.id;
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => setSelectedWsFilter(ws.id)}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? 'bg-primary-soft text-primary border-primary/30'
                    : 'bg-muted border-line text-body hover:text-heading hover:bg-muted-hover'
                }`}
              >
                <Building2 size={12} className="shrink-0" />
                <span>{ws.name}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] tnum ${isSelected ? 'bg-primary/15 text-primary' : 'bg-card text-dim'}`}>
                  {count}
                </span>
              </button>
            );
          })}

          {unassignedCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedWsFilter('unassigned')}
              className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                selectedWsFilter === 'unassigned'
                  ? 'bg-warning-soft text-warning border-warning/30'
                  : 'bg-muted border-line text-body hover:text-heading hover:bg-muted-hover'
              }`}
            >
              <span>Tanpa Workspace</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] tnum ${selectedWsFilter === 'unassigned' ? 'bg-warning/15 text-warning' : 'bg-card text-dim'}`}>
                {unassignedCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-card rounded-xl border border-line flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="py-16 text-center flex flex-col items-center justify-center gap-2.5 text-dim">
            <Loader2 className="animate-spin text-primary" size={24} />
            <p className="text-xs font-medium">Memuat data pengguna...</p>
          </div>
        ) : loadError ? (
          <div className="py-16 px-4 text-center flex flex-col items-center justify-center gap-2.5">
            <AlertTriangle size={22} className="text-danger" />
            <p className="text-sm font-semibold text-heading">Gagal memuat daftar pengguna</p>
            <p className="text-xs text-dim max-w-sm">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={fetchData} className="mt-1">
              <RefreshCw size={13} /> Coba Lagi
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted/60 border-b border-line text-xs text-dim font-semibold">
                <tr>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Peran</th>
                  <th className="py-3 px-4">Hak Akses</th>
                  <th className="py-3 px-4">Workspace</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Dibuat</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 px-4 text-center">
                      <p className="text-sm font-semibold text-heading">
                        {searchQuery || selectedWsFilter !== 'all'
                          ? 'Tidak ada pengguna yang cocok'
                          : 'Belum ada pengguna'}
                      </p>
                      <p className="text-xs text-dim mt-1">
                        {searchQuery || selectedWsFilter !== 'all'
                          ? 'Ubah filter atau kata kunci pencarian.'
                          : 'Tambahkan akun staff baru untuk mulai mengelola akses.'}
                      </p>
                    </td>
                  </tr>
                ) : filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-muted/35 transition-colors fast-render-row">
                    {/* User Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted border border-line text-heading flex items-center justify-center shrink-0 font-bold text-xs">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-heading text-sm truncate">{u.name}</p>
                          <p className="text-xs text-dim font-mono truncate">@{u.username}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${getRoleColor(u.role)}`}>
                        {u.role}
                      </span>
                    </td>

                    {/* Permissions Status */}
                    <td className="py-3 px-4">
                      {u.role.toLowerCase() === 'owner' ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary-soft text-primary">
                          Penuh
                        </span>
                      ) : u.is_custom_perms ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-warning-soft text-warning inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-warning" /> Kustom
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-body">
                          Default
                        </span>
                      )}
                    </td>

                    {/* Workspace Selector */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 min-w-[160px] max-w-[220px]">
                        <Select
                          size="sm"
                          disabled={updatingUserId === u.id}
                          value={u.workspace_id || ''}
                          className="w-full"
                          onChange={async v => {
                            const wsId = v || null;
                            setUpdatingUserId(u.id);
                            try {
                              await assignUserWorkspace(u.id, wsId);
                              setUsers(prev => prev.map(item => item.id === u.id ? { ...item, workspace_id: wsId || undefined } : item));
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setUpdatingUserId(null);
                            }
                          }}
                        >
                          <option value="">Tidak ada</option>
                          {workspaces.map(ws => (
                            <option key={ws.id} value={ws.id}>{ws.name} ({ws.code})</option>
                          ))}
                        </Select>
                        {updatingUserId === u.id && (
                          <Loader2 size={13} className="animate-spin text-primary shrink-0" />
                        )}
                      </div>
                    </td>

                    {/* Active Status */}
                    <td className="py-3 px-4">
                      {u.is_active ? (
                        <span className="text-success font-semibold text-xs inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-success" /> Aktif
                        </span>
                      ) : (
                        <span className="text-dim font-semibold text-xs inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-dim" /> Nonaktif
                        </span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-4 text-dim text-xs tnum whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString('id-ID')}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPermModalUserId(u.id)}
                          title="Atur Hak Akses"
                        >
                          <Shield size={13} />
                          <span>Akses</span>
                        </Button>

                        <button
                          type="button"
                          onClick={() => setEditUserModal(u)}
                          title="Edit Pengguna"
                          aria-label={`Edit ${u.name}`}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-dim hover:text-heading hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(u)}
                          title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          aria-label={u.is_active ? `Nonaktifkan ${u.name}` : `Aktifkan ${u.name}`}
                          className={`w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            u.is_active
                              ? 'text-dim hover:text-danger hover:bg-danger-soft'
                              : 'text-dim hover:text-success hover:bg-success-soft'
                          }`}
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {showModal && <AddStaffModal workspaces={workspaces} currentWorkspaceId={currentUser?.workspace_id} onClose={() => setShowModal(false)} onSuccess={fetchUsers} />}

      {/* Edit User Modal */}
      {editUserModal && <EditUserModal user={editUserModal} workspaces={workspaces} onClose={() => setEditUserModal(null)} onSuccess={fetchUsers} />}

      {/* User Specific Permissions Modal */}
      {permModalUserId && (
        <UserPermissionsModal
          userId={permModalUserId}
          onClose={() => setPermModalUserId(null)}
          onSuccess={fetchUsers}
        />
      )}

      {/* Role Baseline Permissions Modal */}
      {showRoleDefaultsModal && (
        <RoleDefaultsModal
          onClose={() => setShowRoleDefaultsModal(false)}
          onSuccess={fetchUsers}
        />
      )}

      {/* Confirm Action Modal */}
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

function WorkspaceSelect({ value, onChange, workspaces }: { value: string; onChange: (val: string) => void; workspaces: WorkspaceListInfo[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-heading">Workspace</label>
        {workspaces.length > 0 && (
          <span className="text-[11px] font-medium text-dim tnum">
            {workspaces.length} tersedia
          </span>
        )}
      </div>
      <Select
        value={value}
        onChange={v => onChange(v)}
        className="w-full"
      >
        <option value="">Tidak ditugaskan</option>
        {workspaces.map(ws => (
          <option key={ws.id} value={ws.id}>
            {ws.name} ({ws.code})
          </option>
        ))}
      </Select>
    </div>
  );
}

function AddStaffModal({ workspaces, currentWorkspaceId, onClose, onSuccess }: { workspaces: WorkspaceListInfo[]; currentWorkspaceId?: string | null; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');

  const initialWsId = currentWorkspaceId && workspaces.some(w => w.id === currentWorkspaceId)
    ? currentWorkspaceId
    : (workspaces[0]?.id || '');
  const [workspaceId, setWorkspaceId] = useState<string>(initialWsId);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || !username.trim() || !password.trim()) { setError('Semua field wajib diisi.'); return; }
    if (password.length < 6) { setError('Password minimal 6 karakter.'); return; }
    setLoading(true); setError('');
    try {
      await invoke('create_user', { name: name.trim(), username: username.trim(), password, role, workspaceId: workspaceId || null });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="md"
      title="Tambah Staff"
      icon={User}
      footer={
        <>
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="add-staff-form" variant="primary" size="md" loading={loading}>
            {loading ? 'Menyimpan...' : 'Buat Akun'}
          </Button>
        </>
      }
    >
      <form id="add-staff-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-danger-soft border border-danger/30 text-danger text-xs font-medium px-3.5 py-2.5 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-heading mb-1.5">Nama Lengkap</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)} required
            placeholder="Budi Santoso"
            className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading placeholder:text-dim outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-heading mb-1.5">Username</label>
          <input
            type="text" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} required
            placeholder="budi_kasir"
            className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading placeholder:text-dim outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 font-mono transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-heading mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="Min. 6 karakter"
              className="w-full h-9 bg-input border border-line rounded-lg pl-3 pr-9 text-sm text-heading placeholder:text-dim outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-heading p-0.5 rounded cursor-pointer"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-heading mb-1.5">Peran</label>
          <div className="space-y-2">
            {ROLES.map(r => (
              <label key={r.value} className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${role === r.value ? 'border-primary bg-primary-soft/60' : 'border-line hover:border-line-strong bg-card'}`}>
                <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="mt-0.5 accent-primary" />
                <div>
                  <p className="font-semibold text-xs text-heading">{r.label}</p>
                  <p className="text-xs text-dim mt-0.5">{r.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <WorkspaceSelect
          value={workspaceId}
          onChange={setWorkspaceId}
          workspaces={workspaces}
        />
      </form>
    </Modal>
  );
}

function EditUserModal({ user, workspaces, onClose, onSuccess }: { user: UserRowFull; workspaces: WorkspaceListInfo[]; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState(user.role);
  const [workspaceId, setWorkspaceId] = useState(user.workspace_id || '');
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) { setError('Nama dan Username wajib diisi.'); return; }
    if (newPassword && newPassword.length < 6) { setError('Password minimal 6 karakter.'); return; }

    setLoading(true); setError('');
    try {
      await invoke('update_user', {
        id: user.id,
        name: name.trim(),
        username: username.trim().toLowerCase(),
        role,
        workspaceId: workspaceId || null
      });

      if (newPassword) {
        await invoke('reset_user_password', { id: user.id, newPassword });
      }

      onSuccess();
      onClose();
    } catch (e: any) { setError(e.toString()); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    setLoading(true); setError('');
    try {
      await invoke('delete_user', { id: user.id });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.toString());
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        size="md"
        title="Edit Pengguna"
        icon={Pencil}
        footer={
          <div className="flex items-center justify-between gap-2 w-full">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setConfirmDelete(true)}
              disabled={loading}
              className="text-danger hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 size={14} /> Hapus
            </Button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="md" onClick={onClose}>
                Batal
              </Button>
              <Button type="submit" form="edit-user-form" variant="primary" size="md" loading={loading}>
                {!loading && <Save size={14} />} Simpan
              </Button>
            </div>
          </div>
        }
      >
        <form id="edit-user-form" onSubmit={handleUpdate} className="space-y-4">
          {error && (
            <div className="bg-danger-soft border border-danger/30 text-danger text-xs font-medium px-3.5 py-2.5 rounded-lg flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-heading mb-1.5">Nama Lengkap</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)} required
                className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-heading mb-1.5">Username</label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} required
                className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-heading mb-1.5">Peran</label>
            <Select
              value={role}
              onChange={v => setRole(v)}
              className="w-full"
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </div>

          <WorkspaceSelect
            value={workspaceId}
            onChange={setWorkspaceId}
            workspaces={workspaces}
          />

          <div className="pt-3 border-t border-line">
            <label className="block text-xs font-semibold text-heading mb-1.5">Reset Password (Opsional)</label>
            <input
              type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Kosongkan jika tidak diubah"
              className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading placeholder:text-dim outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors"
            />
          </div>
        </form>
      </Modal>

      {confirmDelete && (
        <ConfirmModal
          title="Hapus Pengguna?"
          message={`Akun "${user.name}" akan dihapus permanen dan tidak bisa login lagi.`}
          variant="danger"
          confirmLabel="Hapus"
          loading={loading}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
