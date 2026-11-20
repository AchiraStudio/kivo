// src/components/pos/SaleDetailModal.tsx
import { useState, useEffect } from 'react';
import { getSaleDetail, SaleDetail } from '../../lib/api';
import { Loader2, Receipt } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

interface SaleDetailModalProps {
  saleId: string;
  onClose: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Tunai',
  transfer: 'Transfer',
  debit: 'Debit',
  credit: 'Kredit',
  qris: 'QRIS',
};

export default function SaleDetailModal({ saleId, onClose }: SaleDetailModalProps) {
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getSaleDetail(saleId)
      .then(d => setDetail(d))
      .catch(err => {
        console.error(err);
        setError('Gagal memuat detail transaksi.');
      })
      .finally(() => setLoading(false));
  }, [saleId]);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="2xl"
      icon={Receipt}
      title="Detail Transaksi"
      subtitle={detail?.sale?.transaction_no}
      footer={
        <Button variant="outline" size="sm" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10">
          <Loader2 size={24} className="animate-spin text-primary" />
          <span className="text-xs text-dim">Memuat detail...</span>
        </div>
      ) : error || !detail ? (
        <div className="text-center py-10 text-sm text-dim">
          {error || 'Detail transaksi tidak tersedia.'}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-card rounded-xl border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-dim font-semibold text-xs border-b border-line">
                <tr>
                  <th className="py-2.5 px-3.5 text-left">Item</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3.5 text-right">Harga</th>
                  <th className="py-2.5 px-3.5 text-right">Diskon</th>
                  <th className="py-2.5 px-3.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {detail.lines.map(line => (
                  <tr key={line.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-3.5 font-medium text-heading">
                      {line.item_name || line.item_id}
                      <span className="text-dim text-xs ml-1">({line.unit_name || line.unit_id})</span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-heading tnum">{line.qty}</td>
                    <td className="py-2.5 px-3.5 text-right text-heading tnum">
                      Rp {line.price.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-warning tnum">
                      {line.discount_amount > 0 ? `-Rp ${line.discount_amount.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-heading tnum">
                      Rp {line.subtotal.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/60 font-bold border-t border-line text-heading">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3.5 text-right text-xs text-dim font-semibold">
                    Total
                  </td>
                  <td className="py-2.5 px-3.5 text-right text-heading tnum">
                    Rp {detail.sale.grand_total.toLocaleString('id-ID')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {detail.payments.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-dim mb-2">Pembayaran</h4>
              <div className="flex flex-wrap gap-2">
                {detail.payments.map(p => (
                  <div
                    key={p.id}
                    className="bg-muted border border-line px-3 py-2 rounded-lg flex items-center gap-2.5"
                  >
                    <span className="text-xs font-semibold text-body">
                      {PAYMENT_LABELS[p.method?.toLowerCase()] || p.method}
                    </span>
                    <span className="text-sm font-bold text-heading tnum">
                      Rp {p.amount.toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
