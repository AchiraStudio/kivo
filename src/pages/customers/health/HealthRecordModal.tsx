import { useEffect, useState } from 'react';
import { HeartPulse, Save } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { toast } from '../../../components/ui/Toast';
import {
  saveHealthRecord, type BloodSugarContext, type Customer, type HealthRecord, type MedicinePreset,
} from '../../../lib/api';
import MedicineLinesEditor, { linesFromSaved, linesToInput, type MedicineLine } from './MedicineLinesEditor';
import { BLOOD_SUGAR_CONTEXT_LABEL, fromInputDateTime, nowInputDateTime, toInputDateTime } from './healthRanges';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  customer: Customer;
  record?: HealthRecord | null;
  presets: MedicinePreset[];
  onPresetsChanged: () => void;
}

interface FormState {
  checked_at: string;
  blood_sugar: string;
  blood_sugar_context: BloodSugarContext | '';
  cholesterol_total: string;
  cholesterol_hdl: string;
  cholesterol_ldl: string;
  triglycerides: string;
  uric_acid: string;
  systolic: string;
  diastolic: string;
  weight: string;
  height: string;
  notes: string;
}

const blank = (): FormState => ({
  checked_at: nowInputDateTime(), blood_sugar: '', blood_sugar_context: 'fasting', cholesterol_total: '', cholesterol_hdl: '',
  cholesterol_ldl: '', triglycerides: '', uric_acid: '', systolic: '', diastolic: '', weight: '', height: '', notes: '',
});

const str = (v: number | null | undefined) => (v == null ? '' : String(v));

const fromRecord = (r: HealthRecord): FormState => ({
  checked_at: toInputDateTime(r.checked_at),
  blood_sugar: str(r.blood_sugar),
  blood_sugar_context: r.blood_sugar_context ?? (r.blood_sugar != null ? 'random' : 'fasting'),
  cholesterol_total: str(r.cholesterol_total), cholesterol_hdl: str(r.cholesterol_hdl), cholesterol_ldl: str(r.cholesterol_ldl),
  triglycerides: str(r.triglycerides), uric_acid: str(r.uric_acid), systolic: str(r.systolic), diastolic: str(r.diastolic),
  weight: str(r.weight), height: str(r.height), notes: r.notes ?? '',
});

const num = (s: string): number | null => (s.trim() === '' ? null : Number(s));

const fieldCls = 'w-full bg-input border border-line rounded-lg px-3 py-2 text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/25';

function Field({ label, unit, children }: { label: string; unit?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs font-semibold text-heading mb-1">
        {label}
        {unit && <span className="text-[11px] font-medium text-dim">{unit}</span>}
      </span>
      {children}
    </label>
  );
}

export default function HealthRecordModal({ isOpen, onClose, onSaved, customer, record, presets, onPresetsChanged }: Props) {
  const [form, setForm] = useState<FormState>(blank);
  const [lines, setLines] = useState<MedicineLine[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(record ? fromRecord(record) : blank());
    setLines(record ? linesFromSaved(record.medicines) : []);
  }, [isOpen, record]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const numField = (k: keyof FormState, step = 'any', placeholder = '') => (
    <input
      className={`${fieldCls} tnum`} type="number" min="0" step={step} inputMode="decimal"
      value={form[k] as string} placeholder={placeholder}
      onChange={e => set(k, e.target.value as FormState[typeof k])}
    />
  );

  const handleSubmit = async () => {
    const measures = [form.blood_sugar, form.cholesterol_total, form.cholesterol_hdl, form.cholesterol_ldl, form.triglycerides, form.uric_acid, form.weight, form.height, form.systolic, form.diastolic];
    if (measures.some(m => m.trim() !== '' && !Number.isFinite(Number(m)))) return toast.info('Ada hasil pemeriksaan yang bukan angka.');
    if ((form.systolic.trim() === '') !== (form.diastolic.trim() === '')) return toast.info('Tekanan darah diisi sistolik dan diastolik.');

    const parsed = linesToInput(lines);
    if (!parsed.ok) return toast.info(parsed.error);

    const hasSugar = form.blood_sugar.trim() !== '';
    setSaving(true);
    try {
      await saveHealthRecord({
        id: record?.id,
        customer_id: customer.id,
        checked_at: fromInputDateTime(form.checked_at) || undefined,
        blood_sugar: num(form.blood_sugar),
        blood_sugar_context: hasSugar && form.blood_sugar_context ? form.blood_sugar_context : null,
        cholesterol_total: num(form.cholesterol_total),
        cholesterol_hdl: num(form.cholesterol_hdl),
        cholesterol_ldl: num(form.cholesterol_ldl),
        triglycerides: num(form.triglycerides),
        uric_acid: num(form.uric_acid),
        systolic: num(form.systolic),
        diastolic: num(form.diastolic),
        weight: num(form.weight),
        height: num(form.height),
        notes: form.notes.trim() || null,
        medicines: parsed.value,
      });
      toast.success(record ? 'Catatan kesehatan diperbarui' : 'Catatan kesehatan tersimpan', customer.name);
      onSaved();
      onClose();
    } catch (e) {
      toast.error('Gagal menyimpan catatan kesehatan', String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      title={record ? 'Edit Catatan Kesehatan' : 'Catatan Kesehatan Baru'}
      subtitle={customer.name}
      icon={HeartPulse}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit} loading={saving}>
            {!saving && <Save size={15} />} Simpan Catatan
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <section aria-labelledby="hr-measure" className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <h3 id="hr-measure" className="text-sm font-bold text-heading">Hasil pemeriksaan</h3>
            <div className="sm:w-56">
              <Field label="Waktu pemeriksaan">
                <input className={fieldCls} type="datetime-local" value={form.checked_at} onChange={e => set('checked_at', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Gula darah" unit="mg/dL">{numField('blood_sugar')}</Field>
            <Field label="Kondisi">
              <select
                value={form.blood_sugar_context}
                onChange={e => set('blood_sugar_context', e.target.value as BloodSugarContext)}
                disabled={form.blood_sugar.trim() === ''}
                className="w-full px-3 py-2"
              >
                {(Object.keys(BLOOD_SUGAR_CONTEXT_LABEL) as BloodSugarContext[]).map(k => (
                  <option key={k} value={k}>{BLOOD_SUGAR_CONTEXT_LABEL[k]}</option>
                ))}
              </select>
            </Field>
            <Field label="Asam urat" unit="mg/dL">{numField('uric_acid')}</Field>
            <Field label="Tekanan darah" unit="mmHg">
              <div className="flex items-center gap-1.5">
                {numField('systolic', '1', 'Sis')}
                <span className="text-dim">/</span>
                {numField('diastolic', '1', 'Dia')}
              </div>
            </Field>
            <Field label="Kolesterol total" unit="mg/dL">{numField('cholesterol_total')}</Field>
            <Field label="HDL" unit="mg/dL">{numField('cholesterol_hdl')}</Field>
            <Field label="LDL" unit="mg/dL">{numField('cholesterol_ldl')}</Field>
            <Field label="Trigliserida" unit="mg/dL">{numField('triglycerides')}</Field>
            <Field label="Berat badan" unit="kg">{numField('weight')}</Field>
            <Field label="Tinggi badan" unit="cm">{numField('height')}</Field>
          </div>
          <p className="text-[11px] text-dim">Isi hanya yang diperiksa. Penanda warna memakai rentang acuan umum orang dewasa dan bukan diagnosis.</p>
        </section>

        <section aria-labelledby="hr-meds" className="space-y-3">
          <h3 id="hr-meds" className="text-sm font-bold text-heading">Obat yang diberikan</h3>
          <MedicineLinesEditor lines={lines} onChange={setLines} presets={presets} onPresetsChanged={onPresetsChanged} />
        </section>

        <section>
          <Field label="Catatan">
            <textarea
              className={`${fieldCls} h-20 resize-none`}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Keluhan, anjuran, atau jadwal kontrol berikutnya"
            />
          </Field>
        </section>
      </div>
    </Modal>
  );
}
