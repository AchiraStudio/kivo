import { useState, useEffect } from 'react';
import { Loader2, Trophy, Medal } from 'lucide-react';
import { getCustomerReport, CustomerReportRow } from '../../lib/api';
import ReportHeader from '../../components/reports/ReportHeader';
import { getFirstOfMonthDateString, getTodayDateString } from './reportUtils';
import Button from '../../components/ui/Button';

interface Props {
  onBack: () => void;
}

const TIER: Record<string, { label: string; color: string }> = {
  regular: { label: 'Regular', color: 'bg-muted text-body' },
  member: { label: 'Member', color: 'bg-accent-soft text-accent' },
  vip: { label: 'VIP', color: 'bg-warning-soft text-warning' },
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-warning-soft text-warning"
        title="Peringkat 1"
      >
        <Trophy size={13} strokeWidth={1.75} />
      </span>
    );
  }
  if (rank === 1) {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-body"
        title="Peringkat 2"
      >
        <Medal size={13} strokeWidth={1.75} />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-warning-soft text-warning"
        title="Peringkat 3"
      >
        <Medal size={13} strokeWidth={1.75} />
      </span>
    );
  }
  return <span className="text-xs tnum text-dim font-semibold pl-1.5">{rank + 1}</span>;
}

export default function LaporanPelanggan({ onBack }: Props) {
  const [dateFrom, setDateFrom] = useState(getFirstOfMonthDateString());
  const [dateTo, setDateTo] = useState(getTodayDateString());
  const [data, setData] = useState<CustomerReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getCustomerReport('branch_001', dateFrom, dateTo, 50));
    } catch (e) {
      console.error(e);
      setError('Gagal memuat laporan pelanggan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-full">
      <ReportHeader
        title="Laporan Pelanggan"
        onBack={onBack}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onFetch={fetchData}
      />

      <div className="bg-card rounded-xl border border-line flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/60 border-b border-line text-xs text-dim font-semibold sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4">Nama Pelanggan</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4 text-right">Transaksi</th>
                <th className="py-3 px-4 text-right">Total Belanja</th>
                <th className="py-3 px-4 text-right">Rata-rata / Transaksi</th>
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
                    Tidak ada data pada periode ini.
                  </td>
                </tr>
              ) : (
                data.map((r, i) => {
                  const tier = TIER[r.customer_tier] || TIER.regular;
                  const avg = r.transaction_count > 0 ? r.total_spent / r.transaction_count : 0;
                  return (
                    <tr
                      key={`${r.customer_name}-${i}`}
                      className={`hover:bg-muted/40 transition-colors ${i < 3 ? 'bg-warning-soft/25' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <RankBadge rank={i} />
                      </td>
                      <td className="py-3 px-4 font-semibold text-heading">{r.customer_name}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md ${tier.color}`}>
                          {tier.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right tnum text-heading">{r.transaction_count}</td>
                      <td className="py-3 px-4 text-right tnum font-semibold text-heading">
                        Rp {r.total_spent.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right tnum text-dim">
                        Rp {avg.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
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
