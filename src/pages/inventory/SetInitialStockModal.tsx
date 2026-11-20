import { useState } from 'react';
import { Save, PackagePlus } from 'lucide-react';
import { StockOverviewRow, setInitialStock } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';

interface SetInitialStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: StockOverviewRow | null;
  branchId: string;
  onSuccess: () => void;
}

export default function SetInitialStockModal({ isOpen, onClose, item, branchId, onSuccess }: SetInitialStockModalProps) {
  const [qty, setQty] = useState<number | ''>('');
  const [hppValue, setHppValue] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !item) return null;

  const handleSubmit = async () => {
    if (qty === '' || !item.unit_id) return;
    setIsSubmitting(true);
    try {
      await setInitialStock(item.item_id, item.unit_id, branchId, Number(qty), Number(hppValue) || 0, 'Initial System Setup');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(`Gagal menyimpan stok awal: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Atur Stok Awal"
      subtitle={item.item_name}
      icon={PackagePlus}
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
        <p className="text-xs text-dim">
          Hanya dapat diatur sekali saat inisialisasi.
        </p>

        <div>
          <label className="block text-xs font-semibold text-heading mb-1.5">
            Jumlah Stok Awal ({item.unit_name || 'Satuan'})
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
            HPP per {item.unit_name || 'Satuan'} (Rp)
          </label>
          <input
            type="number"
            value={hppValue}
            onChange={(e) => setHppValue(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full h-9 bg-input border border-line rounded-lg px-3 font-mono text-sm text-heading tnum outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
            placeholder="0"
          />
        </div>
      </div>
    </Modal>
  );
}
