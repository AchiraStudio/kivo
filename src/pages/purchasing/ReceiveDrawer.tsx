import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, PackageCheck } from 'lucide-react';
import {
  getPoLines,
  receiveGoods,
  PoLine,
  ReceiveLineInput,
  PurchaseOrder,
  getPurchaseOrders,
} from '../../lib/api';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';

interface ReceiveDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  poId: string;
  branchId: string;
}

type EditablePoLine = PoLine & {
  receiving_now: number;
  actual_price: number;
  batch_no: string;
  expiry_date: string;
  max_qty: number;
};

const CELL_INPUT_CLASS =
  'h-8 w-full rounded-lg border border-line bg-input px-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function ReceiveDrawer({
  isOpen,
  onClose,
  onSuccess,
  poId,
  branchId,
}: ReceiveDrawerProps) {
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [lines, setLines] = useState<EditablePoLine[]>([]);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setInvoiceNo('');
    Promise.all([
      getPurchaseOrders(branchId).then((pos) => {
        const found = pos.find((p) => p.id === poId) || null;
        setPo(found);
      }),
      getPoLines(poId).then((data) => {
        const pendingLines: EditablePoLine[] = data
          .filter((l) => l.qty_received < l.qty_ordered)
          .map((l) => {
            const remaining = l.qty_ordered - l.qty_received;
            return {
              ...l,
              receiving_now: remaining,
              actual_price: l.price_estimate,
              batch_no: '',
              expiry_date: '',
              max_qty: remaining,
            };
          });
        setLines(pendingLines);
      }),
    ])
      .catch((e) => {
        toast.error('Gagal memuat detail PO: ' + e);
      })
      .finally(() => setLoading(false));
  }, [isOpen, poId, branchId]);

  const updateLine = (id: string, field: keyof EditablePoLine, value: any) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));

  const totalReceivingAmount = lines.reduce(
    (sum, l) => sum + (l.receiving_now > 0 ? l.receiving_now * l.actual_price : 0),
    0,
  );
  const totalReceivingQty = lines.reduce(
    (sum, l) => sum + (l.receiving_now > 0 ? l.receiving_now : 0),
    0,
  );

  const handleSubmit = async () => {
    if (!po) return;

    if (lines.some((l) => l.receiving_now < 0 || l.receiving_now > l.max_qty)) {
      return toast.info('Jumlah diterima tidak boleh melebihi sisa PO.');
    }

    const activeLines = lines.filter((l) => l.receiving_now > 0);
    if (activeLines.length === 0) {
      return toast.info('Tentukan minimal 1 barang dengan jumlah diterima > 0.');
    }

    setIsSubmitting(true);
    try {
      const payload: ReceiveLineInput[] = activeLines.map((l) => ({
        po_line_id: l.id,
        item_id: l.item_id,
        unit_id: l.unit_id,
        qty_received: l.receiving_now,
        price_per_unit: l.actual_price,
        batch_no: l.batch_no.trim() || undefined,
        expiry_date: l.expiry_date.trim() || undefined,
      }));
      await receiveGoods(po.id, branchId, po.supplier_id, invoiceNo.trim() || null, payload);
      onSuccess();
      onClose();
    } catch (e) {
      toast.error('Gagal memproses penerimaan PO: ' + e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Terima Barang PO"
      subtitle={po ? `PO #${po.id.slice(0, 8).toUpperCase()}` : undefined}
      icon={PackageCheck}
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-dim">Total Diterima</p>
              <p className="text-sm font-bold text-heading tnum">{totalReceivingQty} unit</p>
            </div>
            <div className="h-7 w-px bg-line" />
            <div>
              <p className="text-xs text-dim">Total Tagihan</p>
              <p className="text-sm font-bold text-heading tnum">
                Rp {totalReceivingAmount.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={loading || !po || lines.length === 0}
            >
              {!isSubmitting && <CheckCircle2 size={15} />}
              Simpan Penerimaan
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-dim">
          <Loader2 className="animate-spin text-primary" size={24} />
          <span className="text-xs">Memuat item PO...</span>
        </div>
      ) : !po ? (
        <div className="py-16 text-center text-sm text-dim">Data PO tidak ditemukan.</div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-line bg-muted/40">
            <div>
              <p className="text-xs text-dim">Pemasok</p>
              <p className="text-sm font-bold text-heading mt-0.5">
                {po.supplier_name || '-'}
              </p>
              <p className="text-xs text-dim font-mono mt-0.5">#{po.id.slice(0, 12).toUpperCase()}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-body mb-1.5">
                No. Faktur / Surat Jalan
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="Contoh: INV-2026-991"
                className="h-9 w-full rounded-lg border border-line bg-input px-3 text-sm font-mono text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-heading tnum">
              Daftar Barang ({lines.length})
            </h3>

            {lines.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-line bg-card text-xs text-dim">
                Semua barang pada PO ini sudah diterima.
              </div>
            ) : (
              <div className="border border-line rounded-xl overflow-x-auto bg-card">
                <table className="w-full text-left text-xs border-collapse min-w-[740px]">
                  <thead className="bg-muted border-b border-line text-dim font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Barang</th>
                      <th className="py-2.5 px-3 w-20">Satuan</th>
                      <th className="py-2.5 px-3 text-right w-20">Sisa</th>
                      <th className="py-2.5 px-3 text-center w-24">Diterima</th>
                      <th className="py-2.5 px-3 text-right w-32">Harga (Rp)</th>
                      <th className="py-2.5 px-3 w-32">No. Batch</th>
                      <th className="py-2.5 px-3 w-36">Kadaluarsa</th>
                      <th className="py-2.5 px-3 text-right w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {lines.map((line) => {
                      const lineSubtotal = line.receiving_now * line.actual_price;
                      const invalidQty = line.receiving_now < 0 || line.receiving_now > line.max_qty;

                      return (
                        <tr key={line.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-heading">
                            {line.item_name}
                          </td>
                          <td className="py-2.5 px-3 text-dim font-medium">{line.unit_name}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-body tnum">
                            {line.max_qty}
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="number"
                              value={line.receiving_now}
                              onChange={(e) =>
                                updateLine(line.id, 'receiving_now', Number(e.target.value))
                              }
                              max={line.max_qty}
                              min="0"
                              className={`${CELL_INPUT_CLASS} text-center font-semibold tnum ${
                                invalidQty ? 'border-danger text-danger' : ''
                              }`}
                            />
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="number"
                              min="0"
                              value={line.actual_price}
                              onChange={(e) =>
                                updateLine(line.id, 'actual_price', Number(e.target.value))
                              }
                              className={`${CELL_INPUT_CLASS} text-right font-semibold tnum`}
                            />
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              placeholder="No. batch"
                              value={line.batch_no}
                              onChange={(e) => updateLine(line.id, 'batch_no', e.target.value)}
                              className={`${CELL_INPUT_CLASS} font-mono`}
                            />
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="date"
                              value={line.expiry_date}
                              onChange={(e) => updateLine(line.id, 'expiry_date', e.target.value)}
                              className={CELL_INPUT_CLASS}
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-heading tnum">
                            Rp {lineSubtotal.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
