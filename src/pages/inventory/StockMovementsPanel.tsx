import { useState, useEffect } from 'react';
import { Loader2, ArrowUpRight, ArrowDownRight, History, AlertCircle } from 'lucide-react';
import { StockOverviewRow, getStockMovements, StockMovementRow } from '../../lib/api';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';

interface StockMovementsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  item: StockOverviewRow | null;
  branchId: string;
}

export default function StockMovementsPanel({ isOpen, onClose, item, branchId }: StockMovementsPanelProps) {
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadMovements = () => {
    if (!item) return;
    setLoading(true);
    setErrorMsg(null);
    getStockMovements(item.item_id, branchId)
      .then((data) => {
        setMovements(data);
      })
      .catch((err) => {
        console.error(err);
        setErrorMsg(err?.message || String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen && item) {
      loadMovements();
    }
  }, [isOpen, item, branchId]);

  if (!isOpen || !item) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Riwayat Mutasi Stok"
      subtitle={item.item_name}
      icon={History}
    >
      <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-dim">
            <Loader2 className="animate-spin mb-3 text-primary" size={24} />
            <p className="text-xs font-medium">Memuat mutasi stok...</p>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle size={24} className="text-danger mb-2" />
            <p className="text-sm font-semibold text-heading">Gagal memuat mutasi</p>
            <p className="text-xs text-dim mt-1 mb-3">{errorMsg}</p>
            <Button variant="outline" size="sm" onClick={loadMovements}>
              Coba Lagi
            </Button>
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center text-dim py-16 text-sm">Belum ada catatan mutasi stok.</div>
        ) : (
          <div className="space-y-2.5">
            {movements.map((mov) => (
              <div
                key={mov.id}
                className="p-3.5 border border-line rounded-xl bg-card flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs text-dim tnum">
                      {new Date(mov.created_at).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-muted text-body border border-line">
                      {mov.source_type}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-heading truncate">{mov.notes || 'Entri Sistem'}</p>
                  {(mov.batch_no || mov.expiry_date) && (
                    <p className="text-[11px] font-mono text-dim mt-1 tnum">
                      {mov.batch_no && `Batch: ${mov.batch_no}`}
                      {mov.batch_no && mov.expiry_date ? ' | ' : ''}
                      {mov.expiry_date && `Exp: ${mov.expiry_date}`}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`font-mono font-bold text-sm flex items-center justify-end gap-1 tnum ${
                      mov.direction === 'in' ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {mov.direction === 'in' ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                    {mov.direction === 'in' ? '+' : '-'}
                    {Math.abs(mov.qty_change)}
                  </p>
                  <p className="text-[11px] text-dim font-mono mt-0.5 tnum">Sisa: {mov.running_total}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
