import { useState, useEffect, useCallback } from 'react';
import { Customer, getSales, Sale } from '../../lib/api';
import { UserCircle, Crown, Loader2, History, Award, ShoppingCart, HeartPulse, RefreshCw } from 'lucide-react';
import ReceiptModal from '../pos/ReceiptModal';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import TabBar, { TabItem } from '../../components/ui/TabBar';
import HealthRecordsPanel from './health/HealthRecordsPanel';

export type ProfileTab = 'purchases' | 'health';

const PROFILE_TABS: TabItem<ProfileTab>[] = [
  { id: 'purchases', label: 'Riwayat Belanja', icon: History },
  { id: 'health', label: 'Kesehatan', icon: HeartPulse },
];

const TIER_LABEL: Record<string, string> = {
  vip: 'VIP',
  member: 'Member',
  regular: 'Reguler',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  initialTab?: ProfileTab;
}

export default function CustomerProfileDrawer({ isOpen, onClose, customer, initialTab = 'purchases' }: Props) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileTab>('purchases');

  useEffect(() => {
    if (isOpen) setTab(initialTab);
  }, [isOpen, customer?.id, initialTab]);

  const loadSales = useCallback(() => {
    if (!customer || customer.id === 'customer_umum') {
      setSales([]);
      setSalesError(null);
      return;
    }
    setLoading(true);
    setSalesError(null);
    getSales('branch_001', customer.id)
      .then(setSales)
      .catch(e => setSalesError(String(e)))
      .finally(() => setLoading(false));
  }, [customer]);

  useEffect(() => {
    if (isOpen) loadSales();
  }, [isOpen, loadSales]);

  if (!isOpen || !customer) return null;

  const tierCls =
    customer.customer_tier === 'vip'
      ? 'bg-warning-soft text-warning border-warning/30'
      : customer.customer_tier === 'member'
      ? 'bg-accent-soft text-accent border-accent/30'
      : 'bg-muted text-body border-line';

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        title={customer.name}
        subtitle={customer.phone || undefined}
        icon={UserCircle}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/50 px-3.5 py-3 rounded-xl border border-line">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${tierCls}`}>
                {customer.customer_tier === 'vip' && <Crown size={11} />}
                {TIER_LABEL[customer.customer_tier] ?? customer.customer_tier}
              </span>
              {customer.membership_expiry && customer.customer_tier !== 'regular' && (
                <span className="text-xs text-dim tnum">s/d {customer.membership_expiry.split(' ')[0]}</span>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-success-soft text-success border border-success/30 tnum">
              <Award size={12} /> {(customer.loyalty_points ?? 0).toLocaleString('id-ID')} Poin
            </span>
          </div>

          <TabBar tabs={PROFILE_TABS} activeTab={tab} onTabChange={setTab} />

          {tab === 'health' && <HealthRecordsPanel customer={customer} />}

          {tab === 'purchases' && (
            <div>
              {loading ? (
                <div className="py-12 text-center" role="status" aria-label="Memuat riwayat belanja">
                  <Loader2 className="animate-spin text-primary mx-auto" size={24} />
                </div>
              ) : salesError ? (
                <div className="py-10 text-center bg-danger-soft/40 rounded-xl border border-danger/30 px-4">
                  <p className="text-sm font-semibold text-danger">Riwayat belanja gagal dimuat</p>
                  <p className="text-xs text-dim mt-1 break-words">{salesError}</p>
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={loadSales}>
                      <RefreshCw size={13} /> Coba lagi
                    </Button>
                  </div>
                </div>
              ) : sales.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-line-strong rounded-xl px-4">
                  <ShoppingCart size={26} className="mx-auto text-dim mb-2" />
                  <p className="text-sm font-semibold text-heading">Belum ada transaksi</p>
                  <p className="text-xs text-dim mt-1">Transaksi pelanggan di kasir akan muncul di sini.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sales.map(s => (
                    <div
                      key={s.id}
                      className="bg-card border border-line rounded-xl px-3.5 py-3 flex items-center justify-between gap-3 hover:border-line-strong transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-heading truncate">{s.transaction_no}</p>
                        <p className="text-xs text-dim mt-0.5 tnum">{new Date(s.created_at).toLocaleString('id-ID')}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="font-bold text-heading text-sm tnum">
                          Rp {s.grand_total.toLocaleString('id-ID')}
                        </p>
                        <Button type="button" variant="outline" size="sm" onClick={() => setReceiptSaleId(s.id)}>
                          Struk
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Drawer>

      {receiptSaleId && <ReceiptModal saleId={receiptSaleId} onClose={() => setReceiptSaleId(null)} />}
    </>
  );
}
