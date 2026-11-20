import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getOutstandingPayables, OutstandingPayableRow } from '../../lib/api';
import ReportHeader from '../../components/reports/ReportHeader';
import Button from '../../components/ui/Button';

interface Props {
  onBack: () => void;
}

export default function LaporanHutang({ onBack }: Props) {
  const [data, setData] = useState<OutstandingPayableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getOutstandingPayables('branch_001'));
    } catch (e) {
      console.error(e);
      setError('Gagal memuat data hutang dagang.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalBalance = data.reduce((s, r) => s + r.balance, 0);
  const overdue = data.filter((r) => {
    const days = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return days > 30;
  }).length;

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-full">
      <ReportHeader title="Hutang Dagang (AP)" onBack={onBack}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          aria-label="Muat ulang"
          title="Muat ulang"
          className="px-2"
        >
          <RefreshCw size={14} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
        </Button>
      </ReportHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
        <div className="bg-card rounded-xl border border-line p-4">
          <p className="text-xs font-medium text-dim">Total Hutang</p>
          <p className="text-xl font-bold text-danger tnum mt-1">
            Rp {totalBalance.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-line p-4">
          <p className="text-xs font-medium text-dim">Jumlah Faktur</p>
          <p className="text-xl font-bold text-heading tnum mt-1">{data.length}</p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            overdue > 0 ? 'bg-warning-soft border-warning/30' : 'bg-card border-line'
          }`}
        >
          <p className="text-xs font-medium text-dim">Lewat 30 Hari</p>
          <p className={`text-xl font-bold tnum mt-1 ${overdue > 0 ? 'text-warning' : 'text-heading'}`}>
            {overdue}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-line flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/60 border-b border-line text-xs text-dim font-semibold sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Pemasok</th>
                <th className="py-3 px-4">No. Faktur</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Sudah Bayar</th>
                <th className="py-3 px-4 text-right">Sisa</th>
                <th className="py-3 px-4">Tanggal</th>
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
                  <td colSpan={6} className="py-16 text-center text-success font-medium">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <CheckCircle2 size={16} strokeWidth={1.75} />
                      Tidak ada hutang yang belum dibayar.
                    </span>
                  </td>
                </tr>
              ) : (
                data.map((r) => {
                  const daysOld = Math.floor(
                    (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const isOld = daysOld > 30;
                  return (
                    <tr
                      key={r.purchase_id}
                      className={`hover:bg-muted/40 transition-colors ${
                        isOld ? 'bg-warning-soft/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-semibold text-heading">{r.supplier_name}</td>
                      <td className="py-3 px-4 font-mono text-xs text-dim">{r.invoice_no || '-'}</td>
                      <td className="py-3 px-4 text-right tnum text-heading">
                        Rp {r.total_amount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right tnum text-success">
                        Rp {r.paid_amount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right tnum font-bold text-danger">
                        Rp {r.balance.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {isOld && <AlertTriangle size={13} strokeWidth={1.75} className="text-warning shrink-0" />}
                          <span className={`text-xs tnum ${isOld ? 'text-warning font-semibold' : 'text-dim'}`}>
                            {new Date(r.created_at).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {data.length > 0 && !loading && !error && (
              <tfoot className="bg-muted/60 border-t border-line text-sm font-bold">
                <tr>
                  <td className="py-3 px-4 text-heading" colSpan={4}>
                    Total Hutang
                  </td>
                  <td className="py-3 px-4 text-right tnum text-danger">
                    Rp {totalBalance.toLocaleString('id-ID')}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
