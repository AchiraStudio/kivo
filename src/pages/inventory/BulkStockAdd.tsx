import { useState, useEffect } from 'react';
import { Save, Layers, Loader2, Search, AlertCircle } from 'lucide-react';
import { getCategories, getItemsFiltered, Category, Item, invoke } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';

interface BulkStockAddProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  onSuccess: () => void;
}

export default function BulkStockAdd({ isOpen, onClose, branchId, onSuccess }: BulkStockAddProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');

  const [loadingItems, setLoadingItems] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [hpps, setHpps] = useState<Record<string, number>>({});
  const [batchNos, setBatchNos] = useState<Record<string, string>>({});
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkQty, setBulkQty] = useState('');
  const [bulkCat, setBulkCat] = useState('');
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getCategories().then(setCategories).catch(console.error);
      fetchItems('all', '');
      setQtys({});
      setHpps({});
      setBatchNos({});
      setExpiryDates({});
    }
  }, [isOpen]);

  const fetchItems = async (catId: string, searchStr: string) => {
    setLoadingItems(true);
    setErrorMsg(null);
    try {
      const res = await getItemsFiltered(searchStr, catId === 'all' ? '' : catId, '', true, 1, 9999);
      setItems(res.items);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || String(e));
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        fetchItems(selectedCategory, search);
        setSelectedIds(new Set());
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [search, selectedCategory, isOpen]);

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const applyBulkChanges = async () => {
    if (selectedIds.size === 0) return toast.info('Pilih minimal satu produk.');

    if (bulkQty) {
      const q = Number(bulkQty);
      if (!isNaN(q) && q >= 0) {
        setQtys((prev) => {
          const next = { ...prev };
          selectedIds.forEach((id) => (next[id] = q));
          return next;
        });
      }
    }

    if (bulkCat) {
      setIsApplyingBulk(true);
      try {
        await invoke('bulk_update_category', { itemIds: Array.from(selectedIds), categoryId: bulkCat });
        setItems((prev) =>
          prev.map((i) =>
            selectedIds.has(i.id)
              ? ({ ...i, category_id: bulkCat, category_name: categories.find((c) => c.id === bulkCat)?.name } as Item)
              : i
          )
        );
        toast.success('Kategori berhasil diperbarui.');
      } catch (e) {
        toast.error('Gagal memperbarui kategori: ' + e);
      } finally {
        setIsApplyingBulk(false);
      }
    }
  };

  const handleSubmit = async () => {
    try {
      const payload = items
        .filter((i) => qtys[i.id] && qtys[i.id] > 0)
        .map((i) => {
          const expiryDate = expiryDates[i.id];
          if (expiryDate && new Date(expiryDate) < new Date(new Date().setHours(0, 0, 0, 0))) {
            throw new Error(`Produk ${i.name} memiliki tanggal kadaluarsa yang sudah lewat.`);
          }
          return {
            item_id: i.id,
            unit_id: i.base_unit_id,
            qty_change: qtys[i.id],
            hpp_value: hpps[i.id] !== undefined ? hpps[i.id] : i.avg_hpp || 0,
            batch_no: batchNos[i.id] || null,
            expiry_date: expiryDate || null,
            notes: 'Bulk Stock Addition',
          };
        });

      if (payload.length === 0) {
        toast.info('Belum ada jumlah stok yang diisi.');
        return;
      }

      setIsSubmitting(true);
      await invoke('bulk_add_stock', { branchId, items: payload });
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(`Gagal menyimpan stok massal: ${e.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      title="Penyesuaian Stok Massal"
      icon={Layers}
      noPadding={true}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} loading={isSubmitting}>
            {!isSubmitting && <Save size={15} />}
            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-line flex flex-col gap-3 bg-muted/30">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" size={15} />
              <input
                type="text"
                placeholder="Cari produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-input border border-line rounded-lg text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>
            <Select value={selectedCategory} onChange={(v) => setSelectedCategory(v)} className="w-full sm:w-48">
              <option value="all">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 bg-card p-2.5 rounded-lg border border-line">
            <span className="text-xs font-semibold text-heading px-1 tnum">
              {selectedIds.size} terpilih
            </span>
            <div className="h-4 w-px bg-line hidden sm:block" />

            <input
              type="number"
              placeholder="Set Qty"
              value={bulkQty}
              onChange={(e) => setBulkQty(e.target.value)}
              className="w-24 h-8 bg-input border border-line rounded-lg px-2.5 text-xs text-heading tnum outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            <Select value={bulkCat} onChange={(v) => setBulkCat(v)} size="sm" className="w-44">
              <option value="">Pindah kategori...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={applyBulkChanges}
              loading={isApplyingBulk}
              disabled={selectedIds.size === 0 || (!bulkQty && !bulkCat)}
            >
              Terapkan
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto max-h-[55vh] custom-scrollbar relative">
          {loadingItems ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="animate-spin text-primary" size={22} />
            </div>
          ) : errorMsg ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <AlertCircle size={22} className="text-danger mb-2" />
              <p className="text-sm font-semibold text-heading">Gagal memuat produk</p>
              <p className="text-xs text-dim mt-0.5 mb-3">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={() => fetchItems(selectedCategory, search)}>
                Coba Lagi
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-dim">Tidak ada produk ditemukan.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-muted border-b border-line z-10">
                <tr className="text-xs font-semibold text-dim">
                  <th className="py-2.5 px-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedIds.size === items.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-line-strong text-primary focus:ring-primary cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3.5">Produk</th>
                  <th className="py-2.5 px-3.5">Kategori</th>
                  <th className="py-2.5 px-3.5 w-28">Tambah Qty</th>
                  <th className="py-2.5 px-3.5 w-32">No. Batch</th>
                  <th className="py-2.5 px-3.5 w-40">Kadaluarsa</th>
                  <th className="py-2.5 px-3.5 w-32">HPP / Satuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-muted/40 transition-colors ${
                      selectedIds.has(item.id) ? 'bg-primary-soft/40' : ''
                    }`}
                  >
                    <td className="py-2 px-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="w-4 h-4 rounded border-line-strong text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-3.5">
                      <div className="font-semibold text-heading text-xs sm:text-sm">{item.name}</div>
                      <div className="text-[11px] font-mono text-dim">
                        {item.sku} | {item.base_unit_name || 'Unit'}
                      </div>
                    </td>
                    <td className="py-2 px-3.5 text-xs text-body">{(item as any).category_name || '-'}</td>
                    <td className="py-2 px-3.5">
                      <input
                        type="number"
                        min="0"
                        value={qtys[item.id] || ''}
                        onChange={(e) => setQtys({ ...qtys, [item.id]: Number(e.target.value) })}
                        className="w-full h-8 bg-input border border-line rounded-lg px-2 text-xs text-heading tnum outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        placeholder="0"
                      />
                    </td>
                    <td className="py-2 px-3.5">
                      <input
                        type="text"
                        value={batchNos[item.id] || ''}
                        onChange={(e) => setBatchNos({ ...batchNos, [item.id]: e.target.value })}
                        className="w-full h-8 bg-input border border-line rounded-lg px-2 text-xs font-mono text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        placeholder="Opsional"
                      />
                    </td>
                    <td className="py-2 px-3.5">
                      <input
                        type="date"
                        value={expiryDates[item.id] || ''}
                        onChange={(e) => setExpiryDates({ ...expiryDates, [item.id]: e.target.value })}
                        className="w-full h-8 bg-input border border-line rounded-lg px-2 text-xs text-heading tnum outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </td>
                    <td className="py-2 px-3.5">
                      <input
                        type="number"
                        min="0"
                        value={hpps[item.id] !== undefined ? hpps[item.id] : item.avg_hpp || ''}
                        onChange={(e) => setHpps({ ...hpps, [item.id]: Number(e.target.value) })}
                        className="w-full h-8 bg-input border border-line rounded-lg px-2 text-xs text-heading tnum outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
