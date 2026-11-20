import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { createManualJournal, getAccounts, Account } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Button from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
import Select from '../../components/ui/Select';

interface ManualJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ManualJournalModal({ isOpen, onClose, onSaved }: ManualJournalModalProps) {
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<{ account_id: string; debit: number; credit: number; notes: string }[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
      setDescription('');
      setShowConfirm(false);
      setLines([
        { account_id: '', debit: 0, credit: 0, notes: '' },
        { account_id: '', debit: 0, credit: 0, notes: '' },
      ]);
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    try {
      const data = await getAccounts();
      setAccounts(data.filter((a) => a.is_system === 0 && a.is_active === 1));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddLine = () => {
    setLines([...lines, { account_id: '', debit: 0, credit: 0, notes: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: string | number) => {
    const newLines = [...lines];
    (newLines[index] as any)[field] = value;

    if (field === 'debit' && Number(value) > 0) newLines[index].credit = 0;
    if (field === 'credit' && Number(value) > 0) newLines[index].debit = 0;

    setLines(newLines);
  };

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validLines = lines.filter((l) => l.account_id !== '' && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) {
      toast.info('Harap isi minimal dua baris jurnal yang valid.');
      return;
    }

    if (!isBalanced) {
      toast.info('Total debit dan kredit harus seimbang.');
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmPost = async () => {
    const validLines = lines.filter((l) => l.account_id !== '' && (l.debit > 0 || l.credit > 0));
    setLoading(true);
    try {
      await createManualJournal({
        description: description || undefined,
        lines: validLines.map((l) => ({ ...l, notes: l.notes || undefined })),
      });
      setShowConfirm(false);
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Gagal memposting jurnal: ' + error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="4xl"
        title="Jurnal Manual"
        icon={FileSpreadsheet}
        footer={
          <>
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Batal
            </Button>
            <Button
              type="submit"
              form="journalForm"
              variant="primary"
              size="sm"
              loading={loading}
              disabled={!isBalanced}
            >
              <Save size={14} strokeWidth={1.75} />
              Posting Jurnal
            </Button>
          </>
        }
      >
        <form id="journalForm" onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-body mb-1.5">Keterangan</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Penyesuaian saldo kas atau beban listrik"
              className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="border border-line rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/60 border-b border-line text-xs font-semibold text-dim">
                  <tr>
                    <th className="px-3 py-2.5">Akun</th>
                    <th className="px-3 py-2.5">Catatan Baris</th>
                    <th className="px-3 py-2.5 w-36 text-right">Debit (Rp)</th>
                    <th className="px-3 py-2.5 w-36 text-right">Kredit (Rp)</th>
                    <th className="px-3 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lines.map((line, idx) => (
                    <tr key={idx} className="bg-card">
                      <td className="px-3 py-2 min-w-52">
                        <Select
                          size="sm"
                          value={line.account_id}
                          onChange={(v) => updateLine(idx, 'account_id', v)}
                          placeholder="Pilih akun..."
                          ariaLabel={`Akun baris ${idx + 1}`}
                          className="w-full"
                        >
                          <option value="">Pilih akun...</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2 min-w-40">
                        <input
                          type="text"
                          value={line.notes}
                          onChange={(e) => updateLine(idx, 'notes', e.target.value)}
                          placeholder="Catatan..."
                          className="w-full h-8 bg-input border border-line rounded-lg px-2.5 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          value={line.debit || ''}
                          onChange={(e) => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          aria-label={`Debit baris ${idx + 1}`}
                          className="w-full h-8 bg-input border border-line rounded-lg px-2.5 text-xs text-right font-semibold text-heading tnum focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          value={line.credit || ''}
                          onChange={(e) => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          aria-label={`Kredit baris ${idx + 1}`}
                          className="w-full h-8 bg-input border border-line rounded-lg px-2.5 text-xs text-right font-semibold text-heading tnum focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={lines.length <= 2}
                          aria-label={`Hapus baris ${idx + 1}`}
                          className="p-1.5 text-dim hover:text-danger rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2.5 bg-muted/40 border-t border-line">
              <Button type="button" variant="ghost" size="sm" onClick={handleAddLine}>
                <Plus size={14} strokeWidth={1.75} />
                Tambah Baris
              </Button>
            </div>
          </div>

          <div
            className={`px-4 py-3 rounded-xl border flex flex-wrap justify-between items-center gap-3 ${
              isBalanced
                ? 'bg-success-soft border-success/30 text-success'
                : 'bg-danger-soft border-danger/30 text-danger'
            }`}
          >
            <div className="text-xs font-semibold flex items-center gap-1.5">
              {isBalanced ? (
                <>
                  <CheckCircle2 size={15} strokeWidth={1.75} className="shrink-0" />
                  <span>Seimbang</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={15} strokeWidth={1.75} className="shrink-0" />
                  <span>Tidak Seimbang</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-6 text-right text-xs font-bold tnum">
              <div>
                <span className="font-medium opacity-80 mr-1.5">Debit</span>
                Rp {totalDebit.toLocaleString('id-ID')}
              </div>
              <div>
                <span className="font-medium opacity-80 mr-1.5">Kredit</span>
                Rp {totalCredit.toLocaleString('id-ID')}
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {showConfirm && (
        <ConfirmModal
          title="Posting Jurnal Manual?"
          message={`Posting entri jurnal dengan total Debit/Kredit Rp ${totalDebit.toLocaleString('id-ID')} ke buku besar?`}
          confirmLabel="Ya, Posting"
          variant="primary"
          loading={loading}
          onConfirm={handleConfirmPost}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
