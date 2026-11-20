import { useState, useEffect, useRef } from 'react';
import { getSales, Sale, invoke } from '../../lib/api';
import { Loader2, Printer, RotateCcw, Trash2, FileText } from 'lucide-react';
import ReceiptModal from './ReceiptModal';
import SaleReturnModal from './SaleReturnModal';
import SaleDetailModal from '../../components/pos/SaleDetailModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { usePermissions } from '../../lib/permissions';
import { toast } from '../../components/ui/Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  completed: { label: 'Selesai', className: 'bg-success-soft text-success' },
  returned: { label: 'Retur', className: 'bg-warning-soft text-warning' },
};

export default function SalesHistoryModal({ isOpen, onClose }: Props) {
  const { can } = usePermissions();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [returnSaleId, setReturnSaleId] = useState<string | null>(null);
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSales('branch_001');
      setSales(data);
    } catch (e) {
      console.error(e);
      setError('Gagal memuat riwayat transaksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSales();
      setSelectedIdx(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleSync = () => {
      fetchSales();
    };
    window.addEventListener('kivo:sync', handleSync);
    return () => window.removeEventListener('kivo:sync', handleSync);
  }, [isOpen]);

  const handleDelete = async (saleId: string) => {
    setDeleting(true);
    try {
      await invoke('delete_sale', { id: saleId });
      setDeleteConfirmId(null);
      setDetailSaleId(null);
      await fetchSales();
    } catch (e: any) {
      toast.error('Gagal menghapus transaksi: ' + (e?.message || String(e)));
    } finally {
      setDeleting(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (deleteConfirmId || receiptSaleId || returnSaleId || detailSaleId) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIdx(prev => {
            const next = Math.min(prev + 1, sales.length - 1);
            rowRefs.current[next]?.focus();
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIdx(prev => {
            const p = Math.max(prev - 1, 0);
            rowRefs.current[p]?.focus();
            return p;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (sales[selectedIdx]) setDetailSaleId(sales[selectedIdx].id);
          break;
        case 'Escape':
          onClose();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, sales, selectedIdx, deleteConfirmId, receiptSaleId, returnSaleId, detailSaleId, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="4xl"
        title="Riwayat Transaksi"
        subtitle={loading ? undefined : `${sales.length} transaksi`}
        icon={FileText}
        noPadding={true}
      >
        <div className="overflow-y-auto custom-scrollbar max-h-[65vh]">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-primary" size={24} />
              <span className="text-xs text-dim">Memuat riwayat...</span>
            </div>
          ) : error ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center px-4">
              <p className="text-sm text-danger">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchSales}>
                Coba Lagi
              </Button>
            </div>
          ) : sales.length === 0 ? (
            <div className="py-16 text-center text-sm text-dim">Belum ada transaksi.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-muted border-b border-line text-xs text-dim font-semibold sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-4">Waktu</th>
                  <th className="py-2.5 px-4">No. Transaksi</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sales.map((s, idx) => {
                  const status = STATUS_META[s.status] || {
                    label: s.status,
                    className: 'bg-danger-soft text-danger',
                  };
                  return (
                    <tr
                      key={s.id}
                      ref={el => { rowRefs.current[idx] = el; }}
                      tabIndex={0}
                      onClick={() => setSelectedIdx(idx)}
                      onDoubleClick={() => setDetailSaleId(s.id)}
                      className={`cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                        idx === selectedIdx ? 'bg-primary-soft/50' : 'hover:bg-muted/50'
                      }`}
                    >
                      <td className="py-3 px-4 text-xs text-dim tnum">
                        {new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs sm:text-sm font-semibold text-heading">
                        <span>{s.transaction_no}</span>
                        {idx === selectedIdx && (
                          <kbd className="ml-2 text-[10px] font-mono font-semibold bg-card border border-line text-dim px-1.5 py-0.5 rounded-md">
                            Enter
                          </kbd>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-heading tnum">
                        Rp {s.grand_total.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setReceiptSaleId(s.id)}
                            title="Cetak Ulang Struk"
                            aria-label="Cetak ulang struk"
                            className="p-1.5 hover:bg-muted rounded-lg text-body hover:text-heading transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <Printer size={15} />
                          </button>
                          {can('sales.return') && (
                            <button
                              type="button"
                              onClick={() => setReturnSaleId(s.id)}
                              title="Retur Transaksi"
                              aria-label="Retur transaksi"
                              className="p-1.5 hover:bg-warning-soft text-warning rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}
                          {can('sales.delete') && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(s.id)}
                              title="Hapus Transaksi"
                              aria-label="Hapus transaksi"
                              className="p-1.5 hover:bg-danger-soft text-danger rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Modal>

      {detailSaleId && (
        <SaleDetailModal
          saleId={detailSaleId}
          onClose={() => setDetailSaleId(null)}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        title="Hapus Transaksi?"
        message={
          <p>
            Transaksi{' '}
            <strong className="font-mono">
              {sales.find(s => s.id === deleteConfirmId)?.transaction_no}
            </strong>{' '}
            akan dihapus permanen.
          </p>
        }
        loading={deleting}
      />

      {receiptSaleId && <ReceiptModal saleId={receiptSaleId} onClose={() => setReceiptSaleId(null)} />}
      {returnSaleId && <SaleReturnModal saleId={returnSaleId} onClose={() => { setReturnSaleId(null); fetchSales(); }} />}
    </>
  );
}
