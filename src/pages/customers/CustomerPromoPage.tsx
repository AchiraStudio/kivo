import { useState } from 'react';
import { Users, Tag } from 'lucide-react';
import CustomerList from './CustomerList';
import PromoList from '../promos/PromoList';
import TabBar, { TabItem } from '../../components/ui/TabBar';

type TabType = 'customers' | 'promos';

const tabs: TabItem<TabType>[] = [
  { id: 'customers', label: 'Pelanggan', icon: Users },
  { id: 'promos', label: 'Promosi', icon: Tag },
];

export default function CustomerPromoPage() {
  const [activeTab, setActiveTab] = useState<TabType>('customers');

  return (
    <div className="flex flex-col h-full gap-4">
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {activeTab === 'customers' && <CustomerList />}
        {activeTab === 'promos' && <PromoList />}
      </div>
    </div>
  );
}
