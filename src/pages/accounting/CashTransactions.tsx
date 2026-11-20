import { useState, useEffect } from 'react';
import { cashIn, cashOut, getAccounts, Account } from '../../lib/api';
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react';
import { toast } from '../../components/ui/Toast';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';

export default function CashTransactions() {
  const [type, setType] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [cashAccountId, setCashAccountId] = useState('');
  const [contraAccountId, setContraAccountId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAccounts();
      setAccounts(res.filter((a) => a.is_active === 1));
    } catch (e) {
      console.error(e);
      setError('Gagal memuat daftar akun.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashAccountId || !contraAccountId || !amount || parseFloat(amount) <= 0) {
      toast.info('Harap lengkapi semua kolom dengan benar.');
      return;
    }

    setSubmitting(true);
    try {
      if (type === 'in') {
        await cashIn(contraAccountId, cashAccountId, parseFloat(amount), desc, 'branch_001');
      } else {
        await cashOut(contraAccountId, cashAccountId, parseFloat(amount), desc, 'branch_001');
      }
      toast.success('Transaksi kas berhasil dicatat.');
      setAmount('');
      setDesc('');
    } catch (e: any) {
      toast.error('Gagal mencatat transaksi: ' + e.toString());
    } finally {
      setSubmitting(false);
    }
  };

  const cashAccounts = accounts.filter(
    (a) => (a.type === 'asset' && a.name.toLowerCase().includes('kas')) || a.name.toLowerCase().includes('bank')
  );
  const contraAccounts =
    type === 'in'
      ? accounts.filter((a) => a.type === 'income' || a.type === 'equity' || a.type === 'liability')
      : accounts.filter((a) => a.type === 'expense' || a.type === 'liability' || a.type === 'asset');

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-line p-12 max-w-2xl text-center text-dim">
        <Loader2 className="animate-spin text-primary mx-auto mb-2" size={24} />
        <span className="text-xs">Memuat akun kas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl border border-line p-10 max-w-2xl text-center">
        <p className="text-sm text-danger font-medium">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={loadAccounts} className="mt-3">
          Coba Lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-line p-5 sm:p-6 max-w-2xl animate-fade-in">
      <h2 className="text-base font-bold text-heading mb-4">Pencatatan Kas & Bank</h2>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          type="button"
          onClick={() => setType('in')}
          className={`p-3.5 rounded-lg border transition-colors flex items-center justify-center gap-2.5 cursor-pointer ${
            type === 'in'
              ? 'border-success bg-success-soft text-success'
              : 'border-line bg-card text-dim hover:text-heading hover:bg-muted'
          }`}
        >
          <ArrowDownCircle size={18} strokeWidth={1.75} />
          <span className="text-sm font-semibold">Kas Masuk</span>
        </button>

        <button
          type="button"
          onClick={() => setType('out')}
          className={`p-3.5 rounded-lg border transition-colors flex items-center justify-center gap-2.5 cursor-pointer ${
            type === 'out'
              ? 'border-danger bg-danger-soft text-danger'
              : 'border-line bg-card text-dim hover:text-heading hover:bg-muted'
          }`}
        >
          <ArrowUpCircle size={18} strokeWidth={1.75} />
          <span className="text-sm font-semibold">Kas Keluar</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-body mb-1.5">Akun Kas / Bank</label>
          <Select
            value={cashAccountId}
            onChange={setCashAccountId}
            placeholder="Pilih akun kas/bank..."
            ariaLabel="Akun kas atau bank"
            className="w-full"
          >
            <option value="">Pilih akun...</option>
            {cashAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-body mb-1.5">
            {type === 'in' ? 'Sumber Dana' : 'Tujuan Pengeluaran'}
          </label>
          <Select
            value={contraAccountId}
            onChange={setContraAccountId}
            placeholder="Pilih akun lawan..."
            ariaLabel="Akun lawan"
            className="w-full"
          >
            <option value="">Pilih akun...</option>
            {contraAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-body mb-1.5">Nominal (Rp)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="0"
            className="w-full h-10 bg-input border border-line rounded-lg px-3 text-base font-semibold text-heading tnum focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-body mb-1.5">Keterangan</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            required
            placeholder="Deskripsi singkat transaksi..."
            rows={3}
            className="w-full bg-input border border-line rounded-lg px-3 py-2 text-sm text-heading resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="pt-1">
          <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
            Simpan Transaksi
          </Button>
        </div>
      </form>
    </div>
  );
}
