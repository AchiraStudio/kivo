import type { BloodSugarContext, HealthRecord } from '../../../lib/api';

export type Status = 'ok' | 'watch' | 'high' | 'low';

export const STATUS_TEXT: Record<Status, string> = {
  ok: 'text-success',
  watch: 'text-warning',
  high: 'text-danger',
  low: 'text-info',
};

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'Normal',
  watch: 'Waspada',
  high: 'Tinggi',
  low: 'Rendah',
};

// General adult reference bands (mg/dL unless noted). They are display hints for the
// cashier or pharmacist and never a diagnosis.
export function bloodSugarStatus(v: number, ctx?: BloodSugarContext | null): Status {
  if (v < 70) return 'low';
  if (ctx === 'fasting') return v >= 126 ? 'high' : v >= 100 ? 'watch' : 'ok';
  if (ctx === 'after_meal') return v >= 200 ? 'high' : v >= 140 ? 'watch' : 'ok';
  return v >= 200 ? 'high' : v >= 140 ? 'watch' : 'ok';
}

export const cholesterolTotalStatus = (v: number): Status => (v >= 240 ? 'high' : v >= 200 ? 'watch' : 'ok');
export const ldlStatus = (v: number): Status => (v >= 160 ? 'high' : v >= 130 ? 'watch' : 'ok');
export const hdlStatus = (v: number): Status => (v < 40 ? 'low' : 'ok');
export const triglycerideStatus = (v: number): Status => (v >= 200 ? 'high' : v >= 150 ? 'watch' : 'ok');
export const uricAcidStatus = (v: number): Status => (v > 7 ? 'high' : v > 6 ? 'watch' : 'ok');
export const bloodPressureStatus = (sys: number, dia: number): Status =>
  sys >= 140 || dia >= 90 ? 'high' : sys >= 120 || dia >= 80 ? 'watch' : 'ok';

export const BLOOD_SUGAR_CONTEXT_LABEL: Record<BloodSugarContext, string> = {
  fasting: 'Puasa',
  after_meal: '2 jam setelah makan',
  random: 'Sewaktu',
};

export interface Measure {
  key: string;
  label: string;
  value: string;
  unit: string;
  status?: Status;
  hint?: string;
}

export function bmi(weight?: number | null, height?: number | null): number | null {
  if (!weight || !height) return null;
  const m = height / 100;
  return weight / (m * m);
}

export function measuresOf(r: HealthRecord): Measure[] {
  const out: Measure[] = [];
  if (r.blood_sugar != null) {
    out.push({
      key: 'sugar',
      label: 'Gula darah',
      value: String(r.blood_sugar),
      unit: 'mg/dL',
      status: bloodSugarStatus(r.blood_sugar, r.blood_sugar_context),
      hint: r.blood_sugar_context ? BLOOD_SUGAR_CONTEXT_LABEL[r.blood_sugar_context] : undefined,
    });
  }
  if (r.cholesterol_total != null) out.push({ key: 'chol', label: 'Kolesterol total', value: String(r.cholesterol_total), unit: 'mg/dL', status: cholesterolTotalStatus(r.cholesterol_total) });
  if (r.cholesterol_hdl != null) out.push({ key: 'hdl', label: 'HDL', value: String(r.cholesterol_hdl), unit: 'mg/dL', status: hdlStatus(r.cholesterol_hdl) });
  if (r.cholesterol_ldl != null) out.push({ key: 'ldl', label: 'LDL', value: String(r.cholesterol_ldl), unit: 'mg/dL', status: ldlStatus(r.cholesterol_ldl) });
  if (r.triglycerides != null) out.push({ key: 'tg', label: 'Trigliserida', value: String(r.triglycerides), unit: 'mg/dL', status: triglycerideStatus(r.triglycerides) });
  if (r.uric_acid != null) out.push({ key: 'uric', label: 'Asam urat', value: String(r.uric_acid), unit: 'mg/dL', status: uricAcidStatus(r.uric_acid) });
  if (r.systolic != null && r.diastolic != null) {
    out.push({ key: 'bp', label: 'Tekanan darah', value: `${r.systolic}/${r.diastolic}`, unit: 'mmHg', status: bloodPressureStatus(r.systolic, r.diastolic) });
  }
  if (r.weight != null) out.push({ key: 'weight', label: 'Berat badan', value: String(r.weight), unit: 'kg' });
  if (r.height != null) out.push({ key: 'height', label: 'Tinggi badan', value: String(r.height), unit: 'cm' });
  const b = bmi(r.weight, r.height);
  if (b != null) out.push({ key: 'bmi', label: 'IMT', value: b.toFixed(1), unit: 'kg/m²' });
  return out;
}

export const formatRupiah = (n: number): string => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

export const medicineTotal = (r: HealthRecord): number => r.medicines.reduce((sum, m) => sum + m.qty * m.price, 0);

export function formatCheckedAt(s: string): string {
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// SQLite "YYYY-MM-DD HH:MM:SS" <-> <input type="datetime-local"> "YYYY-MM-DDTHH:MM"
export const toInputDateTime = (s: string): string => s.replace(' ', 'T').slice(0, 16);
export const fromInputDateTime = (s: string): string => (s ? `${s.replace('T', ' ')}:00` : '');
export function nowInputDateTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
