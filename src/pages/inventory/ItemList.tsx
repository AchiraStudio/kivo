import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Loader2,
  Eye,
  Trash2,
  Edit,
  Upload,
  Download,
  HelpCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
} from 'lucide-react';
import {
  getItemsFiltered,
  deleteItem,
  Item,
  importItemsExcel,
  exportItemsExcel,
  getCategories,
  Category,
  setItemPrice,
  setItemCostPrice,
  invoke,
} from '../../lib/api';
import { open, save } from '@tauri-apps/plugin-dialog';
import TourGuide from '../../components/ui/TourGuide';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { toast } from '../../components/ui/Toast';
import { usePermissions } from '../../lib/permissions';

interface ItemListProps {
  onViewItem: (id: string) => void;
  onEditItem: (id: string) => void;
  onAddItem: () => void;
  refreshTrigger: number;
}

export default function ItemList({ onViewItem, onEditItem, onAddItem, refreshTrigger }: ItemListProps) {
  const { can } = usePermissions();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<'name' | 'sku' | 'category' | 'price'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [runTour, setRunTour] = useState(false);
  const inventoryTourSteps = [
    {
      target: '.tour-inv-add',
      content: 'Klik di sini untuk menambah item/obat baru secara manual ke dalam sistem.',
      disableBeacon: true,
    },
    {
      target: '.tour-inv-import',
      content: 'Gunakan fitur ini untuk memasukkan banyak data sekaligus dari file Excel (.xlsx).',
    },
    {
      target: '.tour-inv-search',
      content: 'Cari barang dengan cepat menggunakan nama, SKU, atau scan barcode.',
    },
    {
      target: '.tour-inv-table',
      content: 'Tabel ini menampilkan seluruh katalog Anda. Klik ikon mata untuk melihat detail pergerakan stok. Anda dapat mengubah harga pokok dan eceran secara langsung di baris tabel ini.',
    },
  ];

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getItemsFiltered(search, selectedCategory, '', false, page, 20, sortBy, sortOrder);
      setItems(data.items);
      setTotal(data.total);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(delay);
  }, [search, selectedCategory, page, sortBy, sortOrder, refreshTrigger]);

  const handleSort = (column: 'name' | 'sku' | 'category' | 'price') => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (column: 'name' | 'sku' | 'category' | 'price') => {
    if (sortBy !== column) {
      return <ArrowUpDown size={13} className="text-dim opacity-60 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={13} className="text-primary" />
    ) : (
      <ArrowDown size={13} className="text-primary" />
    );
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteItem(deleteTargetId);
      toast.success('Produk dinonaktifkan.');
      loadData();
    } catch (err) {
      toast.error('Gagal menonaktifkan produk: ' + err);
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleImport = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
      });

      if (!file) return;

      setIsImporting(true);
      const res = await importItemsExcel(file as string);
      if (res.success) {
        try {
          await invoke('auto_assign_brands');
        } catch (e) {
          console.warn('Failed to auto-assign brands', e);
        }
        toast.success(`Berhasil import ${res.rows_imported} baris data.`);
        loadData();
      } else {
        toast.error(`Gagal import: ${res.errors.join(', ')}`);
      }
    } catch (e) {
      console.error(e);
      toast.error(`Error: ${e}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        defaultPath: 'Daftar_Item.xlsx',
      });
      if (!filePath) return;

      await exportItemsExcel(filePath);
      toast.success('Data berhasil diekspor ke Excel.');
    } catch (e) {
      console.error(e);
      toast.error(`Gagal export: ${e}`);
    }
  };

  const uniqueCategories = Array.from(
    new Map(categories.map((c) => [c.name.trim().toUpperCase(), c])).values()
  );
  const totalPages = Math.ceil(total / 20) || 1;

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-heading tracking-tight">Katalog Produk</h1>
          <span className="px-2 py-0.5 rounded-full bg-muted text-dim text-xs font-semibold border border-line tnum">
            {total}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {can('reports.export') && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download size={14} /> Ekspor
            </Button>
          )}
          {can('items.create') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              loading={isImporting}
              className="tour-inv-import"
            >
              {!isImporting && <Upload size={14} />}
              {isImporting ? 'Mengimpor...' : 'Impor'}
            </Button>
          )}
          {can('items.create') && (
            <Button variant="primary" size="sm" onClick={onAddItem} className="tour-inv-add">
              <Plus size={15} /> Tambah Produk
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRunTour(true)}
            className="px-2"
            title="Panduan"
            aria-label="Panduan"
          >
            <HelpCircle size={15} />
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-line flex flex-col flex-1 min-h-0 overflow-hidden tour-inv-table">
        <div className="p-3 border-b border-line flex flex-col sm:flex-row gap-2.5 bg-muted/40">
          <div className="tour-inv-search flex-1 flex items-center h-9 bg-input border border-line rounded-lg px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors">
            <Search size={15} className="text-dim mr-2 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama, SKU, atau barcode..."
              className="bg-transparent border-none outline-none text-sm w-full text-heading placeholder:text-dim"
            />
          </div>
          <Select
            value={selectedCategory}
            onChange={(v) => {
              setSelectedCategory(v);
              setPage(1);
            }}
            className="w-full sm:w-48"
            ariaLabel="Filter kategori"
          >
            <option value="">Semua Kategori</option>
            {uniqueCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-muted z-10 border-b border-line">
              <tr className="text-dim text-xs font-semibold select-none">
                <th
                  onClick={() => handleSort('name')}
                  className="py-2.5 px-3.5 cursor-pointer hover:text-heading transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Nama Produk</span>
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('sku')}
                  className="py-2.5 px-3.5 cursor-pointer hover:text-heading transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>SKU</span>
                    {renderSortIcon('sku')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  className="py-2.5 px-3.5 cursor-pointer hover:text-heading transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Kategori</span>
                    {renderSortIcon('category')}
                  </div>
                </th>
                <th className="py-2.5 px-3.5 text-right w-32 sm:w-36">HPP</th>
                <th
                  onClick={() => handleSort('price')}
                  className="py-2.5 px-3.5 text-right w-36 sm:w-40 cursor-pointer hover:text-heading transition-colors group"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Harga Eceran</span>
                    {renderSortIcon('price')}
                  </div>
                </th>
                <th className="py-2.5 px-3.5 text-left min-w-[180px] sm:min-w-[210px]">Tier Grosir</th>
                <th className="py-2.5 px-3.5 text-center w-24">Status</th>
                <th className="py-2.5 px-3.5 text-right w-28 sm:w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Loader2 size={22} className="animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              ) : errorMsg ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <AlertCircle size={22} className="mx-auto text-danger mb-2" />
                    <p className="text-sm font-semibold text-heading">Gagal memuat katalog</p>
                    <p className="text-xs text-dim mt-0.5 mb-3">{errorMsg}</p>
                    <Button variant="outline" size="sm" onClick={loadData}>
                      Coba Lagi
                    </Button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <p className="text-sm font-medium text-dim">Tidak ada produk ditemukan.</p>
                    {(search || selectedCategory) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setSearch('');
                          setSelectedCategory('');
                          setPage(1);
                        }}
                      >
                        Reset Filter
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-muted/40 transition-colors group fast-render-row ${
                      item.is_active === 0 ? 'opacity-55' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-heading text-sm">{item.name}</p>
                        {item.rack_location && (
                          <span className="px-1.5 py-0.5 rounded-md bg-muted text-dim text-[11px] font-mono border border-line">
                            {item.rack_location}
                          </span>
                        )}
                      </div>
                      {item.generic_name && <p className="text-xs text-dim mt-0.5">{item.generic_name}</p>}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-xs text-dim">{item.sku}</td>

                    <td className="py-2.5 px-3.5">
                      {item.category_name ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-body border border-line">
                          {item.category_name}
                        </span>
                      ) : (
                        <span className="text-xs text-dim">-</span>
                      )}
                    </td>

                    <td className="py-2 px-3.5 text-right tnum">
                      {can('items.change_price') ? (
                        <div
                          className="flex items-center h-8 bg-input border border-line rounded-lg px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors"
                          title="Harga Beli / HPP"
                        >
                          <span className="text-xs text-dim mr-1">Rp</span>
                          <input
                            type="number"
                            defaultValue={item.cost_price || 0}
                            onBlur={async (e) => {
                              const val = parseFloat(e.target.value);
                              if (isNaN(val) || val === item.cost_price) return;
                              try {
                                await setItemCostPrice(item.id, val);
                                item.cost_price = val;
                              } catch (err) {
                                toast.error('Gagal update harga pokok: ' + err);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-full bg-transparent border-none outline-none text-xs font-semibold text-heading p-0 text-right tnum"
                          />
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-dim tnum">
                          Rp {(item.cost_price || 0).toLocaleString('id-ID')}
                        </span>
                      )}
                    </td>

                    <td className="py-2 px-3.5 text-right tnum">
                      {can('items.change_price') ? (
                        <div className="flex items-center h-8 bg-input border border-line rounded-lg px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors">
                          <span className="text-xs text-dim mr-1">Rp</span>
                          <input
                            type="number"
                            defaultValue={item.price || 0}
                            onBlur={async (e) => {
                              const val = parseFloat(e.target.value);
                              if (isNaN(val) || val === item.price) return;
                              try {
                                await setItemPrice(item.id, item.base_unit_id || 'base', 'regular', val);
                              } catch (err) {
                                toast.error('Gagal update harga retail: ' + err);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-full bg-transparent border-none outline-none text-xs font-semibold text-heading p-0 text-right tnum"
                          />
                        </div>
                      ) : (
                        <span className="font-semibold text-xs text-heading tnum">
                          Rp {(item.price || 0).toLocaleString('id-ID')}
                        </span>
                      )}
                    </td>

                    <td className="py-2 px-3.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {item.price_tiers && item.price_tiers.length > 0 ? (
                          item.price_tiers.map((t) => (
                            <span
                              key={t.id || t.tier_level}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-muted text-heading border border-line tnum"
                              title={`Tier ${t.tier_level}: Maks ${t.max_qty} @ Rp ${t.price.toLocaleString('id-ID')}`}
                            >
                              <span className="text-dim">≤{t.max_qty}</span>
                              <span>Rp {t.price.toLocaleString('id-ID')}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-dim">-</span>
                        )}
                        {can('items.change_price') && (
                          <button
                            type="button"
                            onClick={() => onEditItem(item.id)}
                            className="p-1 text-dim hover:text-heading hover:bg-muted rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Atur Tier Harga"
                            aria-label="Atur Tier Harga"
                          >
                            <Edit size={12} />
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3.5 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${
                          item.is_active
                            ? 'bg-success-soft text-success'
                            : 'bg-muted text-dim border border-line'
                        }`}
                      >
                        {item.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>

                    <td className="py-2.5 px-3.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onViewItem(item.id)}
                          className="p-1.5 text-dim hover:text-heading hover:bg-muted rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title="Lihat Detail"
                          aria-label="Lihat Detail"
                        >
                          <Eye size={15} />
                        </button>
                        {can('items.edit') && (
                          <button
                            type="button"
                            onClick={() => onEditItem(item.id)}
                            className="p-1.5 text-dim hover:text-heading hover:bg-muted rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Edit Produk"
                            aria-label="Edit Produk"
                          >
                            <Edit size={15} />
                          </button>
                        )}
                        {can('items.delete') && (
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-dim hover:text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Nonaktifkan"
                            aria-label="Nonaktifkan"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-3.5 py-2.5 border-t border-line flex flex-col sm:flex-row justify-between items-center gap-2 bg-muted/40">
          <p className="text-xs text-dim tnum">
            {items.length} dari {total} produk (Hal. {page}/{totalPages})
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || items.length === 0}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      </div>

      <TourGuide steps={inventoryTourSteps} run={runTour} onFinish={() => setRunTour(false)} />
      {deleteTargetId && (
        <ConfirmModal
          title="Nonaktifkan Produk"
          message="Produk yang dinonaktifkan tidak akan tampil di katalog kasir."
          confirmLabel="Nonaktifkan"
          variant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
}
