import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, ShoppingCart } from 'lucide-react';
import {
  getSuppliers,
  getItemsFiltered,
  getItem,
  createPurchaseOrder,
  Supplier,
  Item,
  PoLineInput,
  ItemUnit,
} from '../../lib/api';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';

interface PoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId: string;
}

const INPUT_CLASS =
  'h-9 w-full rounded-lg border border-line bg-input px-3 text-sm text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

const COMPACT_INPUT_CLASS =
  'h-8 w-full rounded-lg border border-line bg-input px-2.5 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function PoDrawer({ isOpen, onClose, onSuccess, branchId }: PoDrawerProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [unitCache, setUnitCache] = useState<Record<string, ItemUnit[]>>({});

  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<(PoLineInput & { tempId: string })[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getSuppliers('', true).then(setSuppliers).catch(console.error);
      getItemsFiltered('', '', '', true, 1, 1000)
        .then((res) => setItems(res.items))
        .catch(console.error);
      setSupplierId('');
      setExpectedDate('');
      setNotes('');
      setLines([{ tempId: Math.random().toString(), item_id: '', unit_id: '', qty: 1, price: 0 }]);
      setUnitCache({});
    }
  }, [isOpen]);

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { tempId: Math.random().toString(), item_id: '', unit_id: '', qty: 1, price: 0 },
    ]);

  const handleItemSelect = async (tempId: string, itemId: string) => {
    setLines((prev) => prev.map((l) => (l.tempId === tempId ? { ...l, item_id: itemId, unit_id: '' } : l)));
    if (!itemId) return;

    let units = unitCache[itemId];
    let defaultHpp = 0;
    if (!units) {
      try {
        const details = await getItem(itemId);
        units = details.units || [];
        defaultHpp = details.item.cost_price || details.item.avg_hpp || 0;
        setUnitCache((prev) => ({ ...prev, [itemId]: units }));
      } catch (e) {
        console.error(e);
      }
    }

    const baseUnit = units?.find((u) => u.is_base === 1) || units?.[0];
    if (baseUnit) {
      setLines((current) =>
        current.map((l) =>
          l.tempId === tempId ? { ...l, unit_id: baseUnit.id, price: l.price || defaultHpp } : l,
        ),
      );
    }
  };

  const updateLine = (tempId: string, field: keyof PoLineInput, value: any) => {
    setLines((prev) => prev.map((l) => (l.tempId === tempId ? { ...l, [field]: value } : l)));
  };

  const removeLine = (tempId: string) => {
    if (lines.length === 1) {
      setLines([{ tempId: Math.random().toString(), item_id: '', unit_id: '', qty: 1, price: 0 }]);
    } else {
      setLines((prev) => prev.filter((l) => l.tempId !== tempId));
    }
  };

  const handleSubmit = async () => {
    if (!supplierId) return toast.info('Pilih pemasok terlebih dahulu.');
    const validLines = lines.filter((l) => l.item_id && l.unit_id && l.qty > 0);
    if (validLines.length === 0) return toast.info('Tambahkan minimal 1 barang dengan jumlah > 0.');

    setIsSubmitting(true);
    try {
      const payload = validLines.map(({ tempId, ...rest }) => rest);
      await createPurchaseOrder(branchId, supplierId, expectedDate || null, notes || null, payload);
      onSuccess();
      onClose();
    } catch (e) {
      toast.error('Gagal membuat PO: ' + e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totalEstimate = lines.reduce((sum, l) => sum + l.qty * l.price, 0);
  const totalQty = lines.reduce((sum, l) => sum + (l.qty || 0), 0);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Buat PO Baru"
      icon={ShoppingCart}
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-dim">Total Qty</p>
              <p className="text-sm font-bold text-heading tnum">{totalQty} unit</p>
            </div>
            <div className="h-7 w-px bg-line" />
            <div>
              <p className="text-xs text-dim">Estimasi Total</p>
              <p className="text-sm font-bold text-heading tnum">
                Rp {totalEstimate.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="button" variant="primary" onClick={handleSubmit} loading={isSubmitting}>
              {!isSubmitting && <Save size={15} />}
              Simpan PO
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-body mb-1.5">Pemasok *</label>
            <Select
              value={supplierId}
              onChange={setSupplierId}
              placeholder="Pilih pemasok..."
              ariaLabel="Pemasok"
            >
              <option value="">Pilih pemasok...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-body mb-1.5">Estimasi Tiba</label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-heading">Daftar Barang</h3>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus size={14} />
              Tambah Baris
            </Button>
          </div>

          <div className="space-y-2.5">
            {lines.map((line) => (
              <div
                key={line.tempId}
                className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end p-3.5 rounded-xl border border-line bg-muted/40"
              >
                <div className="flex-[3] min-w-0">
                  <label className="block text-xs font-medium text-dim mb-1">Barang</label>
                  <Select
                    size="sm"
                    value={line.item_id}
                    onChange={(v) => handleItemSelect(line.tempId, v)}
                    placeholder="Pilih barang..."
                    ariaLabel="Barang"
                  >
                    <option value="">Pilih barang...</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.sku})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="w-full sm:w-28">
                  <label className="block text-xs font-medium text-dim mb-1">Satuan</label>
                  <Select
                    size="sm"
                    value={line.unit_id}
                    onChange={(v) => updateLine(line.tempId, 'unit_id', v)}
                    disabled={!line.item_id}
                    placeholder="Satuan"
                    ariaLabel="Satuan"
                  >
                    <option value="">Satuan</option>
                    {(unitCache[line.item_id] || []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="w-full sm:w-20">
                  <label className="block text-xs font-medium text-dim mb-1">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={line.qty}
                    onChange={(e) => updateLine(line.tempId, 'qty', Number(e.target.value))}
                    className={`${COMPACT_INPUT_CLASS} text-center font-semibold tnum`}
                  />
                </div>

                <div className="w-full sm:w-32">
                  <label className="block text-xs font-medium text-dim mb-1">Harga Beli (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={line.price}
                    onChange={(e) => updateLine(line.tempId, 'price', Number(e.target.value))}
                    className={`${COMPACT_INPUT_CLASS} text-right font-semibold tnum`}
                  />
                </div>

                <div className="w-full sm:w-28 sm:text-right">
                  <label className="block text-xs font-medium text-dim mb-1">Subtotal</label>
                  <p className="h-8 flex items-center sm:justify-end text-xs font-bold text-heading tnum">
                    Rp {((line.qty || 0) * (line.price || 0)).toLocaleString('id-ID')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeLine(line.tempId)}
                  aria-label="Hapus baris"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-dim hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
