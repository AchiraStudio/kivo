import { useState } from 'react';
import { Save, ArrowUpRight, ArrowDownRight, Sliders } from 'lucide-react';
import { StockOverviewRow, adjustStock } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';

interface StockAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: StockOverviewRow | null;
  branchId: string;
  onSuccess: () => void;
}

export default function StockAdjustModal({ isOpen, onClose, item, branchId, onSuccess }: StockAdjustModalProps) {
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [qty, setQty] = useState<number | ''>('');
  const [reason, setReason] = useState('Correction');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !item) return null;

  const handleSubmit = async () => {
    if (qty === '' || !item.unit_id) return;
    setIsSubmitting(true);
    try {
      const fullNote = `${reason} - ${notes}`;
      await adjustStock(item.item_id, item.unit_id, branchId, Number(qty), direction, fullNote, 'Admin');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(`Gagal menyesuaikan stok: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const newTotal = direction === 'in' ? item.current_qty + Number(qty || 0) : item.current_qty - Number(qty || 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Sesuaikan Stok"
      subtitle={`${item.item_name} (Stok: ${item.current_qty} ${item.unit_name || ''})`}
      icon={Sliders}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={qty === ''}
          >
            {!isSubmitting && <Save size={15} />}
            Simpan
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-lg border border-line">
          <button
            type="button"
            onClick={() => setDirection('in')}
            className={`h-8 text-xs font-semibold flex items-center justify-center gap-1.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              direction === 'in'
                ? 'bg-card text-success border border-line'
                : 'text-dim hover:text-heading border border-transparent'
            }`}
          >
            <ArrowUpRight size={14} /> Stok Masuk
          </button>
          <button
            type="button"
            onClick={() => setDirection('out')}
            className={`h-8 text-xs font-semibold flex items-center justify-center gap-1.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              direction === 'out'
                ? 'bg-card text-danger border border-line'
                : 'text-dim hover:text-heading border border-transparent'
            }`}
          >
            <ArrowDownRight size={14} /> Stok Keluar
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-heading mb-1.5">
            Jumlah ({item.unit_name || 'Satuan'})
          </label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full h-9 bg-input border border-line rounded-lg px-3 font-mono text-sm text-heading tnum outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-heading mb-1.5">
            Alasan
          </label>
          <Select value={reason} onChange={(v) => setReason(v)} className="w-full">
            <option value="Correction">Koreksi Stok / Selisih Hitung</option>
            <option value="Damaged / Expired">Barang Rusak / Kadaluarsa</option>
            <option value="Return to Supplier">Retur ke Pemasok</option>
            <option value="Found in Count">Ditemukan Saat Stock Opname</option>
            <option value="Other">Lainnya</option>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-heading mb-1.5">
            Catatan (Opsional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
            placeholder="Keterangan singkat..."
          />
        </div>

        <div className="px-3.5 py-2.5 bg-muted border border-line rounded-lg flex items-center justify-between text-xs">
          <span className="text-dim font-medium">Estimasi Saldo Akhir</span>
          <span className={`font-mono font-bold text-sm tnum ${newTotal < 0 ? 'text-danger' : 'text-heading'}`}>
            {newTotal} {item.unit_name}
          </span>
        </div>
      </div>
    </Modal>
  );
}
