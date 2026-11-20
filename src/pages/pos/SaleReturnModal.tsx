import { useState, useEffect } from 'react';
import { getSaleDetail, createSaleReturn, SaleDetail, SaleReturnLineInput } from '../../lib/api';
import { Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';

interface Props {
  saleId: string;
  onClose: () => void;
}

export default function SaleReturnModal({ saleId, onClose }: Props) {
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getSaleDetail(saleId)
      .then(res => {
        setDetail(res);
        const initialQtys: Record<string, number> = {};
        res.lines.forEach(l => {
          initialQtys[l.id] = 0;
        });
        setReturnQty(initialQtys);
      })
      .catch(err => {
        console.error(err);
        setError('Gagal memuat detail transaksi.');
      })
      .finally(() => setLoading(false));
  }, [saleId]);

  const handleSubmit = async () => {
    if (!detail) return;
    const linesToReturn: SaleReturnLineInput[] = [];
    detail.lines.forEach(l => {
      const qty = returnQty[l.id] || 0;
      if (qty > 0) {
        linesToReturn.push({
          sale_line_id: l.id,
          item_id: l.item_id,
          unit_id: l.unit_id,
          qty,
          price: l.price,
          hpp_value: l.hpp_value
        });
      }
    });

    if (linesToReturn.length === 0) {
      toast.info('Pilih minimal 1 barang untuk diretur.');
      return;
    }

    if (!reason.trim()) {
      toast.info('Isi alasan retur.');
      return;
    }

    try {
      setSubmitting(true);
      await createSaleReturn(detail.sale.id, linesToReturn, reason);
      toast.success('Retur berhasil diproses.');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal memproses retur: ' + err.toString());
    } finally {
      setSubmitting(false);
    }
  };

  const handleQtyChange = (lineId: string, val: number, max: number) => {
    let newQty = val;
    if (newQty < 0) newQty = 0;
    if (newQty > max) newQty = max;
    setReturnQty(prev => ({ ...prev, [lineId]: newQty }));
  };

  if (loading) {
    return (
      <Modal isOpen={true} onClose={onClose} size="sm" title="Retur Penjualan" icon={RotateCcw}>
        <div className="py-10 flex flex-col items-center justify-center gap-2.5">
          <Loader2 className="animate-spin text-primary" size={24} />
          <p className="text-xs text-dim">Memuat detail...</p>
        </div>
      </Modal>
    );
  }

  if (error || !detail) {
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        size="sm"
        title="Retur Penjualan"
        icon={RotateCcw}
        footer={
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
        }
      >
        <p className="py-6 text-center text-sm text-dim">{error || 'Transaksi tidak ditemukan.'}</p>
      </Modal>
    );
  }

  const totalReturnVal = detail.lines.reduce((sum, line) => {
    const rq = returnQty[line.id] || 0;
    const unitPrice = line.price - (line.discount_amount / line.qty);
    return sum + (rq * unitPrice);
  }, 0);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="3xl"
      title="Retur Penjualan"
      subtitle={detail.sale.transaction_no}
      icon={RotateCcw}
      iconBg="bg-danger-soft text-danger"
      footer={
        <div className="flex justify-between items-center w-full gap-3">
          <div>
            <p className="text-xs text-dim font-medium">Total Retur</p>
            <p className="text-lg font-bold text-danger tnum">Rp {totalReturnVal.toLocaleString('id-ID')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="md" type="button" onClick={onClose} disabled={submitting}>
              Batal
            </Button>
            <Button
              variant="danger"
              size="md"
              type="button"
              onClick={handleSubmit}
              loading={submitting}
              disabled={totalReturnVal === 0 || !reason.trim()}
            >
              Proses Retur
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-warning-soft text-warning px-3.5 py-2.5 rounded-lg border border-warning/25 flex items-center gap-2.5 text-xs font-medium">
          <AlertCircle className="shrink-0" size={16} />
          <span>Dana dikembalikan via kasir dan stok masuk kembali ke inventaris.</span>
        </div>

        <div className="space-y-2">
          {detail.lines.map(line => (
            <div key={line.id} className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-xl border border-line">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-heading truncate">{line.item_name}</p>
                <p className="text-xs text-dim mt-0.5 tnum">
                  {line.qty} {line.unit_name} × Rp {line.price.toLocaleString('id-ID')}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label className="text-xs text-dim font-medium">Qty</label>
                <input
                  type="number"
                  min={0}
                  max={line.qty}
                  aria-label={`Qty retur ${line.item_name}`}
                  value={returnQty[line.id] ?? 0}
                  onChange={e => handleQtyChange(line.id, parseInt(e.target.value) || 0, line.qty)}
                  className="w-20 h-9 px-2.5 border border-line bg-input rounded-lg text-center font-semibold text-sm text-heading tnum outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold text-heading mb-1.5">Alasan Retur</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            required
            placeholder="Barang cacat, salah barang, dll."
            rows={2}
            className="w-full bg-input border border-line rounded-lg px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none text-sm text-heading"
          />
        </div>
      </div>
    </Modal>
  );
}
