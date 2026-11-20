import { useState } from 'react';
import { FileText, BookOpen } from 'lucide-react';
import Reports from './Reports';
import Accounting from '../accounting/Accounting';
import TabBar, { TabItem } from '../../components/ui/TabBar';

type TabType = 'reports' | 'accounting';

const tabs: TabItem<TabType>[] = [
  { id: 'reports', label: 'Laporan', icon: FileText },
  { id: 'accounting', label: 'Akuntansi', icon: BookOpen },
];

export default function ReportsAccountingPage() {
  const [activeTab, setActiveTab] = useState<TabType>('reports');

  return (
    <div className="flex flex-col h-full gap-4">
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'accounting' && <Accounting />}
      </div>
    </div>
  );
}
