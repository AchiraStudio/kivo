import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { getExpiringItems, ExpiringItemRow } from '../../lib/api';
import ReportHeader from '../../components/reports/ReportHeader';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';

interface Props {
  onBack: () => void;
}

const URGENCY = (days: number) => {
  if (days <= 7) return { label: 'Kritis', color: 'bg-danger-soft text-danger', row: 'bg-danger-soft/40' };
  if (days <= 14) return { label: 'Mendesak', color: 'bg-warning-soft text-warning', row: 'bg-warning-soft/40' };
  if (days <= 30) return { label: 'Perhatian', color: 'bg-warning-soft text-warning', row: '' };
  return { label: 'Aman', color: 'bg-success-soft text-success', row: '' };
};

export default function LaporanKadaluarsa({ onBack }: Props) {
  const [daysAhead, setDaysAhead] = useState(30);
  const [data, setData] = useState<ExpiringItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getExpiringItems('branch_001', daysAhead));
    } catch (e) {
      console.error(e);
      setError('Gagal memuat data kadaluarsa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [daysAhead]);

  const critical = data.filter((r) => r.days_left <= 7).length;
  const urgent = data.filter((r) => r.days_left > 7 && r.days_left <= 14).length;

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-full">
      <ReportHeader title="Hampir Kadaluarsa" onBack={onBack}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-dim font-medium">Rentang</span>
          <Select
            size="sm"
            value={String(daysAhead)}
            onChange={(v) => setDaysAhead(Number(v))}
            ariaLabel="Rentang hari kadaluarsa"
            className="w-28"
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={String(d)}>
                {d} hari
              </option>
            ))}
          </Select>
        </div>
      </ReportHeader>

      {(critical > 0 || urgent > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          {critical > 0 && (
            <div className="px-4 py-3 bg-danger-soft border border-danger/30 rounded-xl flex items-center gap-3">
              <AlertTriangle className="text-danger shrink-0" size={18} strokeWidth={1.75} />
              <div className="text-xs">
                <span className="font-bold text-danger tnum">{critical} batch kritis</span>
                <span className="text-danger/80 ml-1.5">(kadaluarsa dalam 7 hari)</span>
              </div>
            </div>
          )}
          {urgent > 0 && (
            <div className="px-4 py-3 bg-warning-soft border border-warning/30 rounded-xl flex items-center gap-3">
              <AlertTriangle className="text-warning shrink-0" size={18} strokeWidth={1.75} />
              <div className="text-xs">
                <span className="font-bold text-warning tnum">{urgent} batch mendesak</span>
                <span className="text-warning/80 ml-1.5">(kadaluarsa dalam 14 hari)</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-card rounded-xl border border-line flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/60 border-b border-line text-xs text-dim font-semibold sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Nama Item</th>
                <th className="py-3 px-4">Batch</th>
                <th className="py-3 px-4">Tanggal Kadaluarsa</th>
                <th className="py-3 px-4 text-right">Stok</th>
                <th className="py-3 px-4 text-right">Sisa Hari</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-dim">
                    <Loader2 className="animate-spin text-primary mx-auto mb-2" size={24} />
                    <span className="text-xs">Memuat data...</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <p className="text-sm text-danger font-medium">{error}</p>
                    <Button type="button" variant="outline" size="sm" onClick={fetchData} className="mt-3">
                      Coba Lagi
                    </Button>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-dim text-sm">
                    Tidak ada produk yang akan kadaluarsa dalam {daysAhead} hari.
                  </td>
                </tr>
              ) : (
                data.map((r, i) => {
                  const u = URGENCY(r.days_left);
                  return (
                    <tr key={`${r.sku}-${i}`} className={`hover:bg-muted/40 transition-colors ${u.row}`}>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-heading">{r.item_name}</p>
                        <p className="text-[11px] font-mono text-dim">{r.sku}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-dim">{r.batch_no || '-'}</td>
                      <td className="py-3 px-4 text-heading tnum">{r.expiry_date}</td>
                      <td className="py-3 px-4 text-right tnum font-semibold text-heading">
                        {r.qty.toLocaleString('id-ID')}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold tnum ${
                          r.days_left <= 7 ? 'text-danger' : r.days_left <= 30 ? 'text-warning' : 'text-body'
                        }`}
                      >
                        {r.days_left} hari
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md ${u.color}`}>
                          {u.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
