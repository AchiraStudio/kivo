import { useState, useEffect } from 'react';
import { Save, BookOpen } from 'lucide-react';
import { CreateAccountInput, getAccounts, createAccount, updateAccount, Account } from '../../lib/api';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
import Select from '../../components/ui/Select';

interface AccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editAccountId: string | null;
}

export default function AccountDrawer({ isOpen, onClose, onSaved, editAccountId }: AccountDrawerProps) {
  const [formData, setFormData] = useState<CreateAccountInput>({
    code: '',
    name: '',
    type: 'asset',
    normal_balance: 'debit',
  });
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isSystem, setIsSystem] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
      if (editAccountId) {
        loadAccount();
      } else {
        setFormData({
          code: '',
          name: '',
          type: 'asset',
          normal_balance: 'debit',
        });
        setIsSystem(false);
      }
    }
  }, [isOpen, editAccountId]);

  const loadAccounts = async () => {
    try {
      const data = await getAccounts();
      setAccounts(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadAccount = async () => {
    try {
      const data = await getAccounts();
      const account = data.find((a) => a.id === editAccountId);
      if (account) {
        setFormData({
          code: account.code,
          name: account.name,
          type: account.type,
          parent_id: account.parent_id,
          normal_balance: account.normal_balance,
        });
        setIsSystem(account.is_system === 1);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleTypeChange = (newType: string) => {
    const normalBalance = newType === 'asset' || newType === 'expense' ? 'debit' : 'credit';
    setFormData({ ...formData, type: newType, normal_balance: normalBalance });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editAccountId) {
        await updateAccount(editAccountId, formData);
      } else {
        await createAccount(formData);
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan akun: ' + error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={editAccountId ? 'Edit Akun' : 'Tambah Akun'}
      icon={BookOpen}
      footer={
        <>
          <Button type="button" variant="outline" size="md" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button type="submit" form="accountForm" variant="primary" size="md" loading={loading}>
            <Save size={15} strokeWidth={1.75} />
            Simpan Akun
          </Button>
        </>
      }
    >
      <form id="accountForm" onSubmit={handleSubmit} className="space-y-4">
        {isSystem && (
          <div className="p-3 bg-warning-soft border border-warning/30 text-warning rounded-lg text-xs">
            Akun sistem bawaan. Tipe dan saldo normal tidak dapat diubah.
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-body mb-1.5">Kode Akun *</label>
          <input
            required
            type="text"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm font-mono text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Contoh: 1-1001"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-body mb-1.5">Nama Akun *</label>
          <input
            required
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Contoh: Kas di Bank BCA"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-body mb-1.5">Tipe Akun</label>
          <Select
            value={formData.type}
            onChange={handleTypeChange}
            disabled={isSystem}
            ariaLabel="Tipe akun"
            className="w-full"
          >
            <option value="asset">Aset</option>
            <option value="liability">Kewajiban</option>
            <option value="equity">Ekuitas</option>
            <option value="income">Pendapatan</option>
            <option value="expense">Beban</option>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-body mb-1.5">Saldo Normal</label>
          <Select
            value={formData.normal_balance}
            onChange={(v) => setFormData({ ...formData, normal_balance: v })}
            disabled={isSystem}
            ariaLabel="Saldo normal"
            className="w-full"
          >
            <option value="debit">Debit</option>
            <option value="credit">Kredit</option>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-body mb-1.5">Induk Akun (Opsional)</label>
          <Select
            value={formData.parent_id || ''}
            onChange={(v) => setFormData({ ...formData, parent_id: v || undefined })}
            ariaLabel="Induk akun"
            className="w-full"
          >
            <option value="">Tingkat Utama (Root)</option>
            {accounts
              .filter((a) => a.id !== editAccountId)
              .map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.code} - {cat.name}
                </option>
              ))}
          </Select>
        </div>
      </form>
    </Drawer>
  );
}
