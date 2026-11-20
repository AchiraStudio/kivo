import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Undo2,
  CreditCard,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { getPurchaseDetail, addPurchasePayment, createPurchaseReturn } from '../../lib/api';
import type { PurchaseDetail as PurchaseDetailData, ReceiveLineInput } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';

interface PurchaseDetailProps {
  purchaseId: string;
  onBack: () => void;
}

const INPUT_CLASS =
  'h-9 w-full rounded-lg border border-line bg-input px-3 text-sm text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

function getStatusMeta(status: string): { label: string; className: string } {
  switch (status) {
    case 'paid':
      return { label: 'Lunas', className: 'bg-success-soft text-success border-success/25' };
    case 'unpaid':
      return { label: 'Belum Lunas', className: 'bg-warning-soft text-warning border-warning/25' };
    case 'partial':
      return { label: 'Sebagian', className: 'bg-warning-soft text-warning border-warning/25' };
    default:
      return { label: status, className: 'bg-muted text-body border-line' };
  }
}

function getMethodLabel(method: string): string {
  switch (method) {
    case 'cash':
      return 'Tunai';
    case 'bank_transfer':
      return 'Transfer Bank';
    case 'cheque':
      return 'Giro / Cek';
    default:
      return method;
  }
}

export default function PurchaseDetail({ purchaseId, onBack }: PurchaseDetailProps) {
  const [data, setData] = useState<PurchaseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment form
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // Return form
  const [showReturn, setShowReturn] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnLines, setReturnLines] = useState<{ line: any; qty: number }[]>([]);
  const [isSavingReturn, setIsSavingReturn] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await getPurchaseDetail(purchaseId);
      setData(detail);
      setReturnLines(detail.lines.map((l) => ({ line: l, qty: 0 })));
    } catch (e: any) {
      setError(e?.message || String(e) || 'Gagal memuat detail faktur.');
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      return toast.info('Masukkan jumlah pembayaran yang valid.');
    }
    setIsSavingPayment(true);
    try {
      await addPurchasePayment(
        purchaseId,
        Number(paymentAmount),
        paymentMethod,
        paymentRef || undefined,
      );
      setShowPayment(false);
      setPaymentAmount('');
      setPaymentMethod('cash');
      setPaymentRef('');
      toast.success('Pembayaran berhasil dicatat.');
      loadData();
    } catch (e) {
      toast.error('Pembayaran gagal: ' + e);
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleReturn = async () => {
    const lines: ReceiveLineInput[] = returnLines
      .filter((r) => r.qty > 0)
      .map((r) => ({
        po_line_id: '',
        item_id: r.line.item_id,
        unit_id: r.line.unit_id,
        qty_received: r.qty,
        price_per_unit: 0,
        expiry_date: undefined,
        batch_no: undefined,
      }));
    if (lines.length === 0 || !returnReason.trim()) {
      return toast.info('Isi alasan retur dan minimal satu jumlah barang.');
    }
    setIsSavingReturn(true);
    try {
      await createPurchaseReturn(purchaseId, lines, returnReason.trim());
      setShowReturn(false);
      setReturnReason('');
      toast.success('Retur pembelian berhasil diproses.');
      loadData();
    } catch (e) {
      toast.error('Retur gagal: ' + e);
    } finally {
      setIsSavingReturn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2 text-dim">
        <Loader2 className="animate-spin text-primary" size={24} />
        <span className="text-xs">Memuat detail faktur...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto w-full flex flex-col items-center justify-center py-20 gap-3 text-center">
        <AlertCircle size={24} className="text-danger" />
        <p className="text-sm text-body">{error || 'Data faktur tidak ditemukan.'}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft size={14} />
            Kembali
          </Button>
          {error && (
            <Button variant="outline" size="sm" onClick={loadData}>
              Muat Ulang
            </Button>
          )}
        </div>
      </div>
    );
  }

  const { purchase, lines, payments, returns } = data;
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, purchase.total_amount - totalPaid);
  const statusMeta = getStatusMeta(purchase.status);

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="sm" onClick={onBack} aria-label="Kembali">
            <ArrowLeft size={15} />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-heading truncate">
                {purchase.invoice_no ? (
                  <span className="font-mono">{purchase.invoice_no}</span>
                ) : (
                  `Faktur #${purchase.id.split('-')[0].toUpperCase()}`
                )}
              </h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${statusMeta.className}`}
              >
                {statusMeta.label}
              </span>
            </div>
            <p className="text-xs text-dim font-mono mt-0.5">
              ID: {purchase.id.split('-')[0].toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowReturn(true)}>
            <Undo2 size={14} />
            Retur
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setPaymentAmount(remaining > 0 ? remaining : '');
              setShowPayment(true);
            }}
          >
            <Plus size={14} />
            Catat Pembayaran
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 bg-card rounded-xl border border-line overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h2 className="text-sm font-bold text-heading">Barang Diterima</h2>
            <span className="text-xs text-dim tnum">{lines.length} barang</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[480px]">
              <thead className="bg-muted border-b border-line text-xs text-dim font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Barang</th>
                  <th className="py-2.5 px-4 text-right">Qty</th>
                  <th className="py-2.5 px-4 text-right">Harga Satuan</th>
                  <th className="py-2.5 px-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-heading">
                        {l.item_name || l.item_id}
                        {l.unit_name ? (
                          <span className="text-xs font-normal text-dim ml-1">({l.unit_name})</span>
                        ) : null}
                      </p>
                      {(l.batch_no || l.expiry_date) && (
                        <p className="text-xs text-dim mt-0.5 font-mono">
                          {[l.batch_no && `Batch ${l.batch_no}`, l.expiry_date && `ED ${l.expiry_date}`]
                            .filter(Boolean)
                            .join(' / ')}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-heading tnum">
                      {l.qty_received}
                    </td>
                    <td className="py-3 px-4 text-right text-body tnum">
                      Rp {l.price_per_unit.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-heading tnum">
                      Rp {(l.qty_received * l.price_per_unit).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-line p-4 space-y-3">
            <h2 className="text-sm font-bold text-heading">Pembayaran</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-dim">Total Faktur</span>
                <span className="font-semibold text-heading tnum">
                  Rp {purchase.total_amount.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-dim">Terbayar</span>
                <span className="font-semibold text-success tnum">
                  Rp {totalPaid.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="pt-1.5 border-t border-line flex items-center justify-between gap-2">
                <span className="font-semibold text-heading">Sisa Tagihan</span>
                <span className="font-bold text-heading tnum">
                  Rp {remaining.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {payments.length > 0 && (
              <ul className="pt-2 border-t border-line divide-y divide-line text-xs">
                {payments.map((p) => (
                  <li key={p.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="text-body truncate">
                      {getMethodLabel(p.method)}
                      {p.reference ? (
                        <span className="text-dim font-mono ml-1">({p.reference})</span>
                      ) : null}
                    </span>
                    <span className="font-semibold text-heading tnum shrink-0">
                      Rp {p.amount.toLocaleString('id-ID')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {returns.length > 0 && (
            <div className="bg-card rounded-xl border border-line p-4 space-y-2">
              <h2 className="text-sm font-bold text-heading">Riwayat Retur</h2>
              <ul className="divide-y divide-line text-xs">
                {returns.map((r) => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="text-body">{r.reason}</span>
                    <span className="text-dim font-mono shrink-0">
                      #{r.id.split('-')[0].toUpperCase()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {showPayment && (
        <Modal
          isOpen={true}
          onClose={() => !isSavingPayment && setShowPayment(false)}
          size="sm"
          title="Catat Pembayaran"
          icon={CreditCard}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPayment(false)}
                disabled={isSavingPayment}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handlePayment}
                loading={isSavingPayment}
              >
                Simpan
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-body mb-1.5">
                Jumlah Bayar (Rp) *
              </label>
              <input
                type="number"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                className={`${INPUT_CLASS} tnum`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-body mb-1.5">
                Metode Pembayaran
              </label>
              <Select
                value={paymentMethod}
                onChange={setPaymentMethod}
                ariaLabel="Metode Pembayaran"
              >
                <option value="cash">Tunai</option>
                <option value="bank_transfer">Transfer Bank</option>
                <option value="cheque">Giro / Cek</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-body mb-1.5">
                No. Referensi (Opsional)
              </label>
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="No. bukti transfer / cek"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </div>
        </Modal>
      )}

      {showReturn && (
        <Modal
          isOpen={true}
          onClose={() => !isSavingReturn && setShowReturn(false)}
          size="lg"
          title="Retur Pembelian"
          icon={RotateCcw}
          iconBg="bg-danger-soft text-danger"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowReturn(false)}
                disabled={isSavingReturn}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleReturn}
                loading={isSavingReturn}
              >
                Proses Retur
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-body mb-1.5">Alasan Retur *</label>
              <input
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Barang rusak, kadaluarsa, atau salah kirim"
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {returnLines.map((r, i) => (
                <div
                  key={r.line.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 bg-muted/40 border border-line rounded-lg"
                >
                  <span className="text-xs font-semibold text-heading flex-1 truncate">
                    {r.line.item_name || r.line.item_id}
                    {r.line.unit_name ? (
                      <span className="font-normal text-dim ml-1">({r.line.unit_name})</span>
                    ) : null}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={r.line.qty_received}
                      value={r.qty}
                      onChange={(e) => {
                        const nextQty = Number(e.target.value);
                        setReturnLines((prev) =>
                          prev.map((row, idx) => (idx === i ? { ...row, qty: nextQty } : row)),
                        );
                      }}
                      className="h-8 w-20 rounded-lg border border-line bg-input px-2 text-center font-semibold text-xs text-heading tnum focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      aria-label={`Jumlah retur ${r.line.item_name || r.line.item_id}`}
                    />
                    <span className="text-xs text-dim tnum">/ {r.line.qty_received}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
