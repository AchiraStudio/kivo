import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScanBarcode,
  Search,
  Link2,
  PackagePlus,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Keyboard,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import BarcodeCameraModal from '../../components/ui/BarcodeCameraModal';
import { toast } from '../../components/ui/Toast';
import { useBarcodeScanner, playScanBeep } from '../../hooks/useBarcodeScanner';
import { useDebounce } from '../../lib/hooks/useDebounce';
import { usePermissions } from '../../lib/permissions';
import { toRegistrationCode } from '../../lib/barcode';
import { findItemByScan } from '../../lib/itemLookup';
import {
  addItem,
  addItemUnit,
  deleteItem,
  getCategories,
  getItem,
  getItemsFiltered,
  setItemPrice,
  updateItem,
  Category,
  Item,
} from '../../lib/api';

interface RapidRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Barcode to start with (e.g. from an unknown scan at the cashier). */
  initialBarcode?: string | null;
  /** Called after a product was created or a barcode was assigned, so lists can refresh. */
  onChanged: () => void;
  /** Hand the barcode to the full product form instead. */
  onOpenFullForm?: (barcode: string) => void;
}

type Mode = 'assign' | 'create';

interface LogEntry {
  id: number;
  kind: 'assigned' | 'created';
  name: string;
  code: string;
}

const rupiah = (n?: number | null) => `Rp ${(n || 0).toLocaleString('id-ID')}`;

/** Pick a SKU that is not taken yet, in the same MED-#### style as the product form. */
async function uniqueSku(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const sku = `MED-${Math.floor(1000 + Math.random() * 9000)}`;
    const taken = await findItemByScan({ raw: sku, gs1: null, candidates: [sku] }, { activeOnly: false });
    if (!taken) return sku;
  }
  return `MED-${Date.now().toString(36).toUpperCase()}`;
}

export default function RapidRegisterModal({
  isOpen,
  onClose,
  initialBarcode,
  onChanged,
  onOpenFullForm,
}: RapidRegisterModalProps) {
  const { can } = usePermissions();
  const canAssign = can('items.edit');
  const canCreate = can('items.create');

  const [code, setCode] = useState<string | null>(null);
  const [owner, setOwner] = useState<Item | null>(null);
  const [mode, setMode] = useState<Mode>('assign');
  const [manualCode, setManualCode] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logId = useRef(1);

  // Assign-to-existing state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 220);
  const [results, setResults] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const searchReq = useRef(0);

  // Create-new state (category and unit are remembered between products)
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [categoryId, setCategoryId] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setSearch('');
    setResults([]);
    setConfirmId(null);
    setName('');
    setPrice('');
    setCost('');
  };

  const acceptCode = async (raw: string) => {
    const next = toRegistrationCode(raw);
    if (!next) return;

    // Same lookup the cashier uses, so "already registered" here means "would scan fine there".
    const existing = await findItemByScan(raw, { activeOnly: false }).catch(() => null);
    if (existing) {
      playScanBeep(false);
      setCode(next);
      setOwner(existing);
      return;
    }

    playScanBeep(true);
    setOwner(null);
    if (next !== code) resetForm();
    setCode(next);
  };

  const finish = (entry: Omit<LogEntry, 'id'>) => {
    setLog((prev) => [{ ...entry, id: logId.current++ }, ...prev].slice(0, 30));
    setCode(null);
    setOwner(null);
    resetForm();
    onChanged();
    window.dispatchEvent(new Event('kivo:sync'));
  };

  // Reset when opened; if a barcode was handed in, start with it.
  useEffect(() => {
    if (!isOpen) return;
    setCode(null);
    setOwner(null);
    setManualCode('');
    setLog([]);
    resetForm();
    setMode(canAssign ? 'assign' : 'create');
    getCategories().then(setCategories).catch(console.error);
    if (initialBarcode) acceptCode(initialBarcode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Hardware scanner: scans always mean "next barcode", even while a field has focus.
  useBarcodeScanner(acceptCode, {
    enabled: isOpen && !showCamera,
    allowInInputs: true,
    playBeep: false,
  });

  // The camera restarts whenever its callbacks change identity, so keep them stable.
  const acceptCodeRef = useRef(acceptCode);
  acceptCodeRef.current = acceptCode;
  const handleCameraDetected = useCallback((value: string) => {
    acceptCodeRef.current(value);
  }, []);
  const closeCamera = useCallback(() => setShowCamera(false), []);

  // Search existing products by name / SKU as the user types.
  useEffect(() => {
    if (!isOpen || !code || mode !== 'assign') return;
    const q = debouncedSearch.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    const req = ++searchReq.current;
    setSearching(true);
    getItemsFiltered(q, '', '', false, 1, 10)
      .then((res) => {
        if (req === searchReq.current) setResults(res.items);
      })
      .catch(console.error)
      .finally(() => {
        if (req === searchReq.current) setSearching(false);
      });
  }, [debouncedSearch, code, mode, isOpen]);

  // Put the cursor where the next keystrokes belong.
  useEffect(() => {
    if (!isOpen || !code || owner) return;
    const t = setTimeout(() => (mode === 'assign' ? searchRef : nameRef).current?.focus(), 60);
    return () => clearTimeout(t);
  }, [isOpen, code, owner, mode]);

  const assign = async (target: Item) => {
    if (!code || busy) return;
    setBusy(true);
    try {
      // Re-read the full record so the update only changes the barcode.
      const { item } = await getItem(target.id);
      await updateItem(item.id, { ...item, barcode: code });
      toast.success('Barcode dipasangkan', `${item.name} ← ${code}`);
      finish({ kind: 'assigned', name: item.name, code });
    } catch (e) {
      console.error(e);
      toast.error('Gagal memasangkan barcode', String(e));
    } finally {
      setBusy(false);
      setConfirmId(null);
    }
  };

  const create = async () => {
    if (!code || busy) return;
    const trimmed = name.trim();
    const sellPrice = Number(price);
    if (!trimmed) {
      toast.info('Nama produk wajib diisi.');
      nameRef.current?.focus();
      return;
    }
    if (!Number.isFinite(sellPrice) || sellPrice <= 0) {
      toast.info('Harga jual harus lebih dari 0.');
      priceRef.current?.focus();
      return;
    }

    setBusy(true);
    let createdId: string | null = null;
    let createdSku = '';
    try {
      createdSku = await uniqueSku();
      const item = await addItem({
        sku: createdSku,
        barcode: code,
        name: trimmed,
        category_id: categoryId || undefined,
        hpp_method: 'avg',
        min_stock: 10,
        has_expiry: 0,
        requires_prescription: 0,
        cost_price: Number(cost) || 0,
        item_type: 'INV',
        wholesale_price: 0,
      });
      createdId = item.id;

      const baseUnit = await addItemUnit(item.id, unit.trim() || 'PCS', 1, 1);
      await setItemPrice(item.id, baseUnit.id, 'regular', sellPrice);
      await setItemPrice(item.id, baseUnit.id, 'member', sellPrice);
      await setItemPrice(item.id, baseUnit.id, 'vip', sellPrice);

      toast.success('Produk baru dibuat', `${trimmed} · ${rupiah(sellPrice)}`);
      finish({ kind: 'created', name: trimmed, code });
    } catch (e) {
      console.error(e);
      // Don't leave a half-built product (no unit/price) holding on to the barcode.
      if (createdId) {
        await updateItem(createdId, {
          sku: createdSku,
          barcode: undefined,
          name: trimmed,
          hpp_method: 'avg',
          min_stock: 0,
          has_expiry: 0,
          requires_prescription: 0,
          wholesale_price: 0,
        }).catch(() => {});
        await deleteItem(createdId).catch(() => {});
      }
      toast.error('Gagal membuat produk', String(e));
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading placeholder:text-dim focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none';

  const registeredCount = log.length;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="2xl"
        title="Registrasi Cepat"
        subtitle="Scan barcode, lalu pasangkan ke produk yang ada atau buat produk baru"
        icon={ScanBarcode}
        badge={
          registeredCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full bg-success-soft text-success text-xs font-semibold tnum">
              {registeredCount} terdaftar
            </span>
          ) : undefined
        }
        footer={
          <div className="flex items-center justify-between gap-2 w-full">
            <div>
              {code && !owner && canCreate && onOpenFullForm && (
                <Button variant="ghost" size="sm" onClick={() => onOpenFullForm(code)}>
                  Buka form lengkap
                </Button>
              )}
            </div>
            <Button variant="primary" size="sm" onClick={onClose}>
              Selesai
            </Button>
          </div>
        }
      >
        {!canAssign && !canCreate ? (
          <p className="text-sm text-dim text-center py-8">
            Anda tidak memiliki izin untuk mendaftarkan atau mengubah produk.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Scan zone */}
            {!code ? (
              <div className="rounded-xl border-2 border-dashed border-line bg-muted/40 p-5 flex flex-col items-center gap-3 text-center">
                <div className="w-11 h-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                  <ScanBarcode size={22} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-heading">Menunggu scan barcode…</p>
                  <p className="text-xs text-dim mt-0.5">
                    Arahkan scanner ke produk. Scanner USB/Bluetooth, 1D maupun 2D (QR / DataMatrix).
                  </p>
                </div>
                <div className="flex items-center gap-1.5 w-full max-w-sm">
                  <div className="relative flex-1">
                    <Keyboard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && manualCode.trim()) {
                          e.preventDefault();
                          acceptCode(manualCode.trim());
                          setManualCode('');
                        }
                      }}
                      placeholder="atau ketik barcode lalu Enter"
                      className={`${inputCls} pl-9 font-mono`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    aria-label="Scan barcode dengan kamera"
                    title="Scan dengan kamera"
                    className="h-9 w-9 flex items-center justify-center rounded-lg border border-line bg-card hover:bg-muted text-dim hover:text-primary transition-colors cursor-pointer shrink-0"
                  >
                    <ScanBarcode size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5">
                <ScanBarcode size={16} className="text-primary shrink-0" />
                <span className="text-xs text-dim shrink-0">Barcode</span>
                <span className="font-mono text-sm font-semibold text-heading truncate" data-testid="rapid-code">
                  {code}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCode(null);
                    setOwner(null);
                    resetForm();
                  }}
                  aria-label="Batalkan barcode ini"
                  title="Batalkan, scan barcode lain"
                  className="ml-auto text-dim hover:text-heading p-1 rounded-md hover:bg-muted cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Already registered */}
            {code && owner && (
              <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning-soft px-3 py-2.5">
                <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-heading">Barcode ini sudah terdaftar</p>
                  <p className="text-body mt-0.5">
                    {owner.name} <span className="font-mono text-dim">({owner.sku})</span>
                    {owner.is_active === 0 && <span className="ml-1.5 text-xs text-danger font-semibold">nonaktif</span>}
                  </p>
                  <p className="text-xs text-dim mt-1">Scan barcode lain untuk melanjutkan.</p>
                </div>
              </div>
            )}

            {/* Assign / create */}
            {code && !owner && (
              <>
                {canAssign && canCreate && (
                  <div className="flex items-center bg-muted p-0.5 rounded-lg border border-line h-9 self-start">
                    {(
                      [
                        ['assign', 'Pasangkan ke produk yang ada', Link2],
                        ['create', 'Buat produk baru', PackagePlus],
                      ] as const
                    ).map(([id, label, Icon]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setMode(id)}
                        className={`px-3 h-full rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          mode === id ? 'bg-card text-heading border border-line' : 'text-dim hover:text-heading'
                        }`}
                      >
                        <Icon size={13} />
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {mode === 'assign' && canAssign && (
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
                      <input
                        ref={searchRef}
                        type="text"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setConfirmId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && results.length === 1 && !results[0].barcode) {
                            e.preventDefault();
                            assign(results[0]);
                          }
                        }}
                        placeholder="Cari nama atau SKU produk…"
                        className={`${inputCls} pl-9`}
                      />
                      {searching && (
                        <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-dim" />
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto custom-scrollbar" data-testid="rapid-results">
                      {search.trim() && !searching && results.length === 0 && (
                        <div className="text-center py-6 text-sm text-dim">
                          Produk tidak ditemukan.
                          {canCreate && (
                            <button
                              type="button"
                              onClick={() => {
                                setName(search.trim());
                                setMode('create');
                              }}
                              className="block mx-auto mt-1.5 text-primary font-semibold hover:underline cursor-pointer"
                            >
                              Buat “{search.trim()}” sebagai produk baru
                            </button>
                          )}
                        </div>
                      )}
                      {results.map((r) => {
                        const hasOther = Boolean(r.barcode);
                        const confirming = confirmId === r.id;
                        return (
                          <div
                            key={r.id}
                            className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2"
                            data-testid="rapid-result"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-heading truncate">
                                {r.name}
                                {r.is_active === 0 && <span className="ml-1.5 text-[11px] text-danger font-semibold">nonaktif</span>}
                              </p>
                              <p className="text-[11px] text-dim truncate">
                                <span className="font-mono">{r.sku}</span>
                                {r.category_name ? ` · ${r.category_name}` : ''} · {rupiah(r.price)}
                              </p>
                              <p className={`text-[11px] truncate ${hasOther ? 'text-warning' : 'text-success'}`}>
                                {hasOther ? `Sudah punya barcode: ${r.barcode}` : 'Belum punya barcode'}
                              </p>
                            </div>
                            {confirming ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[11px] text-warning font-semibold">Ganti barcode lama?</span>
                                <Button size="sm" variant="danger" loading={busy} onClick={() => assign(r)}>
                                  Ya, ganti
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>
                                  Batal
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant={hasOther ? 'outline' : 'primary'}
                                loading={busy && !hasOther}
                                onClick={() => (hasOther ? setConfirmId(r.id) : assign(r))}
                              >
                                <Check size={13} />
                                {hasOther ? 'Ganti barcode' : 'Pasangkan'}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(mode === 'create' || !canAssign) && canCreate && (
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                    <label className="sm:col-span-6 block">
                      <span className="block text-xs font-semibold text-heading mb-1">Nama produk *</span>
                      <input
                        ref={nameRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            priceRef.current?.focus();
                          }
                        }}
                        placeholder="mis. Kelly Pearly Cream 20g"
                        className={inputCls}
                      />
                    </label>
                    <label className="sm:col-span-2 block">
                      <span className="block text-xs font-semibold text-heading mb-1">Harga jual *</span>
                      <input
                        ref={priceRef}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            create();
                          }
                        }}
                        placeholder="0"
                        className={`${inputCls} tnum`}
                      />
                    </label>
                    <label className="sm:col-span-2 block">
                      <span className="block text-xs font-semibold text-heading mb-1">Harga beli</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            create();
                          }
                        }}
                        placeholder="opsional"
                        className={`${inputCls} tnum`}
                      />
                    </label>
                    <label className="sm:col-span-2 block">
                      <span className="block text-xs font-semibold text-heading mb-1">Satuan</span>
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className={inputCls}
                      />
                    </label>
                    <div className="sm:col-span-4">
                      <span className="block text-xs font-semibold text-heading mb-1">Kategori</span>
                      <Select value={categoryId} onChange={setCategoryId} ariaLabel="Kategori" className="w-full">
                        <option value="">Tanpa kategori</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="sm:col-span-2 flex items-end">
                      <Button variant="primary" fullWidth loading={busy} onClick={create}>
                        <PackagePlus size={15} />
                        Simpan
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Session log */}
            {log.length > 0 && (
              <div className="border-t border-line pt-3">
                <p className="text-[11px] font-semibold text-dim uppercase tracking-wide mb-1.5">Baru saja didaftarkan</p>
                <ul className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar" data-testid="rapid-log">
                  {log.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 text-xs">
                      <Check size={12} className="text-success shrink-0" />
                      <span className="text-heading font-medium truncate">{l.name}</span>
                      <span className="text-dim shrink-0">
                        {l.kind === 'assigned' ? 'dipasangkan' : 'produk baru'}
                      </span>
                      <span className="font-mono text-dim ml-auto shrink-0">{l.code}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <BarcodeCameraModal
        isOpen={showCamera}
        onClose={closeCamera}
        onDetected={handleCameraDetected}
        title="Scan Barcode Produk"
      />
    </>
  );
}
