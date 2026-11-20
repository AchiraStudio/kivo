import { useEffect, useRef, useState } from 'react';
import { Pill, Plus, Search, Trash2, BookmarkPlus, Loader2 } from 'lucide-react';
import {
  getItemsFiltered, saveMedicinePreset,
  type Item, type MedicineInput, type MedicinePreset, type HealthMedicine, type PresetItem,
} from '../../../lib/api';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import { toast } from '../../../components/ui/Toast';
import { formatRupiah } from './healthRanges';

export interface MedicineLine {
  key: string;
  item_id?: string | null;
  name: string;
  qty: string;
  unit: string;
  price: string;
  instructions: string;
}

let lineSeq = 0;
const nextKey = () => `line-${Date.now()}-${lineSeq++}`;

export const emptyLine = (): MedicineLine => ({
  key: nextKey(),
  item_id: null,
  name: '',
  qty: '1',
  unit: '',
  price: '0',
  instructions: '',
});

export const linesFromSaved = (rows: Array<HealthMedicine | PresetItem>): MedicineLine[] =>
  rows.map(m => ({
    key: nextKey(),
    item_id: m.item_id ?? null,
    name: m.name,
    qty: String(m.qty),
    unit: m.unit ?? '',
    price: String(m.price),
    instructions: m.instructions ?? '',
  }));

export const lineTotal = (l: MedicineLine): number => (Number(l.qty) || 0) * (Number(l.price) || 0);

/** Returns the API payload, or an error message naming the first invalid line. */
export function linesToInput(lines: MedicineLine[]): { ok: true; value: MedicineInput[] } | { ok: false; error: string } {
  const value: MedicineInput[] = [];
  for (const l of lines) {
    const name = l.name.trim();
    if (!name) return { ok: false, error: 'Nama obat pada salah satu baris masih kosong.' };
    const qty = Number(l.qty);
    const price = Number(l.price);
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: `Jumlah "${name}" harus lebih dari 0.` };
    if (!Number.isFinite(price) || price < 0) return { ok: false, error: `Harga "${name}" tidak valid.` };
    value.push({
      item_id: l.item_id ?? null,
      name,
      qty,
      unit: l.unit.trim() || null,
      price,
      instructions: l.instructions.trim() || null,
    });
  }
  return { ok: true, value };
}

const fieldCls =
  'w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors';

interface Props {
  lines: MedicineLine[];
  onChange: (lines: MedicineLine[]) => void;
  presets?: MedicinePreset[];
  onPresetsChanged?: () => void;
  /** Hide the preset picker and "save as preset" when editing a preset itself. */
  presetTools?: boolean;
}

export default function MedicineLinesEditor({ lines, onChange, presets = [], onPresetsChanged, presetTools = true }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [savingOpen, setSavingOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearchError(false);
      return;
    }
    const id = ++reqId.current;
    setSearching(true);
    const t = setTimeout(() => {
      getItemsFiltered(q, '', '', true, 1, 8)
        .then(res => {
          if (id === reqId.current) {
            setResults(res.items);
            setSearchError(false);
          }
        })
        .catch(() => {
          if (id === reqId.current) {
            setResults([]);
            setSearchError(true);
          }
        })
        .finally(() => {
          if (id === reqId.current) setSearching(false);
        });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const update = (key: string, patch: Partial<MedicineLine>) =>
    onChange(lines.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const addFromItem = (item: Item) => {
    onChange([
      ...lines,
      {
        key: nextKey(),
        item_id: item.id,
        name: item.name,
        qty: '1',
        unit: item.base_unit_name ?? '',
        price: String(item.price ?? 0),
        instructions: '',
      },
    ]);
    setQuery('');
    setResults([]);
  };

  const applyPreset = (id: string) => {
    const preset = presets.find(p => p.id === id);
    if (!preset) return;
    onChange([...lines, ...linesFromSaved(preset.items)]);
    toast.success(`Preset "${preset.name}" ditambahkan`, `${preset.items.length} obat`);
  };

  const handleSavePreset = async () => {
    const name = presetName.trim();
    if (!name) return toast.info('Nama preset wajib diisi.');
    const parsed = linesToInput(lines);
    if (!parsed.ok) return toast.info(parsed.error);
    if (parsed.value.length === 0) return toast.info('Tambahkan obat terlebih dahulu.');
    setSavingPreset(true);
    try {
      await saveMedicinePreset({ name, items: parsed.value });
      toast.success('Preset tersimpan', `"${name}" berisi ${parsed.value.length} obat.`);
      setPresetName('');
      setSavingOpen(false);
      onPresetsChanged?.();
    } catch (e) {
      toast.error('Gagal menyimpan preset', String(e));
    } finally {
      setSavingPreset(false);
    }
  };

  const total = lines.reduce((s, l) => s + lineTotal(l), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <div className="flex items-center h-9 bg-input border border-line rounded-lg px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 transition-colors">
            <Search size={15} className="text-dim mr-2 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari nama obat, SKU, atau barcode"
              aria-label="Cari obat di inventori"
              className="bg-transparent outline-none text-sm w-full text-heading placeholder:text-dim"
            />
            {searching && <Loader2 size={14} className="animate-spin text-dim shrink-0" />}
          </div>
          {query.trim() && !searching && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-elevated border border-line rounded-lg shadow-lg shadow-black/15 dark:shadow-black/45 p-1 max-h-60 overflow-y-auto custom-scrollbar">
              {searchError ? (
                <p className="px-2.5 py-2.5 text-xs text-danger">Gagal memuat obat. Coba lagi.</p>
              ) : results.length === 0 ? (
                <p className="px-2.5 py-2.5 text-xs text-dim">Obat tidak ditemukan. Gunakan Tambah manual.</p>
              ) : (
                results.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addFromItem(item)}
                    className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-md text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none cursor-pointer transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-heading truncate">{item.name}</span>
                      <span className="block text-[11px] text-dim truncate font-mono">
                        {item.sku}
                        {item.base_unit_name ? ` · ${item.base_unit_name}` : ''}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-body tnum shrink-0">{formatRupiah(item.price ?? 0)}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <Button type="button" variant="outline" onClick={() => onChange([...lines, emptyLine()])}>
          <Plus size={14} /> Tambah manual
        </Button>

        {presetTools && (
          <Select
            value=""
            onChange={v => {
              if (v) applyPreset(v);
            }}
            disabled={presets.length === 0}
            ariaLabel="Pakai preset obat"
            placeholder={presets.length === 0 ? 'Belum ada preset' : 'Pakai preset'}
            className="sm:w-48"
            options={presets.map(p => ({
              value: p.id,
              label: `${p.name} (${p.items.length})`,
            }))}
          />
        )}
      </div>

      {lines.length === 0 ? (
        <div className="border border-dashed border-line-strong rounded-xl py-7 px-4 text-center">
          <Pill size={22} className="mx-auto text-dim mb-1.5" />
          <p className="text-sm font-semibold text-heading">Belum ada obat</p>
          <p className="text-xs text-dim mt-0.5">Cari dari inventori, pilih preset, atau tambah manual.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lines.map((l, i) => (
            <li key={l.key} className="bg-muted/50 border border-line rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-[1fr_5rem_6rem_8rem_auto] gap-2 items-end">
                <label className="col-span-2 sm:col-span-1 block">
                  <span className="block text-[11px] font-semibold text-dim mb-1">Nama obat</span>
                  <input
                    className={fieldCls}
                    value={l.name}
                    onChange={e => update(l.key, { name: e.target.value, item_id: null })}
                    placeholder="Nama obat"
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold text-dim mb-1">Jumlah</span>
                  <input
                    className={`${fieldCls} tnum`}
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={l.qty}
                    onChange={e => update(l.key, { qty: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold text-dim mb-1">Satuan</span>
                  <input
                    className={fieldCls}
                    value={l.unit}
                    onChange={e => update(l.key, { unit: e.target.value })}
                    placeholder="strip"
                  />
                </label>
                <label className="col-span-2 sm:col-span-1 block">
                  <span className="block text-[11px] font-semibold text-dim mb-1">Harga satuan (Rp)</span>
                  <input
                    className={`${fieldCls} tnum`}
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={l.price}
                    onChange={e => update(l.key, { price: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onChange(lines.filter(x => x.key !== l.key))}
                  aria-label={`Hapus obat baris ${i + 1}`}
                  className="col-span-2 sm:col-span-1 inline-flex items-center justify-center h-9 w-full sm:w-9 rounded-lg text-dim hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  className={fieldCls}
                  value={l.instructions}
                  onChange={e => update(l.key, { instructions: e.target.value })}
                  placeholder="Aturan pakai (mis. 3 x 1 sesudah makan)"
                  aria-label="Aturan pakai"
                />
                <span className="text-xs font-semibold text-body tnum sm:w-32 sm:text-right shrink-0">
                  {formatRupiah(lineTotal(l))}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {lines.length > 0 && (
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {presetTools ? (
            savingOpen ? (
              <div className="flex flex-1 gap-2">
                <input
                  autoFocus
                  className={fieldCls}
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSavePreset();
                    }
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setSavingOpen(false);
                    }
                  }}
                  placeholder="Nama preset (mis. Paket diabetes)"
                  aria-label="Nama preset"
                />
                <Button type="button" variant="secondary" onClick={handleSavePreset} loading={savingPreset}>
                  Simpan
                </Button>
                <Button type="button" variant="ghost" onClick={() => setSavingOpen(false)}>
                  Batal
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSavingOpen(true)} className="self-start">
                <BookmarkPlus size={14} /> Simpan sebagai preset
              </Button>
            )
          ) : (
            <span />
          )}
          <p className="text-sm text-body">
            Total obat <span className="font-bold text-heading tnum ml-1">{formatRupiah(total)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
