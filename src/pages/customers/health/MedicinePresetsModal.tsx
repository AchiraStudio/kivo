import { useEffect, useState } from 'react';
import { ArrowLeft, Pencil, Pill, Plus, Save, Trash2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import { toast } from '../../../components/ui/Toast';
import { deleteMedicinePreset, saveMedicinePreset, type MedicinePreset } from '../../../lib/api';
import MedicineLinesEditor, { linesFromSaved, linesToInput, lineTotal, type MedicineLine } from './MedicineLinesEditor';
import { formatRupiah } from './healthRanges';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  presets: MedicinePreset[];
  onChanged: () => void;
}

const fieldCls =
  'w-full h-9 bg-input border border-line rounded-lg px-3 text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors';

type Editing = { id?: string; name: string; notes: string; lines: MedicineLine[] };

export default function MedicinePresetsModal({ isOpen, onClose, presets, onChanged }: Props) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<MedicinePreset | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setEditing(null);
      setToDelete(null);
    }
  }, [isOpen]);

  const startNew = () => setEditing({ name: '', notes: '', lines: [] });
  const startEdit = (p: MedicinePreset) =>
    setEditing({ id: p.id, name: p.name, notes: p.notes ?? '', lines: linesFromSaved(p.items) });

  const handleSave = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return toast.info('Nama preset wajib diisi.');
    if (editing.lines.length === 0) return toast.info('Preset harus berisi minimal satu obat.');
    const parsed = linesToInput(editing.lines);
    if (!parsed.ok) return toast.info(parsed.error);
    setSaving(true);
    try {
      await saveMedicinePreset({ id: editing.id, name, notes: editing.notes.trim() || null, items: parsed.value });
      toast.success(editing.id ? 'Preset diperbarui' : 'Preset tersimpan', name);
      setEditing(null);
      onChanged();
    } catch (e) {
      toast.error('Gagal menyimpan preset', String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteMedicinePreset(toDelete.id);
      toast.success('Preset dihapus', toDelete.name);
      setToDelete(null);
      onChanged();
    } catch (e) {
      toast.error('Gagal menghapus preset', String(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="3xl"
        title={editing ? (editing.id ? 'Edit Preset Obat' : 'Preset Obat Baru') : 'Preset Obat'}
        icon={Pill}
        footer={
          editing ? (
            <div className="flex justify-between gap-2 w-full">
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                <ArrowLeft size={15} /> Kembali
              </Button>
              <Button type="button" onClick={handleSave} loading={saving}>
                {!saving && <Save size={15} />} Simpan Preset
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={startNew}>
              <Plus size={15} /> Preset Baru
            </Button>
          )
        }
      >
        {editing ? (
          <div className="space-y-4">
            <label className="block">
              <span className="block text-xs font-semibold text-heading mb-1">Nama preset</span>
              <input
                className={fieldCls}
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                placeholder="Mis. Paket diabetes"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-heading mb-1">Catatan</span>
              <input
                className={fieldCls}
                value={editing.notes}
                onChange={e => setEditing({ ...editing, notes: e.target.value })}
                placeholder="Opsional"
              />
            </label>
            <MedicineLinesEditor
              lines={editing.lines}
              onChange={lines => setEditing({ ...editing, lines })}
              presetTools={false}
            />
          </div>
        ) : presets.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-line-strong rounded-xl px-4">
            <Pill size={26} className="mx-auto text-dim mb-2" />
            <p className="text-sm font-semibold text-heading">Belum ada preset obat</p>
            <p className="text-xs text-dim mt-1">Buat preset baru atau simpan dari form catatan kesehatan.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line border border-line rounded-xl overflow-hidden">
            {presets.map(p => {
              const lines = linesFromSaved(p.items);
              const total = lines.reduce((s, l) => s + lineTotal(l), 0);
              return (
                <li key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 bg-card">
                  <div className="min-w-0">
                    <p className="font-bold text-heading truncate">{p.name}</p>
                    {p.notes && <p className="text-xs text-dim mt-0.5">{p.notes}</p>}
                    <ul className="mt-2 space-y-0.5">
                      {p.items.map(it => (
                        <li key={it.id} className="text-xs text-body flex justify-between gap-4">
                          <span className="truncate">
                            {it.name}{' '}
                            <span className="text-dim tnum">
                              x {it.qty}
                              {it.unit ? ` ${it.unit}` : ''}
                            </span>
                          </span>
                          <span className="tnum shrink-0">{formatRupiah(it.qty * it.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                    <p className="text-sm font-bold text-heading tnum">{formatRupiah(total)}</p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        aria-label={`Edit preset ${p.name}`}
                        className="p-1.5 rounded-lg text-dim hover:bg-muted hover:text-heading transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(p)}
                        aria-label={`Hapus preset ${p.name}`}
                        className="p-1.5 rounded-lg text-dim hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {toDelete && (
        <ConfirmModal
          title="Hapus preset obat?"
          message={`Preset "${toDelete.name}" akan dihapus. Catatan kesehatan yang sudah ada tidak berubah.`}
          confirmLabel="Hapus Preset"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  );
}
