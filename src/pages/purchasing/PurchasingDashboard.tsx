import { useState, useEffect, useCallback } from 'react';
import {
  getPurchaseOrders,
  getPurchases,
  PurchaseOrder,
  Purchase,
  cancelPurchaseOrder,
  getSuppliers,
  Supplier,
} from '../../lib/api';
import {
  Loader2,
  Plus,
  FileText,
  CheckCircle2,
  Clock,
  Inbox,
  X,
  AlertCircle,
  PackageCheck,
} from 'lucide-react';
import PoDrawer from './PoDrawer';
import ReceiveDrawer from './ReceiveDrawer';
import DirectReceiveModal from './DirectReceiveModal';
import PurchaseDetail from './PurchaseDetail';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { toast } from '../../components/ui/Toast';

const DEFAULT_BRANCH_ID = 'branch_001';

function getStatusMeta(status: string): { label: string; className: string } {
  switch (status) {
    case 'received':
      return { label: 'Diterima', className: 'bg-success-soft text-success border-success/25' };
    case 'paid':
      return { label: 'Lunas', className: 'bg-success-soft text-success border-success/25' };
    case 'sent':
      return { label: 'Terkirim', className: 'bg-info-soft text-info border-info/25' };
    case 'unpaid':
      return { label: 'Belum Lunas', className: 'bg-warning-soft text-warning border-warning/25' };
    case 'partial':
      return { label: 'Sebagian', className: 'bg-warning-soft text-warning border-warning/25' };
    case 'cancelled':
      return { label: 'Dibatalkan', className: 'bg-danger-soft text-danger border-danger/25' };
    default:
      return { label: status, className: 'bg-muted text-body border-line' };
  }
}

export default function PurchasingDashboard() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view] = useState<'po' | 'purchases'>('purchases');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierFilter, setSupplierFilter] = useState('');

  const [isPoDrawerOpen, setIsPoDrawerOpen] = useState(false);
  const [isDirectReceiveOpen, setIsDirectReceiveOpen] = useState(false);
  const [receivePoId, setReceivePoId] = useState<string | null>(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [cancelPoId, setCancelPoId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [poData, purchaseData, supplierData] = await Promise.all([
        getPurchaseOrders(DEFAULT_BRANCH_ID),
        getPurchases(DEFAULT_BRANCH_ID),
        getSuppliers(),
      ]);
      setPos(poData);
      setPurchases(purchaseData);
      setSuppliers(supplierData);
    } catch (e: any) {
      setError(e?.message || String(e) || 'Gagal memuat data pembelian.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refreshAll = useCallback(() => {
    Promise.all([
      getPurchaseOrders(DEFAULT_BRANCH_ID).then(setPos),
      getPurchases(DEFAULT_BRANCH_ID).then(setPurchases),
    ]).catch((e) => {
      console.error(e);
    });
  }, []);

  const confirmCancelPO = async () => {
    if (!cancelPoId) return;
    setIsCancelling(true);
    try {
      await cancelPurchaseOrder(cancelPoId);
      toast.success('PO berhasil dibatalkan.');
      setCancelPoId(null);
      refreshAll();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setIsCancelling(false);
    }
  };

  if (selectedPurchaseId) {
    return (
      <PurchaseDetail
        purchaseId={selectedPurchaseId}
        onBack={() => {
          setSelectedPurchaseId(null);
          refreshAll();
        }}
      />
    );
  }

  const filteredPurchases = purchases.filter(
    (p) => !supplierFilter || p.supplier_id === supplierFilter,
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <h1 className="text-lg font-bold tracking-tight text-heading">
          {view === 'po' ? 'Pesanan Pembelian (PO)' : 'Penerimaan Barang'}
        </h1>
        {view === 'po' ? (
          <Button variant="primary" size="md" onClick={() => setIsPoDrawerOpen(true)}>
            <Plus size={15} />
            Buat PO Baru
          </Button>
        ) : (
          <Button variant="primary" size="md" onClick={() => setIsDirectReceiveOpen(true)}>
            <Plus size={15} />
            Terima Barang
          </Button>
        )}
      </div>

      {view === 'po' ? (
        <div className="bg-card rounded-xl border border-line flex-1 min-h-0 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 gap-2 text-dim">
              <Loader2 className="animate-spin text-primary" size={24} />
              <span className="text-xs">Memuat daftar PO...</span>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
              <AlertCircle size={24} className="text-danger" />
              <p className="text-sm text-body max-w-md">{error}</p>
              <Button variant="outline" size="sm" onClick={loadAll}>
                Muat Ulang
              </Button>
            </div>
          ) : pos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-dim mb-1">
                <FileText size={20} />
              </div>
              <p className="text-sm font-semibold text-heading">Belum ada PO</p>
              <p className="text-xs text-dim">Buat PO baru untuk memulai pemesanan ke pemasok.</p>
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => setIsPoDrawerOpen(true)}>
                  <Plus size={14} />
                  Buat PO Baru
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead className="sticky top-0 bg-muted border-b border-line text-xs text-dim font-semibold z-10">
                  <tr>
                    <th className="py-3 px-4">No. PO</th>
                    <th className="py-3 px-4">Pemasok</th>
                    <th className="py-3 px-4">Estimasi Tiba</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-sm">
                  {pos.map((po) => {
                    const statusMeta = getStatusMeta(po.status);
                    return (
                      <tr key={po.id} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-heading">
                          <span className="inline-flex items-center gap-1.5">
                            <FileText size={14} className="text-dim shrink-0" />
                            {po.id.split('-')[0].toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-heading">{po.supplier_name || '-'}</td>
                        <td className="py-3 px-4 text-body text-xs tnum">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock size={13} className="text-dim shrink-0" />
                            {po.expected_date || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {po.status !== 'received' && po.status !== 'cancelled' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCancelPoId(po.id)}
                                  className="text-danger hover:bg-danger-soft hover:text-danger"
                                >
                                  <X size={14} />
                                  Batal
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setReceivePoId(po.id)}
                                >
                                  <Inbox size={14} />
                                  Terima
                                </Button>
                              </>
                            )}
                            {po.status === 'received' && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                                <CheckCircle2 size={14} />
                                Selesai
                              </span>
                            )}
                            {po.status === 'cancelled' && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
                                <X size={14} />
                                Dibatalkan
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-line flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="p-3 sm:px-4 border-b border-line bg-muted/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
            <span className="text-xs font-medium text-dim tnum">
              {filteredPurchases.length} faktur
            </span>
            <div className="w-full sm:w-60">
              <Select
                size="sm"
                value={supplierFilter}
                onChange={setSupplierFilter}
                ariaLabel="Filter pemasok"
              >
                <option value="">Semua Pemasok</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 gap-2 text-dim">
              <Loader2 className="animate-spin text-primary" size={24} />
              <span className="text-xs">Memuat data penerimaan...</span>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
              <AlertCircle size={24} className="text-danger" />
              <p className="text-sm text-body max-w-md">{error}</p>
              <Button variant="outline" size="sm" onClick={loadAll}>
                Muat Ulang
              </Button>
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-dim mb-1">
                <PackageCheck size={20} />
              </div>
              <p className="text-sm font-semibold text-heading">
                {supplierFilter ? 'Tidak ada faktur untuk pemasok ini' : 'Belum ada penerimaan barang'}
              </p>
              <p className="text-xs text-dim">
                {supplierFilter
                  ? 'Pilih pemasok lain atau tampilkan semua pemasok.'
                  : 'Catat penerimaan barang masuk untuk memperbarui stok.'}
              </p>
              <div className="mt-2">
                {supplierFilter ? (
                  <Button variant="outline" size="sm" onClick={() => setSupplierFilter('')}>
                    Reset Filter
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setIsDirectReceiveOpen(true)}>
                    <Plus size={14} />
                    Terima Barang
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="sticky top-0 bg-muted border-b border-line text-xs text-dim font-semibold z-10">
                  <tr>
                    <th className="py-3 px-4">No. Faktur</th>
                    <th className="py-3 px-4">Pemasok</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-sm">
                  {filteredPurchases.map((p) => {
                    const statusMeta = getStatusMeta(p.status);
                    const supplierName =
                      suppliers.find((s) => s.id === p.supplier_id)?.name || 'Pemasok tidak diketahui';
                    return (
                      <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-heading">
                            <FileText size={14} className="text-dim shrink-0" />
                            {p.invoice_no || 'Tanpa Faktur'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-heading">{supplierName}</td>
                        <td className="py-3 px-4 text-right font-semibold text-heading tnum">
                          Rp {p.total_amount.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPurchaseId(p.id)}
                          >
                            Detail
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <PoDrawer
        isOpen={isPoDrawerOpen}
        onClose={() => setIsPoDrawerOpen(false)}
        onSuccess={refreshAll}
        branchId={DEFAULT_BRANCH_ID}
      />
      {receivePoId && (
        <ReceiveDrawer
          isOpen={!!receivePoId}
          poId={receivePoId}
          branchId={DEFAULT_BRANCH_ID}
          onClose={() => setReceivePoId(null)}
          onSuccess={refreshAll}
        />
      )}
      <DirectReceiveModal
        isOpen={isDirectReceiveOpen}
        onClose={() => setIsDirectReceiveOpen(false)}
        onSuccess={refreshAll}
        branchId={DEFAULT_BRANCH_ID}
      />
      {cancelPoId && (
        <ConfirmModal
          title="Batalkan PO?"
          message="Pesanan pembelian ini akan ditandai dibatalkan dan tidak dapat diterima lagi."
          confirmLabel="Batalkan PO"
          cancelLabel="Kembali"
          variant="danger"
          loading={isCancelling}
          onConfirm={confirmCancelPO}
          onCancel={() => !isCancelling && setCancelPoId(null)}
        />
      )}
    </div>
  );
}
