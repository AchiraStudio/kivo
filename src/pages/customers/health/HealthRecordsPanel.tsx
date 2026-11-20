import { useCallback, useEffect, useState } from 'react';
import { HeartPulse, Loader2, Pencil, Pill, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import { toast } from '../../../components/ui/Toast';
import {
  deleteHealthRecord, getHealthRecords, getMedicinePresets,
  type Customer, type HealthRecord, type MedicinePreset,
} from '../../../lib/api';
import HealthRecordModal from './HealthRecordModal';
import MedicinePresetsModal from './MedicinePresetsModal';
import { STATUS_LABEL, STATUS_TEXT, formatCheckedAt, formatRupiah, measuresOf, medicineTotal } from './healthRanges';

export default function HealthRecordsPanel({ customer }: { customer: Customer }) {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [presets, setPresets] = useState<MedicinePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HealthRecord | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [toDelete, setToDelete] = useState<HealthRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPresets = useCallback(() => {
    getMedicinePresets()
      .then(setPresets)
      .catch(() => {
        /* presets are optional; the editor shows its empty state */
      });
  }, []);

  const loadRecords = useCallback(() => {
    setLoading(true);
    setError(null);
    getHealthRecords(customer.id)
      .then(setRecords)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [customer.id]);

  useEffect(() => {
    loadRecords();
    loadPresets();
  }, [loadRecords, loadPresets]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (r: HealthRecord) => {
    setEditing(r);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteHealthRecord(toDelete.id);
      toast.success('Catatan kesehatan dihapus');
      setToDelete(null);
      loadRecords();
    } catch (e) {
      toast.error('Gagal menghapus catatan', String(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-dim tnum">
          {!loading && !error ? `${records.length} catatan` : 'Catatan kesehatan'}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPresetsOpen(true)}>
            <Pill size={14} /> Preset Obat
            {presets.length > 0 && <span className="text-dim tnum">({presets.length})</span>}
          </Button>
          <Button type="button" size="sm" onClick={openNew}>
            <Plus size={14} /> Catatan Baru
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center" role="status" aria-label="Memuat catatan kesehatan">
          <Loader2 className="animate-spin text-primary mx-auto" size={24} />
        </div>
      ) : error ? (
        <div className="py-10 text-center bg-danger-soft/40 rounded-xl border border-danger/30 px-4">
          <p className="text-sm font-semibold text-danger">Catatan kesehatan gagal dimuat</p>
          <p className="text-xs text-dim mt-1 break-words">{error}</p>
          <div className="mt-3">
            <Button type="button" variant="outline" size="sm" onClick={loadRecords}>
              <RefreshCw size={13} /> Coba lagi
            </Button>
          </div>
        </div>
      ) : records.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-line-strong rounded-xl px-4">
          <HeartPulse size={26} className="mx-auto text-dim mb-2" />
          <p className="text-sm font-semibold text-heading">Belum ada catatan kesehatan</p>
          <p className="text-xs text-dim mt-1">Tambahkan hasil pemeriksaan atau obat untuk {customer.name}.</p>
          <div className="mt-3">
            <Button type="button" variant="outline" size="sm" onClick={openNew}>
              <Plus size={14} /> Catat pemeriksaan
            </Button>
          </div>
        </div>
      ) : (
        <ol className="space-y-3">
          {records.map((r, idx) => {
            const measures = measuresOf(r);
            const total = medicineTotal(r);
            return (
              <li key={r.id} className="bg-card border border-line rounded-xl overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/50 border-b border-line">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-xs font-semibold text-heading tnum truncate">{formatCheckedAt(r.checked_at)}</p>
                    {idx === 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-card border border-line text-[11px] font-medium text-dim shrink-0">
                        Terbaru
                      </span>
                    )}
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      aria-label="Edit catatan"
                      className="p-1.5 rounded-lg text-dim hover:bg-muted-hover hover:text-heading transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setToDelete(r)}
                      aria-label="Hapus catatan"
                      className="p-1.5 rounded-lg text-dim hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {measures.length > 0 && (
                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                      {measures.map(m => (
                        <div key={m.key}>
                          <dt className="text-[11px] text-dim">
                            {m.label}
                            {m.hint ? ` · ${m.hint}` : ''}
                          </dt>
                          <dd className="text-sm font-bold text-heading tnum">
                            {m.value} <span className="text-[11px] font-medium text-dim">{m.unit}</span>
                            {m.status && (
                              <span className={`ml-1.5 text-[11px] font-semibold ${STATUS_TEXT[m.status]}`}>
                                {STATUS_LABEL[m.status]}
                              </span>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {r.medicines.length > 0 && (
                    <div className={measures.length > 0 ? 'pt-3 border-t border-line' : ''}>
                      <p className="text-[11px] font-semibold text-dim mb-1.5">Obat diberikan</p>
                      <ul className="space-y-1">
                        {r.medicines.map(m => (
                          <li key={m.id} className="flex justify-between gap-4 text-xs">
                            <span className="min-w-0">
                              <span className="font-semibold text-heading">{m.name}</span>
                              <span className="text-dim tnum">
                                {' '}x {m.qty}
                                {m.unit ? ` ${m.unit}` : ''}
                              </span>
                              {m.instructions && <span className="block text-dim">{m.instructions}</span>}
                            </span>
                            <span className="text-body tnum shrink-0">{formatRupiah(m.qty * m.price)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-body flex justify-between">
                        <span>Total obat</span>
                        <span className="font-bold text-heading tnum">{formatRupiah(total)}</span>
                      </p>
                    </div>
                  )}

                  {r.notes && <p className="text-xs text-body pt-3 border-t border-line whitespace-pre-wrap">{r.notes}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <HealthRecordModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={loadRecords}
        customer={customer}
        record={editing}
        presets={presets}
        onPresetsChanged={loadPresets}
      />
      <MedicinePresetsModal
        isOpen={presetsOpen}
        onClose={() => setPresetsOpen(false)}
        presets={presets}
        onChanged={loadPresets}
      />

      {toDelete && (
        <ConfirmModal
          title="Hapus catatan kesehatan?"
          message={`Catatan tanggal ${formatCheckedAt(toDelete.checked_at)} beserta daftar obatnya akan dihapus permanen.`}
          confirmLabel="Hapus Catatan"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
