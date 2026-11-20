import { useState } from 'react';
import { PackageCheck, Truck } from 'lucide-react';
import PurchasingDashboard from './PurchasingDashboard';
import SupplierList from '../suppliers/SupplierList';
import TabBar, { TabItem } from '../../components/ui/TabBar';

type TabType = 'receive' | 'suppliers';

const tabs: TabItem<TabType>[] = [
  { id: 'receive', label: 'Penerimaan Barang', icon: PackageCheck },
  { id: 'suppliers', label: 'Pemasok', icon: Truck },
];

export default function PurchasingPage() {
  const [activeTab, setActiveTab] = useState<TabType>('receive');

  return (
    <div className="flex flex-col h-full gap-4">
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {activeTab === 'receive' && <PurchasingDashboard />}
        {activeTab === 'suppliers' && <SupplierList />}
      </div>
    </div>
  );
}
