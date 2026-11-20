import { useState, useEffect } from 'react';
import { Loader2, CreditCard, Banknote, Smartphone, ArrowRightLeft } from 'lucide-react';
import { getSalesByPaymentMethod, PaymentMethodRow } from '../../lib/api';
import ReportHeader from '../../components/reports/ReportHeader';
import { getFirstOfMonthDateString, getTodayDateString } from './reportUtils';
import Button from '../../components/ui/Button';

interface Props {
  onBack: () => void;
}

const METHOD_LABEL: Record<string, { label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; color: string }> = {
  cash: { label: 'Tunai', icon: Banknote, color: 'bg-success' },
  transfer: { label: 'Transfer Bank', icon: ArrowRightLeft, color: 'bg-accent' },
  debit: { label: 'Kartu Debit', icon: CreditCard, color: 'bg-primary' },
  credit: { label: 'Kartu Kredit', icon: CreditCard, color: 'bg-primary' },
  qris: { label: 'QRIS / E-Wallet', icon: Smartphone, color: 'bg-warning' },
  card: { label: 'Kartu', icon: CreditCard, color: 'bg-primary' },
};

export default function LaporanMetodePembayaran({ onBack }: Props) {
  const [dateFrom, setDateFrom] = useState(getFirstOfMonthDateString());
  const [dateTo, setDateTo] = useState(getTodayDateString());
  const [data, setData] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getSalesByPaymentMethod('branch_001', dateFrom, dateTo));
    } catch (e) {
      console.error(e);
      setError('Gagal memuat data metode pembayaran.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalAmount = data.reduce((s, r) => s + r.total_amount, 0);

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-full">
      <ReportHeader
        title="Metode Pembayaran"
        onBack={onBack}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onFetch={fetchData}
      />

      {loading ? (
        <div className="flex-1 bg-card rounded-xl border border-line flex flex-col items-center justify-center text-dim">
          <Loader2 className="animate-spin text-primary mb-2" size={24} />
          <span className="text-xs">Memuat data...</span>
        </div>
      ) : error ? (
        <div className="flex-1 bg-card rounded-xl border border-line flex flex-col items-center justify-center">
          <p className="text-sm text-danger font-medium">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={fetchData} className="mt-3">
            Coba Lagi
          </Button>
        </div>
      ) : data.length === 0 ? (
        <div className="flex-1 bg-card rounded-xl border border-line flex items-center justify-center text-dim text-sm">
          Tidak ada data pada periode ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-3">
            {data.map((r) => {
              const m = METHOD_LABEL[r.method] || { label: r.method, icon: CreditCard, color: 'bg-dim' };
              const Icon = m.icon;
              const pct = totalAmount > 0 ? (r.total_amount / totalAmount) * 100 : 0;
              return (
                <div key={r.method} className="bg-card rounded-xl border border-line p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-muted text-heading flex items-center justify-center shrink-0">
                        <Icon size={17} strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-heading text-sm truncate">{m.label}</p>
                        <p className="text-xs text-dim tnum">{r.transaction_count} transaksi</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-heading text-sm tnum">
                        Rp {r.total_amount.toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs font-semibold text-dim tnum">{pct.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${m.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-card rounded-xl border border-line p-5 h-fit">
            <h2 className="text-xs font-medium text-dim">Total Pembayaran</h2>
            <p className="text-2xl font-bold text-heading tnum mt-1 mb-5">
              Rp {totalAmount.toLocaleString('id-ID')}
            </p>
            <div className="divide-y divide-line">
              {data.map((r) => {
                const m = METHOD_LABEL[r.method] || { label: r.method, icon: CreditCard, color: 'bg-dim' };
                const pct = totalAmount > 0 ? (r.total_amount / totalAmount) * 100 : 0;
                return (
                  <div key={r.method} className="flex justify-between items-center py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${m.color}`} />
                      <span className="text-sm text-heading">{m.label}</span>
                    </div>
                    <span className="font-semibold text-sm text-heading tnum">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
