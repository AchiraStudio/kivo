import { useEffect, useState } from 'react';
import { Activity, Droplet, FlaskConical, Gauge, HeartPulse, Save, X } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { toast } from '../../../components/ui/Toast';
import {
  saveHealthRecord, type BloodSugarContext, type Customer, type HealthRecord, type MedicinePreset,
} from '../../../lib/api';
import MedicineLinesEditor, { linesFromSaved, linesToInput, type MedicineLine } from './MedicineLinesEditor';
import {
  BLOOD_SUGAR_CONTEXT_LABEL, STATUS_LABEL, STATUS_TEXT, bloodPressureStatus, bloodSugarStatus, cholesterolTotalStatus,
  fromInputDateTime, hdlStatus, ldlStatus, nowInputDateTime, toInputDateTime, triglycerideStatus, uricAcidStatus,
  type Status,
} from './healthRanges';

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
  blood_sugar_context: BloodSugarContext;
  cholesterol_total: string;
  cholesterol_hdl: string;
  cholesterol_ldl: string;
  triglycerides: string;
  uric_acid: string;
  systolic: string;
  diastolic: string;
  notes: string;
}

// Each group is one kind of check. Only the groups the pharmacist switches on are shown and saved.
type GroupKey = 'sugar' | 'bp' | 'chol' | 'uric';
type Groups = Record<GroupKey, boolean>;

const GROUPS: Array<{ key: GroupKey; label: string; icon: typeof Droplet }> = [
  { key: 'sugar', label: 'Gula darah', icon: Droplet },
  { key: 'bp', label: 'Tekanan darah', icon: Gauge },
  { key: 'chol', label: 'Kolesterol', icon: Activity },
  { key: 'uric', label: 'Asam urat', icon: FlaskConical },
];

const blank = (): FormState => ({
  checked_at: nowInputDateTime(), blood_sugar: '', blood_sugar_context: 'fasting', cholesterol_total: '', cholesterol_hdl: '',
  cholesterol_ldl: '', triglycerides: '', uric_acid: '', systolic: '', diastolic: '', notes: '',
});

const str = (v: number | null | undefined) => (v == null ? '' : String(v));

const fromRecord = (r: HealthRecord): FormState => ({
  checked_at: toInputDateTime(r.checked_at),
  blood_sugar: str(r.blood_sugar),
  blood_sugar_context: r.blood_sugar_context ?? (r.blood_sugar != null ? 'random' : 'fasting'),
  cholesterol_total: str(r.cholesterol_total), cholesterol_hdl: str(r.cholesterol_hdl), cholesterol_ldl: str(r.cholesterol_ldl),
  triglycerides: str(r.triglycerides), uric_acid: str(r.uric_acid), systolic: str(r.systolic), diastolic: str(r.diastolic),
  notes: r.notes ?? '',
});

const groupsFromRecord = (r: HealthRecord): Groups => ({
  sugar: r.blood_sugar != null,
  bp: r.systolic != null || r.diastolic != null,
  chol: r.cholesterol_total != null || r.cholesterol_hdl != null || r.cholesterol_ldl != null || r.triglycerides != null,
  uric: r.uric_acid != null,
});

const NO_GROUPS: Groups = { sugar: false, bp: false, chol: false, uric: false };

const filled = (s: string) => s.trim() !== '';
const num = (s: string): number | null => (filled(s) ? Number(s) : null);

const fieldCls = 'w-full bg-input border border-line rounded-lg px-3 py-2 text-sm text-heading outline-none focus:border-primary focus:ring-2 focus:ring-primary/25';

function StatusBadge({ status }: { status: Status | null }) {
  if (!status) return null;
  return <span className={`text-[11px] font-semibold ${STATUS_TEXT[status]}`}>{STATUS_LABEL[status]}</span>;
}

function Field({ label, unit, children }: { label: string; unit?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="flex items-baseline justify-between text-xs font-semibold text-heading mb-1">
        {label}
        {unit && <span className="text-[11px] font-medium text-dim">{unit}</span>}
      </span>
      {children}
    </label>
  );
}

function GroupCard({ title, status, onRemove, children }: { title: string; status: Status | null; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-heading">{title}</h4>
          <StatusBadge status={status} />
        </div>
        <button type="button" onClick={onRemove} aria-label={`Hapus ${title}`} className="p-1 rounded-md text-dim hover:text-heading hover:bg-muted transition-colors">
          <X size={14} />
        </button>
      </div>
      {children}
    </div>
  );
}

export default function HealthRecordModal({ isOpen, onClose, onSaved, customer, record, presets, onPresetsChanged }: Props) {
  const [form, setForm] = useState<FormState>(blank);
  const [groups, setGroups] = useState<Groups>(NO_GROUPS);
  const [lines, setLines] = useState<MedicineLine[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(record ? fromRecord(record) : blank());
    setGroups(record ? groupsFromRecord(record) : NO_GROUPS);
    setLines(record ? linesFromSaved(record.medicines) : []);
  }, [isOpen, record]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));
  const toggle = (k: GroupKey) => setGroups(g => ({ ...g, [k]: !g[k] }));

  const numField = (k: keyof FormState, step = 'any', placeholder = '', autoFocus = false) => (
    <input
      className={`${fieldCls} tnum`} type="number" min="0" step={step} inputMode="decimal"
      value={form[k] as string} placeholder={placeholder} autoFocus={autoFocus}
      onChange={e => set(k, e.target.value as FormState[typeof k])}
    />
  );

  const sugar = num(form.blood_sugar);
  const sys = num(form.systolic);
  const dia = num(form.diastolic);
  const uric = num(form.uric_acid);
  const cholStatuses = [
    num(form.cholesterol_total) != null ? cholesterolTotalStatus(num(form.cholesterol_total)!) : null,
    num(form.cholesterol_hdl) != null ? hdlStatus(num(form.cholesterol_hdl)!) : null,
    num(form.cholesterol_ldl) != null ? ldlStatus(num(form.cholesterol_ldl)!) : null,
    num(form.triglycerides) != null ? triglycerideStatus(num(form.triglycerides)!) : null,
  ];
  // The card shows the worst reading so a single glance tells the pharmacist whether to look closer.
  const worst = (list: Array<Status | null>): Status | null => {
    const present = list.filter((s): s is Status => s != null);
    return (['high', 'low', 'watch', 'ok'] as Status[]).find(s => present.includes(s)) ?? null;
  };

  const handleSubmit = async () => {
    // Values of groups that are switched off are ignored, so a stray number never gets saved.
    const v = {
      blood_sugar: groups.sugar ? form.blood_sugar : '',
      cholesterol_total: groups.chol ? form.cholesterol_total : '',
      cholesterol_hdl: groups.chol ? form.cholesterol_hdl : '',
      cholesterol_ldl: groups.chol ? form.cholesterol_ldl : '',
      triglycerides: groups.chol ? form.triglycerides : '',
      uric_acid: groups.uric ? form.uric_acid : '',
      systolic: groups.bp ? form.systolic : '',
      diastolic: groups.bp ? form.diastolic : '',
    };
    if (Object.values(v).some(m => filled(m) && !Number.isFinite(Number(m)))) return toast.info('Ada hasil pemeriksaan yang bukan angka.');
    if (filled(v.systolic) !== filled(v.diastolic)) return toast.info('Tekanan darah diisi sistolik dan diastolik.');

    const parsed = linesToInput(lines);
    if (!parsed.ok) return toast.info(parsed.error);

    const hasReading = Object.values(v).some(filled);
    if (!hasReading && parsed.value.length === 0 && !form.notes.trim()) {
      return toast.info('Isi minimal satu hasil pemeriksaan, obat, atau catatan.');
    }

    setSaving(true);
    try {
      await saveHealthRecord({
        id: record?.id,
        customer_id: customer.id,
        checked_at: fromInputDateTime(form.checked_at) || undefined,
        blood_sugar: num(v.blood_sugar),
        blood_sugar_context: filled(v.blood_sugar) ? form.blood_sugar_context : null,
        cholesterol_total: num(v.cholesterol_total),
        cholesterol_hdl: num(v.cholesterol_hdl),
        cholesterol_ldl: num(v.cholesterol_ldl),
        triglycerides: num(v.triglycerides),
        uric_acid: num(v.uric_acid),
        systolic: num(v.systolic),
        diastolic: num(v.diastolic),
        // Weight and height are no longer asked for, but older records keep what they already have.
        weight: record?.weight ?? null,
        height: record?.height ?? null,
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

  const anyGroup = Object.values(groups).some(Boolean);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
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
      <div className="space-y-5">
        <section aria-labelledby="hr-measure" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 id="hr-measure" className="text-sm font-bold text-heading">Apa yang diperiksa?</h3>
            <input
              className={`${fieldCls} !w-auto tnum`} type="datetime-local" aria-label="Waktu pemeriksaan"
              value={form.checked_at} onChange={e => set('checked_at', e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Jenis pemeriksaan">
            {GROUPS.map(({ key, label, icon: Icon }) => (
              <button
                key={key} type="button" onClick={() => toggle(key)} aria-pressed={groups[key]}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                  groups[key]
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card text-body border-line hover:border-primary/50 hover:text-heading'
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {!anyGroup && (
            <p className="text-xs text-dim">Pilih yang diperiksa saja. Boleh satu, boleh semuanya, atau langsung isi obat di bawah.</p>
          )}

          {groups.sugar && (
            <GroupCard title="Gula darah" status={sugar != null ? bloodSugarStatus(sugar, form.blood_sugar_context) : null} onRemove={() => toggle('sugar')}>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-36"><Field label="Hasil" unit="mg/dL">{numField('blood_sugar', 'any', '', !record)}</Field></div>
                <div className="flex rounded-lg border border-line overflow-hidden" role="radiogroup" aria-label="Kondisi">
                  {(Object.keys(BLOOD_SUGAR_CONTEXT_LABEL) as BloodSugarContext[]).map(k => (
                    <button
                      key={k} type="button" role="radio" aria-checked={form.blood_sugar_context === k}
                      onClick={() => set('blood_sugar_context', k)}
                      className={`px-3 py-2 text-xs font-semibold transition-colors ${
                        form.blood_sugar_context === k ? 'bg-primary-soft text-primary' : 'bg-card text-body hover:bg-muted'
                      }`}
                    >
                      {BLOOD_SUGAR_CONTEXT_LABEL[k]}
                    </button>
                  ))}
                </div>
              </div>
            </GroupCard>
          )}

          {groups.bp && (
            <GroupCard title="Tekanan darah" status={sys != null && dia != null ? bloodPressureStatus(sys, dia) : null} onRemove={() => toggle('bp')}>
              <div className="flex items-end gap-2 w-60">
                <Field label="Sistolik">{numField('systolic', '1', '120', !record)}</Field>
                <span className="pb-2 text-dim">/</span>
                <Field label="Diastolik" unit="mmHg">{numField('diastolic', '1', '80')}</Field>
              </div>
            </GroupCard>
          )}

          {groups.chol && (
            <GroupCard title="Kolesterol" status={worst(cholStatuses)} onRemove={() => toggle('chol')}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Total" unit="mg/dL">{numField('cholesterol_total', 'any', '', !record)}</Field>
                <Field label="HDL" unit="mg/dL">{numField('cholesterol_hdl')}</Field>
                <Field label="LDL" unit="mg/dL">{numField('cholesterol_ldl')}</Field>
                <Field label="Trigliserida" unit="mg/dL">{numField('triglycerides')}</Field>
              </div>
            </GroupCard>
          )}

          {groups.uric && (
            <GroupCard title="Asam urat" status={uric != null ? uricAcidStatus(uric) : null} onRemove={() => toggle('uric')}>
              <div className="w-36"><Field label="Hasil" unit="mg/dL">{numField('uric_acid', 'any', '', !record)}</Field></div>
            </GroupCard>
          )}

          {anyGroup && (
            <p className="text-[11px] text-dim">Penanda warna memakai rentang acuan umum orang dewasa dan bukan diagnosis.</p>
          )}
        </section>

        <section aria-labelledby="hr-meds" className="space-y-3">
          <h3 id="hr-meds" className="text-sm font-bold text-heading">Obat yang diberikan</h3>
          <MedicineLinesEditor lines={lines} onChange={setLines} presets={presets} onPresetsChanged={onPresetsChanged} />
        </section>

        <section>
          <Field label="Catatan">
            <textarea
              className={`${fieldCls} h-16 resize-none`}
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
