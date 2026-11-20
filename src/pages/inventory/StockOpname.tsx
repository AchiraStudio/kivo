import { useState, useEffect } from 'react';
import {
  getStockOverview,
  StockOverviewRow,
  createOpnameSession,
  submitOpnameLines,
  finalizeOpname,
  getItemsFiltered,
} from '../../lib/api';
import { useAuthStore } from '../../store/AuthStore';
import {
  Search,
  Save,
  Loader2,
  ClipboardList,
  HelpCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  RefreshCw,
  Filter,
  AlertCircle,
  X,
} from 'lucide-react';
import TourGuide from '../../components/ui/TourGuide';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { toast } from '../../components/ui/Toast';

export default function StockOpname() {
  const DEFAULT_BRANCH = 'branch_001';
  const { user } = useAuthStore();

  const [items, setItems] = useState<StockOverviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyDiffFilter, setOnlyDiffFilter] = useState(false);

  const [actualQty, setActualQty] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [pendingSubmitLines, setPendingSubmitLines] = useState<{ item_id: string; unit_id: string; actual_qty: number; notes: string }[] | null>(null);

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkQtyInput, setBulkQtyInput] = useState('');

  const [runTour, setRunTour] = useState(false);
  const opnameTourSteps = [
    {
      target: '.tour-so-table',
      content: 'Di sini Anda dapat melihat perbandingan antara stok di sistem dan stok fisik.',
      disableBeacon: true,
    },
    {
      target: '.tour-so-physical',
      content: 'Isi kolom Stok Fisik sesuai jumlah barang yang sebenarnya ada di toko. Jika dikosongkan, item tidak akan disesuaikan.',
    },
    {
      target: '.tour-so-notes',
      content: 'Tambahkan keterangan jika ada selisih, misalnya "Barang rusak" atau "Hilang".',
    },
    {
      target: '.tour-so-process',
      content: 'Setelah selesai mengisi stok fisik, klik Proses Penyesuaian untuk menyimpan perubahan ke sistem.',
    },
  ];

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await getItemsFiltered('', '', '', true, 1, 9999);
      const data = await getStockOverview(DEFAULT_BRANCH);
      setItems(data);
      setActualQty({});
      setNotes({});
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleStepperChange = (itemId: string, currentSysQty: number, delta: number) => {
    setActualQty((prev) => {
      const currentVal = prev[itemId] !== undefined ? prev[itemId] : currentSysQty;
      const newVal = Math.max(0, currentVal + delta);
      return { ...prev, [itemId]: newVal };
    });
  };

  const handleMatchButtonClick = (itemId: string, currentSysQty: number) => {
    setActualQty((prev) => ({ ...prev, [itemId]: currentSysQty }));
  };

  const handleResetAll = () => {
    if (Object.keys(actualQty).length === 0) return;
    setConfirmResetOpen(true);
  };

  const confirmResetAll = () => {
    setActualQty({});
    setNotes({});
    setConfirmResetOpen(false);
  };

  const countedItems = items.filter((i) => actualQty[i.item_id] !== undefined);
  const matchCount = countedItems.filter((i) => actualQty[i.item_id] === i.current_qty).length;
  const surplusItems = countedItems.filter((i) => actualQty[i.item_id] > i.current_qty);
  const deficitItems = countedItems.filter((i) => actualQty[i.item_id] < i.current_qty);

  const totalSurplusQty = surplusItems.reduce((sum, i) => sum + (actualQty[i.item_id] - i.current_qty), 0);
  const totalDeficitQty = deficitItems.reduce((sum, i) => sum + (i.current_qty - actualQty[i.item_id]), 0);

  const filteredItems = items.filter((i) => {
    const matchesSearch =
      i.item_name.toLowerCase().includes(search.toLowerCase()) ||
      (i.sku && i.sku.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (!onlyDiffFilter) return true;

    const aq = actualQty[i.item_id];
    if (aq === undefined) return false;
    return aq !== i.current_qty;
  });

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map((i) => i.item_id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItems(next);
  };

  const applyBulkQty = () => {
    if (selectedItems.size === 0) return toast.info('Pilih minimal satu item.');
    const val = parseFloat(bulkQtyInput);
    if (isNaN(val)) return toast.info('Masukkan angka yang valid.');

    setActualQty((prev) => {
      const next = { ...prev };
      selectedItems.forEach((id) => {
        next[id] = val;
      });
      return next;
    });
    setBulkQtyInput('');
  };

  const handleSubmit = async () => {
    const enteredLines = items
      .filter((i) => actualQty[i.item_id] !== undefined)
      .map((i) => ({
        item_id: i.item_id,
        unit_id: i.unit_id || '',
        actual_qty: actualQty[i.item_id],
        notes: notes[i.item_id] || '',
      }));

    if (enteredLines.length === 0) {
      toast.info('Belum ada stok fisik yang diisi.');
      return;
    }

    const changedLines = enteredLines.filter((l) => {
      const sys = items.find((i) => i.item_id === l.item_id)?.current_qty ?? 0;
      return l.actual_qty !== sys;
    });

    if (changedLines.length === 0) {
      toast.info('Semua stok fisik sesuai dengan stok sistem.');
      return;
    }

    setPendingSubmitLines(changedLines);
  };

  const confirmSubmitOpname = async () => {
    if (!pendingSubmitLines || pendingSubmitLines.length === 0) return;
    const changedLines = pendingSubmitLines;
    setPendingSubmitLines(null);
    setSubmitting(true);

    try {
      const sessionId = await createOpnameSession(DEFAULT_BRANCH, user?.id, 'Routine Opname');
      await submitOpnameLines(sessionId, changedLines);
      await finalizeOpname(sessionId);

      toast.success(`Stock Opname selesai. ${changedLines.length} item disesuaikan.`);
      fetchStock();
    } catch (e: any) {
      toast.error('Gagal memproses stock opname: ' + e.toString());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in w-full h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-heading tracking-tight">Stock Opname</h1>
          <span className="px-2 py-0.5 rounded-full bg-muted text-dim text-xs font-semibold border border-line tnum">
            {items.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
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
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
            disabled={countedItems.length === 0}
            className="tour-so-process tnum"
          >
            {!submitting && <Save size={14} />}
            Proses Penyesuaian ({countedItems.length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="bg-card rounded-xl border border-line p-3.5 space-y-1">
          <div className="flex items-center justify-between text-dim">
            <span className="text-xs font-medium">Dihitung</span>
            <ClipboardList size={15} className="text-dim" />
          </div>
          <p className="text-xl font-bold text-heading tnum">
            {countedItems.length}{' '}
            <span className="text-xs font-medium text-dim">/ {items.length}</span>
          </p>
        </div>

        <div className="bg-card rounded-xl border border-line p-3.5 space-y-1">
          <div className="flex items-center justify-between text-dim">
            <span className="text-xs font-medium">Sesuai</span>
            <CheckCircle2 size={15} className="text-success" />
          </div>
          <p className="text-xl font-bold text-success tnum">
            {matchCount} <span className="text-xs font-medium text-dim">item</span>
          </p>
        </div>

        <div className="bg-card rounded-xl border border-line p-3.5 space-y-1">
          <div className="flex items-center justify-between text-dim">
            <span className="text-xs font-medium">Surplus</span>
            <TrendingUp size={15} className="text-success" />
          </div>
          <p className="text-xl font-bold text-success tnum">
            +{totalSurplusQty}{' '}
            <span className="text-xs font-medium text-dim">({surplusItems.length})</span>
          </p>
        </div>

        <div className="bg-card rounded-xl border border-line p-3.5 space-y-1">
          <div className="flex items-center justify-between text-dim">
            <span className="text-xs font-medium">Defisit</span>
            <TrendingDown size={15} className="text-danger" />
          </div>
          <p className="text-xl font-bold text-danger tnum">
            -{totalDeficitQty}{' '}
            <span className="text-xs font-medium text-dim">({deficitItems.length})</span>
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-line overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="p-3 border-b border-line flex flex-col gap-2.5 bg-muted/40">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex-1 flex items-center h-9 bg-input border border-line rounded-lg px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors">
              <Search size={15} className="text-dim mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Cari nama produk atau SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none w-full text-sm text-heading"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="p-1 text-dim hover:text-heading cursor-pointer rounded-md"
                  aria-label="Hapus pencarian"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant={onlyDiffFilter ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setOnlyDiffFilter(!onlyDiffFilter)}
                className={onlyDiffFilter ? 'border-warning text-warning bg-warning-soft hover:bg-warning-soft' : ''}
              >
                <Filter size={13} />
                Hanya Selisih {onlyDiffFilter && `(${surplusItems.length + deficitItems.length})`}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetAll}
                disabled={Object.keys(actualQty).length === 0}
                className="px-2.5"
                title="Reset Input"
                aria-label="Reset semua input"
              >
                <RefreshCw size={14} />
              </Button>
            </div>
          </div>

          {selectedItems.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line">
              <span className="text-xs font-semibold text-heading tnum">
                {selectedItems.size} terpilih
              </span>
              <input
                type="number"
                placeholder="Set qty..."
                value={bulkQtyInput}
                onChange={(e) => setBulkQtyInput(e.target.value)}
                className="w-24 h-8 text-xs bg-input border border-line rounded-lg px-2.5 text-heading tnum outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <Button type="button" variant="secondary" size="sm" onClick={applyBulkQty}>
                Terapkan Qty
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar tour-so-table relative">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-dim">
              <Loader2 size={22} className="animate-spin mb-2 text-primary" />
              <p className="text-xs font-medium">Memuat data stok...</p>
            </div>
          ) : errorMsg ? (
            <div className="py-14 text-center">
              <AlertCircle size={22} className="mx-auto text-danger mb-2" />
              <p className="text-sm font-semibold text-heading">Gagal memuat data opname</p>
              <p className="text-xs text-dim mt-0.5 mb-3">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={fetchStock}>
                Coba Lagi
              </Button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-sm text-dim">
              Tidak ada barang yang sesuai filter.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted border-b border-line text-dim font-semibold sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-line-strong text-primary focus:ring-primary cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-4">Produk</th>
                  <th className="py-2.5 px-4 text-right">Stok Sistem</th>
                  <th className="py-2.5 px-4 text-center tour-so-physical">Stok Fisik</th>
                  <th className="py-2.5 px-4 text-center">Selisih</th>
                  <th className="py-2.5 px-4 tour-so-notes">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredItems.map((item) => {
                  const hasInput = actualQty[item.item_id] !== undefined;
                  const aq = hasInput ? actualQty[item.item_id] : item.current_qty;
                  const diff = aq - item.current_qty;

                  const isSurplus = hasInput && diff > 0;
                  const isDeficit = hasInput && diff < 0;

                  return (
                    <tr
                      key={item.item_id}
                      className={`transition-colors fast-render-row ${
                        isSurplus
                          ? 'bg-success-soft/35'
                          : isDeficit
                          ? 'bg-danger-soft/35'
                          : 'hover:bg-muted/40'
                      }`}
                    >
                      <td className="py-2.5 px-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.item_id)}
                          onChange={() => toggleSelect(item.item_id)}
                          className="w-4 h-4 rounded border-line-strong text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>

                      <td className="py-2.5 px-4">
                        <p className="font-semibold text-heading text-sm truncate">{item.item_name}</p>
                        <p className="text-[11px] text-dim font-mono mt-0.5">
                          {item.sku || '-'} {item.category_name ? `| ${item.category_name}` : ''}
                        </p>
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-heading tnum whitespace-nowrap">
                        {item.current_qty}{' '}
                        <span className="text-dim font-normal">{item.unit_name || 'PCS'}</span>
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStepperChange(item.item_id, item.current_qty, -1)}
                            className="w-8 h-8 bg-muted hover:bg-muted-hover text-heading border border-line rounded-lg flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Kurangi 1"
                            aria-label="Kurangi 1"
                          >
                            <Minus size={12} />
                          </button>

                          <input
                            type="number"
                            value={actualQty[item.item_id] === undefined ? '' : actualQty[item.item_id]}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setActualQty((prev) => {
                                  const copy = { ...prev };
                                  delete copy[item.item_id];
                                  return copy;
                                });
                              } else {
                                setActualQty((prev) => ({
                                  ...prev,
                                  [item.item_id]: parseFloat(val) || 0,
                                }));
                              }
                            }}
                            placeholder={String(item.current_qty)}
                            className="w-20 h-8 text-center font-semibold font-mono border border-line bg-input rounded-lg px-2 text-xs text-heading tnum outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />

                          <button
                            type="button"
                            onClick={() => handleStepperChange(item.item_id, item.current_qty, 1)}
                            className="w-8 h-8 bg-muted hover:bg-muted-hover text-heading border border-line rounded-lg flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Tambah 1"
                            aria-label="Tambah 1"
                          >
                            <Plus size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMatchButtonClick(item.item_id, item.current_qty)}
                            className="h-8 px-2 bg-card hover:bg-muted border border-line rounded-lg text-[11px] font-semibold text-body hover:text-heading transition-colors cursor-pointer ml-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Samakan dengan stok sistem"
                          >
                            Sesuai
                          </button>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        {!hasInput ? (
                          <span className="text-xs text-dim">-</span>
                        ) : (
                          <span
                            className={`inline-flex items-center font-mono font-bold text-xs px-2 py-0.5 rounded-md tnum ${
                              diff > 0
                                ? 'bg-success-soft text-success'
                                : diff < 0
                                ? 'bg-danger-soft text-danger'
                                : 'bg-muted text-dim border border-line'
                            }`}
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 min-w-[180px]">
                        <input
                          type="text"
                          placeholder={hasInput ? 'Alasan selisih...' : '-'}
                          value={notes[item.item_id] || ''}
                          onChange={(e) =>
                            setNotes((prev) => ({ ...prev, [item.item_id]: e.target.value }))
                          }
                          disabled={!hasInput}
                          className="w-full h-8 border border-line bg-input rounded-lg px-2.5 text-xs text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-45 disabled:cursor-not-allowed"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <TourGuide steps={opnameTourSteps} run={runTour} onFinish={() => setRunTour(false)} />
      {confirmResetOpen && (
        <ConfirmModal
          title="Reset Input Opname"
          message="Semua angka stok fisik yang sudah diisi akan dikosongkan."
          confirmLabel="Reset"
          variant="warning"
          onConfirm={confirmResetAll}
          onCancel={() => setConfirmResetOpen(false)}
        />
      )}
      {pendingSubmitLines && (
        <ConfirmModal
          title="Proses Stock Opname"
          message={`${pendingSubmitLines.length} item akan disesuaikan stoknya secara permanen.`}
          confirmLabel="Proses"
          variant="primary"
          loading={submitting}
          onConfirm={confirmSubmitOpname}
          onCancel={() => setPendingSubmitLines(null)}
        />
      )}
    </div>
  );
}
