import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Search,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  X,
} from 'lucide-react';
import { open, save } from '@tauri-apps/plugin-dialog';
import {
  receiveGoodsDirect,
  ReceiveLineInput,
  getSuppliers,
  Supplier,
  getItemsFiltered,
  getItem,
  Item,
  ItemUnit,
  exportReceiveTemplate,
  parseReceiveExcel,
} from '../../lib/api';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';

interface DirectReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId: string;
}

interface DirectLine {
  id: string;
  item_id: string;
  item_name: string;
  unit_id: string;
  unit_name: string;
  available_units: ItemUnit[];
  qty_received: number;
  price_per_unit: number;
  batch_no: string;
  expiry_date: string;
}

const createEmptyLine = (): DirectLine => ({
  id: Math.random().toString(),
  item_id: '',
  item_name: '',
  unit_id: '',
  unit_name: '',
  available_units: [],
  qty_received: 1,
  price_per_unit: 0,
  batch_no: '',
  expiry_date: '',
});

const CELL_INPUT_CLASS =
  'h-8 w-full rounded-lg border border-line bg-input px-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function DirectReceiveModal({
  isOpen,
  onClose,
  onSuccess,
  branchId,
}: DirectReceiveModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [lines, setLines] = useState<DirectLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [isExportingTemplate, setIsExportingTemplate] = useState(false);

  // Item Search Popup State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeLineIdForSearch, setActiveLineIdForSearch] = useState<string | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const anchorElRef = useRef<HTMLElement | null>(null);

  const closeSearchPopup = useCallback(() => {
    setActiveLineIdForSearch(null);
    setPopupPos(null);
    setSearchQuery('');
    setSearchResults([]);
    anchorElRef.current = null;
  }, []);

  const updatePopupPos = useCallback(() => {
    const anchor = anchorElRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.max(rect.width, 300);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const estimatedHeight = 250;
    const top =
      spaceBelow < estimatedHeight && rect.top > spaceBelow
        ? Math.max(8, rect.top - estimatedHeight - 4)
        : rect.bottom + 4;
    setPopupPos({ top, left, width });
  }, []);

  const openSearchPopup = (lineId: string, anchor: HTMLElement) => {
    anchorElRef.current = anchor;
    setActiveLineIdForSearch(lineId);
    setSearchQuery('');
    setSearchResults([]);
    const rect = anchor.getBoundingClientRect();
    const width = Math.max(rect.width, 300);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const estimatedHeight = 250;
    const top =
      spaceBelow < estimatedHeight && rect.top > spaceBelow
        ? Math.max(8, rect.top - estimatedHeight - 4)
        : rect.bottom + 4;
    setPopupPos({ top, left, width });
  };

  useEffect(() => {
    if (!activeLineIdForSearch) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !popupRef.current?.contains(target) &&
        !anchorElRef.current?.contains(target)
      ) {
        closeSearchPopup();
      }
    };
    const onReflow = () => updatePopupPos();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [activeLineIdForSearch, closeSearchPopup, updatePopupPos]);

  useEffect(() => {
    if (isOpen) {
      getSuppliers('', true).then(setSuppliers).catch(console.error);
      setSelectedSupplierId('');
      setInvoiceNo('');
      setLines([createEmptyLine()]);
      closeSearchPopup();
    }
  }, [isOpen, closeSearchPopup]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        getItemsFiltered(searchQuery, '', '', true, 1, 10)
          .then((res) => setSearchResults(res.items))
          .catch(console.error)
          .finally(() => setIsSearching(false));
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleSelectItem = async (lineId: string, item: Item) => {
    try {
      const detail = await getItem(item.id);
      const units = detail.units || [];
      const baseUnit = units.find((u) => u.is_base === 1) || units[0];

      setLines((prev) =>
        prev.map((l) => {
          if (l.id === lineId) {
            return {
              ...l,
              item_id: item.id,
              item_name: item.name,
              unit_id: baseUnit ? baseUnit.id : '',
              unit_name: baseUnit ? baseUnit.unit_name : 'PCS',
              available_units: units,
              price_per_unit: detail.item.cost_price || detail.item.avg_hpp || 0,
            };
          }
          return l;
        }),
      );
    } catch (e) {
      console.error(e);
    } finally {
      closeSearchPopup();
    }
  };

  const handleUnitChange = (lineId: string, unitId: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id === lineId) {
          const unit = l.available_units.find((u) => u.id === unitId);
          return {
            ...l,
            unit_id: unitId,
            unit_name: unit ? unit.unit_name : l.unit_name,
          };
        }
        return l;
      }),
    );
  };

  const updateLine = (id: string, field: keyof DirectLine, value: any) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()]);
  };

  const removeLine = (id: string) => {
    if (lines.length === 1) {
      setLines([createEmptyLine()]);
    } else {
      setLines((prev) => prev.filter((l) => l.id !== id));
    }
  };

  // --- Excel Actions ---
  const handleDownloadTemplate = async () => {
    setIsExportingTemplate(true);
    try {
      const filePath = await save({
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        defaultPath: 'Template_Penerimaan_Barang.xlsx',
      });
      if (!filePath) return;

      await exportReceiveTemplate(filePath);
      toast.success('Template Excel berhasil diunduh.');
    } catch (e) {
      console.error(e);
      toast.error(`Gagal mengunduh template: ${e}`);
    } finally {
      setIsExportingTemplate(false);
    }
  };

  const handleImportExcel = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
      });
      if (!selected) return;
      const filePath = Array.isArray(selected) ? selected[0] : selected;
      if (!filePath) return;

      setIsParsingExcel(true);
      const parsedItems = await parseReceiveExcel(filePath);
      if (parsedItems.length === 0) {
        return toast.info('File Excel tidak berisi data yang valid.');
      }

      const newLines: DirectLine[] = await Promise.all(
        parsedItems.map(async (p) => {
          let available_units: ItemUnit[] = [];
          if (p.item_id) {
            try {
              const detail = await getItem(p.item_id);
              available_units = detail.units || [];
            } catch (_) {}
          }
          return {
            id: Math.random().toString(),
            item_id: p.item_id,
            item_name: p.item_name,
            unit_id: p.unit_id,
            unit_name: p.unit_name,
            available_units,
            qty_received: p.qty_received,
            price_per_unit: p.price_per_unit,
            batch_no: p.batch_no,
            expiry_date: p.expiry_date,
          };
        }),
      );

      setLines(newLines);

      const unmatchedCount = parsedItems.filter((p) => !p.matched).length;
      if (unmatchedCount > 0) {
        toast.warning(
          `${parsedItems.length} baris dimuat. ${unmatchedCount} barang belum cocok dengan data master.`,
        );
      } else {
        toast.success(`${parsedItems.length} baris berhasil dimuat dari Excel.`);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Gagal memproses Excel: ${err}`);
    } finally {
      setIsParsingExcel(false);
    }
  };

  const totalAmount = lines.reduce(
    (sum, l) => sum + (l.qty_received > 0 ? l.qty_received * l.price_per_unit : 0),
    0,
  );
  const totalQty = lines.reduce((sum, l) => sum + (l.qty_received > 0 ? l.qty_received : 0), 0);

  const handleSubmit = async () => {
    if (!selectedSupplierId) {
      return toast.info('Pilih pemasok terlebih dahulu.');
    }

    const validLines = lines.filter((l) => l.item_id && l.qty_received > 0);
    if (validLines.length === 0) {
      return toast.info('Pilih minimal satu barang dengan jumlah lebih dari 0.');
    }

    setIsSubmitting(true);
    try {
      const payload: ReceiveLineInput[] = validLines.map((l) => ({
        item_id: l.item_id,
        unit_id: l.unit_id,
        qty_received: Number(l.qty_received),
        price_per_unit: Number(l.price_per_unit),
        batch_no: l.batch_no.trim() || undefined,
        expiry_date: l.expiry_date.trim() || undefined,
      }));

      await receiveGoodsDirect(branchId, selectedSupplierId, invoiceNo.trim() || null, payload);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error('Gagal memproses penerimaan barang: ' + (e?.message || e));
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
      title="Terima Barang Masuk"
      icon={CheckCircle2}
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-dim">Total Qty</p>
              <p className="text-sm font-bold text-heading tnum">{totalQty} unit</p>
            </div>
            <div className="h-7 w-px bg-line" />
            <div>
              <p className="text-xs text-dim">Total Faktur</p>
              <p className="text-sm font-bold text-heading tnum">
                Rp {totalAmount.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="button" variant="primary" onClick={handleSubmit} loading={isSubmitting}>
              {!isSubmitting && <CheckCircle2 size={15} />}
              Simpan Penerimaan
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
              value={selectedSupplierId}
              onChange={setSelectedSupplierId}
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
            <label className="block text-xs font-semibold text-body mb-1.5">
              No. Faktur / Surat Jalan
            </label>
            <input
              type="text"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="Contoh: INV-KF-2026-881"
              className="h-9 w-full rounded-lg border border-line bg-input px-3 text-sm font-mono text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
            />
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-heading tnum">
              Daftar Barang ({lines.length})
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                loading={isExportingTemplate}
              >
                {!isExportingTemplate && <Download size={14} />}
                Template Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleImportExcel}
                loading={isParsingExcel}
              >
                {!isParsingExcel && <FileSpreadsheet size={14} />}
                Import Excel
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus size={14} />
                Tambah Baris
              </Button>
            </div>
          </div>

          <div className="border border-line rounded-xl overflow-x-auto bg-card">
            <table className="w-full text-left text-xs border-collapse min-w-[780px]">
              <thead className="bg-muted border-b border-line text-dim font-semibold">
                <tr>
                  <th className="py-2.5 px-2.5 w-8 text-center">#</th>
                  <th className="py-2.5 px-2.5">Barang</th>
                  <th className="py-2.5 px-2.5 w-28">Satuan</th>
                  <th className="py-2.5 px-2.5 w-20 text-center">Qty</th>
                  <th className="py-2.5 px-2.5 w-32 text-right">Harga Beli</th>
                  <th className="py-2.5 px-2.5 w-28">No. Batch</th>
                  <th className="py-2.5 px-2.5 w-32">Kadaluarsa</th>
                  <th className="py-2.5 px-2.5 w-28 text-right">Subtotal</th>
                  <th className="py-2.5 px-2 w-9" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((line, idx) => {
                  const lineSubtotal = line.qty_received * line.price_per_unit;
                  const isUnmatched = !line.item_id;

                  return (
                    <tr key={line.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2 px-2.5 text-center text-dim tnum">{idx + 1}</td>

                      <td className="py-2 px-2.5 min-w-[200px]">
                        {line.item_id ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-heading truncate">
                              {line.item_name}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => openSearchPopup(line.id, e.currentTarget)}
                              className="text-xs font-semibold text-primary hover:underline shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                            >
                              Ganti
                            </button>
                          </div>
                        ) : (
                          <div>
                            <button
                              type="button"
                              onClick={(e) => openSearchPopup(line.id, e.currentTarget)}
                              className="h-8 w-full text-left px-2.5 rounded-lg border border-dashed border-line-strong bg-input text-dim hover:border-primary hover:text-heading flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <span className="truncate">{line.item_name || 'Cari barang...'}</span>
                              <Search size={13} className="shrink-0" />
                            </button>
                            {isUnmatched && line.item_name && (
                              <p className="text-[11px] text-warning font-medium mt-1 flex items-center gap-1">
                                <AlertTriangle size={11} className="shrink-0" />
                                Belum cocok di master
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-2">
                        {line.available_units.length > 0 ? (
                          <Select
                            size="sm"
                            value={line.unit_id}
                            onChange={(v) => handleUnitChange(line.id, v)}
                            ariaLabel="Satuan"
                          >
                            {line.available_units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.unit_name}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <input
                            type="text"
                            value={line.unit_name || 'PCS'}
                            onChange={(e) => updateLine(line.id, 'unit_name', e.target.value)}
                            className={`${CELL_INPUT_CLASS} font-medium`}
                          />
                        )}
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="1"
                          value={line.qty_received || ''}
                          onChange={(e) =>
                            updateLine(line.id, 'qty_received', parseFloat(e.target.value) || 0)
                          }
                          className={`${CELL_INPUT_CLASS} text-center font-semibold tnum`}
                        />
                      </td>

                      <td className="py-2 px-2">
                        <div className="h-8 flex items-center rounded-lg border border-line bg-input px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors">
                          <span className="text-[11px] text-dim mr-1 select-none">Rp</span>
                          <input
                            type="number"
                            min="0"
                            value={line.price_per_unit || ''}
                            onChange={(e) =>
                              updateLine(line.id, 'price_per_unit', parseFloat(e.target.value) || 0)
                            }
                            className="w-full bg-transparent border-none outline-none text-right font-semibold text-xs text-heading tnum p-0"
                          />
                        </div>
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="text"
                          placeholder="No. batch"
                          value={line.batch_no}
                          onChange={(e) => updateLine(line.id, 'batch_no', e.target.value)}
                          className={`${CELL_INPUT_CLASS} font-mono`}
                        />
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="date"
                          value={line.expiry_date}
                          onChange={(e) => updateLine(line.id, 'expiry_date', e.target.value)}
                          className={CELL_INPUT_CLASS}
                        />
                      </td>

                      <td className="py-2 px-2.5 text-right font-semibold text-heading tnum">
                        Rp {lineSubtotal.toLocaleString('id-ID')}
                      </td>

                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          aria-label="Hapus baris"
                          className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-dim hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {activeLineIdForSearch &&
        popupPos &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: 'fixed',
              top: popupPos.top,
              left: popupPos.left,
              width: popupPos.width,
            }}
            className="z-[1200] bg-elevated border border-line rounded-lg shadow-lg shadow-black/15 dark:shadow-black/45 p-1 animate-pop-in"
          >
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-line">
              <Search size={14} className="text-dim shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Ketik nama barang atau SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    closeSearchPopup();
                  }
                }}
                className="w-full bg-transparent text-xs text-heading outline-none"
              />
              <button
                type="button"
                onClick={closeSearchPopup}
                aria-label="Tutup pencarian"
                className="text-dim hover:text-heading rounded-md p-0.5 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto custom-scrollbar pt-1 space-y-0.5">
              {isSearching ? (
                <div className="py-4 text-center text-xs text-dim flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Mencari barang...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-4 text-center text-xs text-dim">
                  {searchQuery.trim().length < 2
                    ? 'Ketik minimal 2 huruf.'
                    : 'Barang tidak ditemukan.'}
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectItem(activeLineIdForSearch, item)}
                    className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-muted flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-heading text-xs truncate">{item.name}</p>
                      <p className="text-[11px] text-dim font-mono truncate">{item.sku}</p>
                    </div>
                    <span className="text-xs font-semibold text-primary shrink-0">Pilih</span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </Modal>
  );
}
