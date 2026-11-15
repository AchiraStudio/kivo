// src/pages/purchasing/PurchasingDashboard.tsx
import { useState, useEffect } from 'react';
import { getPurchaseOrders, getPurchases, PurchaseOrder, Purchase, cancelPurchaseOrder, getSuppliers, Supplier } from '../../lib/api';
import { Loader2, Plus, FileText, CheckCircle2, Clock, Inbox, X } from 'lucide-react';
import PoDrawer from './PoDrawer';
import ReceiveDrawer from './ReceiveDrawer';
import DirectReceiveModal from './DirectReceiveModal';
import PurchaseDetail from './PurchaseDetail';

export default function PurchasingDashboard() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [view] = useState<'po' | 'purchases'>('purchases');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierFilter, setSupplierFilter] = useState('');

  const [isPoDrawerOpen, setIsPoDrawerOpen] = useState(false);
  const [isDirectReceiveOpen, setIsDirectReceiveOpen] = useState(false);
  const [receivePoId, setReceivePoId] = useState<string | null>(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);

  const DEFAULT_BRANCH_ID = 'branch_001';

  const loadPOs = () => getPurchaseOrders(DEFAULT_BRANCH_ID).then(setPos);
  const loadPurchases = () => getPurchases(DEFAULT_BRANCH_ID).then(setPurchases);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPOs(), loadPurchases(), getSuppliers().then(setSuppliers)]).finally(() => setLoading(false));
  }, []);

  const refreshAll = () => {
    loadPOs();
    loadPurchases();
  };

  const handleCancelPO = async (poId: string) => {
    if (!confirm('Are you sure you want to cancel this Purchase Order?')) return;
    try {
      await cancelPurchaseOrder(poId);
      refreshAll();
    } catch (e: any) {
      alert(e.toString());
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received':
      case 'paid':
        return 'bg-success-soft text-success border-success/30 ';
      case 'sent':
      case 'unpaid':
        return 'bg-info-soft text-info border-info/30 ';
      case 'partial':
        return 'bg-warning-soft text-warning border-warning/30 ';
      default:
        return 'bg-muted text-body border-line ';
    }
  };

  if (selectedPurchaseId) {
    return <PurchaseDetail purchaseId={selectedPurchaseId} onBack={() => setSelectedPurchaseId(null)} />;
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-heading">Penerimaan Barang (Goods Receipt)</h1>
          <p className="text-xs text-dim mt-0.5">Riwayat penerimaan barang masuk dan pencatatan faktur pembelian pemasok.</p>
        </div>
        {view === 'po' ? (
          <button onClick={() => setIsPoDrawerOpen(true)} className="flex items-center gap-1.5 bg-primary text-white px-3.5 py-1.5 rounded-lg font-semibold text-xs shadow-xs hover:bg-primary-hover transition-colors cursor-pointer">
            <Plus size={15} /> Buat PO Baru
          </button>
        ) : (
          <button onClick={() => setIsDirectReceiveOpen(true)} className="flex items-center gap-1.5 bg-success hover:bg-success/90 text-white px-3.5 py-1.5 rounded-lg font-semibold text-xs shadow-xs transition-colors cursor-pointer">
            <Plus size={15} /> Terima Barang Masuk
          </button>
        )}
      </div>

      {/* View Tabs - Purchase Orders tab commented out for now */}
      {/*
      <div className="flex gap-2">
        <button
          onClick={() => setView('po')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${view === 'po' ? 'bg-primary text-white' : 'bg-card border border-line text-body hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          Purchase Orders
        </button>
        <button
          onClick={() => setView('purchases')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${view === 'purchases' ? 'bg-primary text-white' : 'bg-card border border-line text-body hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          Penerimaan Barang (Receive Goods)
        </button>
      </div>
      */}

      {view === 'po' ? (
        <div className="bg-card rounded-2xl border border-line shadow-sm flex-1 overflow-hidden flex flex-col">
          {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div> : (
            <div className="flex-1 overflow-y-auto custom-scrollbar relative"><table className="w-full text-left">
              <thead className="sticky top-0 bg-muted border-b border-line text-xs uppercase text-body font-semibold z-10">
                <tr>
                  <th className="py-4 px-6">PO Number</th>
                  <th className="py-4 px-6">Supplier</th>
                  <th className="py-4 px-6">Expected Date</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {pos.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-dim">No Purchase Orders found. Create your first one!</td></tr>
                ) : pos.map(po => (
                  <tr key={po.id} className="hover:bg-muted/40 group fast-render-row">
                    <td className="py-4 px-6 font-mono text-xs text-body flex items-center gap-2">
                      <FileText size={14} className="text-dim" />
                      {po.id.split('-')[0].toUpperCase()}
                    </td>
                    <td className="py-4 px-6 font-bold">{po.supplier_name}</td>
                    <td className="py-4 px-6 text-body flex items-center gap-1"><Clock size={14}/> {po.expected_date || 'N/A'}</td>
                    <td className="py-4 px-6 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(po.status)}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right flex justify-end gap-2">
                      {po.status !== 'received' && po.status !== 'cancelled' && (
                        <>
                          <button onClick={() => handleCancelPO(po.id)} className="bg-danger-soft text-danger px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-danger/20 transition-colors shadow-sm flex items-center gap-1.5">
                            <X size={14} /> Cancel
                          </button>
                          <button onClick={() => setReceivePoId(po.id)} className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm flex items-center gap-1.5">
                            <Inbox size={14} /> Receive Goods
                          </button>
                        </>
                      )}
                      {po.status === 'received' && (
                        <span className="text-success flex items-center justify-end gap-1 text-xs font-bold uppercase"><CheckCircle2 size={14}/> Completed</span>
                      )}
                      {po.status === 'cancelled' && (
                        <span className="text-danger flex items-center justify-end gap-1 text-xs font-bold uppercase"><X size={14}/> Cancelled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      ) : (
        /* Received Goods List */
        <div className="bg-card rounded-2xl border border-line shadow-sm flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-line bg-muted flex justify-end">
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="bg-card border border-line rounded-lg px-3 py-2 text-sm text-body outline-none focus:border-primary"
            >
              <option value="">All Suppliers</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div> : (
            <div className="flex-1 overflow-y-auto custom-scrollbar relative"><table className="w-full text-left">
              <thead className="sticky top-0 bg-muted border-b border-line text-xs uppercase text-body font-semibold z-10">
                <tr>
                  <th className="py-4 px-6">Invoice No</th>
                  <th className="py-4 px-6">Supplier</th>
                  <th className="py-4 px-6">Total</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {purchases.filter(p => !supplierFilter || p.supplier_id === supplierFilter).length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-dim">No received goods yet.</td></tr>
                ) : purchases.filter(p => !supplierFilter || p.supplier_id === supplierFilter).map(p => (
                  <tr key={p.id} className="hover:bg-muted/40 group fast-render-row">
                    <td className="py-4 px-6 font-bold flex items-center gap-2">
                      <FileText size={14} className="text-dim" />
                      {p.invoice_no || 'No Invoice'}
                    </td>
                    <td className="py-4 px-6 font-semibold">
                      {suppliers.find(s => s.id === p.supplier_id)?.name || 'Unknown Supplier'}
                    </td>
                    <td className="py-4 px-6 font-mono">Rp {p.total_amount.toLocaleString('id-ID')}</td>
                    <td className="py-4 px-6 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedPurchaseId(p.id)}
                        className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* Drawers & Modals */}
      <PoDrawer isOpen={isPoDrawerOpen} onClose={() => setIsPoDrawerOpen(false)} onSuccess={refreshAll} branchId={DEFAULT_BRANCH_ID} />
      {receivePoId && <ReceiveDrawer isOpen={!!receivePoId} poId={receivePoId} branchId={DEFAULT_BRANCH_ID} onClose={() => setReceivePoId(null)} onSuccess={refreshAll} />}
      <DirectReceiveModal isOpen={isDirectReceiveOpen} onClose={() => setIsDirectReceiveOpen(false)} onSuccess={refreshAll} branchId={DEFAULT_BRANCH_ID} />
    </div>
  );
}