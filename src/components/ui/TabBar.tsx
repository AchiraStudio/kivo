import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon: LucideIcon;
  badge?: number | string | null;
}

interface TabBarProps<T extends string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  rightAction?: React.ReactNode;
}

export default function TabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  rightAction,
}: TabBarProps<T>) {
  return (
    <div className="flex items-center justify-between gap-2 shrink-0 max-w-full">
      <div
        role="tablist"
        className="flex flex-nowrap items-center gap-0.5 bg-muted p-0.5 rounded-lg border border-line overflow-x-auto max-w-full custom-scrollbar"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive
                  ? 'bg-card text-heading border border-line'
                  : 'text-dim hover:text-heading border border-transparent'
              }`}
            >
              <Icon size={13} strokeWidth={1.75} className="shrink-0" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== null && (
                <span className="ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full bg-primary-soft text-primary font-bold tnum">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {rightAction && <div className="shrink-0">{rightAction}</div>}
    </div>
  );
}
