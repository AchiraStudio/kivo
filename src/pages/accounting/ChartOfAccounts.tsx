import { useEffect, useState } from 'react';
import { getAccounts, deleteAccount, Account } from '../../lib/api';
import { Plus, Edit2, Trash2, Lock, Loader2 } from 'lucide-react';
import AccountDrawer from './AccountDrawer';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Button from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';

const TYPE_META: Record<string, { label: string; badge: string }> = {
  asset: { label: 'Aset', badge: 'bg-accent-soft text-accent' },
  liability: { label: 'Kewajiban', badge: 'bg-danger-soft text-danger' },
  equity: { label: 'Ekuitas', badge: 'bg-primary-soft text-primary' },
  income: { label: 'Pendapatan', badge: 'bg-success-soft text-success' },
  expense: { label: 'Beban', badge: 'bg-warning-soft text-warning' },
};

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Account | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAccounts();
      setAccounts(data);
    } catch (e) {
      console.error(e);
      setError('Gagal memuat bagan akun.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleRequestToggle = (acc: Account) => {
    if (acc.is_system === 1) {
      toast.info('Akun sistem bawaan tidak dapat dinonaktifkan atau dihapus.');
      return;
    }
    setConfirmTarget(acc);
  };

  const handleConfirmToggle = async () => {
    if (!confirmTarget) return;
    setToggling(true);
    try {
      await deleteAccount(confirmTarget.id);
      setConfirmTarget(null);
      fetchAccounts();
    } catch (e: any) {
      toast.error(e.toString());
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h2 className="text-base font-bold tracking-tight text-heading">Bagan Akun (COA)</h2>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => {
            setEditAccountId(null);
            setIsDrawerOpen(true);
          }}
        >
          <Plus size={15} strokeWidth={1.75} />
          Tambah Akun
        </Button>
      </div>

      <div className="flex-1 min-h-0 bg-card rounded-xl border border-line overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs text-dim bg-muted/60 border-b border-line font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama Akun</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Saldo Normal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-14 text-dim">
                    <Loader2 className="animate-spin text-primary mx-auto mb-2" size={24} />
                    <span className="text-xs">Memuat bagan akun...</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="text-center py-14">
                    <p className="text-sm text-danger font-medium">{error}</p>
                    <Button type="button" variant="outline" size="sm" onClick={fetchAccounts} className="mt-3">
                      Coba Lagi
                    </Button>
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-14 text-dim text-sm">
                    Belum ada akun terdaftar.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => {
                  const meta = TYPE_META[acc.type] || {
                    label: acc.type,
                    badge: 'bg-muted text-body',
                  };
                  return (
                    <tr
                      key={acc.id}
                      className={`hover:bg-muted/40 transition-colors fast-render-row ${
                        acc.is_active === 0 ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-heading whitespace-nowrap">
                        {acc.code}
                      </td>
                      <td className="px-4 py-3 font-medium text-heading">
                        <div className="flex items-center gap-2">
                          {acc.is_system === 1 && (
                            <Lock size={13} strokeWidth={1.75} className="text-dim shrink-0" />
                          )}
                          <span>{acc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-body text-xs font-medium">
                        {acc.normal_balance === 'debit' ? 'Debit' : 'Kredit'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            acc.is_active ? 'bg-success-soft text-success' : 'bg-muted text-dim'
                          }`}
                        >
                          {acc.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditAccountId(acc.id);
                            setIsDrawerOpen(true);
                          }}
                          aria-label={`Edit ${acc.name}`}
                          title="Edit akun"
                          className="p-1.5 text-dim hover:text-heading hover:bg-muted rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestToggle(acc)}
                          className={`p-1.5 ml-1 rounded-lg transition-colors ${
                            acc.is_system === 1
                              ? 'text-dim/40 cursor-not-allowed'
                              : 'text-dim hover:text-danger hover:bg-danger-soft cursor-pointer'
                          }`}
                          disabled={acc.is_system === 1}
                          aria-label={acc.is_system === 1 ? 'Akun sistem' : `Ubah status ${acc.name}`}
                          title={acc.is_system === 1 ? 'Akun sistem' : 'Ubah status aktif'}
                        >
                          <Trash2 size={15} strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AccountDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSaved={fetchAccounts}
        editAccountId={editAccountId}
      />

      {confirmTarget && (
        <ConfirmModal
          title="Ubah Status Akun?"
          message={`Ubah status aktif untuk akun ${confirmTarget.code} (${confirmTarget.name})?`}
          confirmLabel="Ya, Ubah"
          variant="warning"
          loading={toggling}
          onConfirm={handleConfirmToggle}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  );
}
