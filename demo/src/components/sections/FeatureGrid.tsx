import React, { useState } from 'react';
import {
  ShoppingCart,
  Package,
  BookOpen,
  Truck,
  Users,
  Cloud,
  ArrowRight,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

interface PillarItem {
  id: string;
  tabId: string;
  name: string;
  headline: string;
  summary: string;
  telemetryTag: string;
  icon: React.ElementType;
  color: string;
  highlights: { label: string; detail: string }[];
}

const PILLARS: PillarItem[] = [
  {
    id: 'pos',
    tabId: 'pos',
    name: 'Point of Sale',
    headline: 'Barcode Checkout & Thermal Printing',
    summary: 'Instant product search, split tender (Cash, QRIS, Cards), and raw ESC/POS thermal printing.',
    telemetryTag: '0ms Commit',
    icon: ShoppingCart,
    color: 'var(--primary)',
    highlights: [
      { label: 'Instant Scan', detail: '0-delay barcode scan and product lookup' },
      { label: 'Split Tender', detail: 'Combine Cash, QRIS, Cards, and Store Credit' },
      { label: 'Hardware Native', detail: 'Direct ESC/POS receipt prints and drawer kick' },
    ],
  },
  {
    id: 'inventory',
    tabId: 'inventory',
    name: 'Inventory & Units',
    headline: 'Multi-Tier Units & Batch FIFO',
    summary: 'Automated Box → Pack → Pcs conversions, strict FIFO expiry lot tracking, and rapid stock opname.',
    telemetryTag: '3-Tier Units',
    icon: Package,
    color: 'var(--accent)',
    highlights: [
      { label: 'Unit Ratios', detail: 'Automated Box, Pack, and Pcs conversion tiers' },
      { label: 'Batch Expiry', detail: 'FIFO tracking with proactive expiry warnings' },
      { label: 'Stock Opname', detail: 'Real-time variance reconciliation' },
    ],
  },
  {
    id: 'accounting',
    tabId: 'reports',
    name: 'General Ledger',
    headline: 'Automated Double-Entry Ledger',
    summary: 'Every register sale, receipt, and return automatically creates balanced journal vouchers.',
    telemetryTag: 'Double-Entry',
    icon: BookOpen,
    color: 'var(--warning)',
    highlights: [
      { label: 'Auto Journaling', detail: 'Zero manual bookkeeping for daily transactions' },
      { label: 'Live Financials', detail: 'Instant Profit & Loss, Balance Sheet, and Trial Balance' },
      { label: 'Standard COA', detail: 'Full Chart of Accounts for Assets, Liabilities & Equity' },
    ],
  },
  {
    id: 'purchasing',
    tabId: 'purchasing',
    name: 'Procurement',
    headline: 'Purchase Orders & Landed Cost',
    summary: 'Purchase orders, partial receiving slips, automated COGS updates, and payables aging.',
    telemetryTag: 'Auto COGS',
    icon: Truck,
    color: 'var(--success)',
    highlights: [
      { label: 'Supplier POs', detail: 'Create and track purchase orders with ease' },
      { label: 'Goods Receiving', detail: 'Inspect shipments with immediate stock increments' },
      { label: 'Payables Aging', detail: 'Track supplier invoices and due dates' },
    ],
  },
  {
    id: 'customers',
    tabId: 'customers',
    name: 'Loyalty & CRM',
    headline: 'Customer Profiles & VIP Tiers',
    summary: 'Cross-branch customer profiles, reward points accrual, and safe store credit limits.',
    telemetryTag: 'VIP Tiers',
    icon: Users,
    color: 'var(--primary)',
    highlights: [
      { label: 'Store Profiles', detail: 'Track customer lifetime spend and visits' },
      { label: 'Reward Points', detail: 'Automated points redemption at register' },
      { label: 'Credit Lines', detail: 'Store credit for trusted wholesale accounts' },
    ],
  },
  {
    id: 'cloud',
    tabId: 'dashboard',
    name: 'Supabase Mesh',
    headline: 'Private Supabase Cloud Sync',
    summary: 'Direct connection to your private Supabase database. Local-first persistence with sovereign cloud sync.',
    telemetryTag: 'BYOK Sync',
    icon: Cloud,
    color: 'var(--accent)',
    highlights: [
      { label: '100% BYOK', detail: 'Direct connection to your private credentials' },
      { label: 'Local-First SSD', detail: 'Instant local commits, background cloud sync' },
      { label: 'Multi-Store', detail: 'Centralized catalog and branch reports' },
    ],
  },
];

export const FeatureGrid: React.FC = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = PILLARS[activeIdx];
  const ActiveIcon = active.icon;

  return (
    <section className="section" id="features">
      <div className="wrap">
        {/* Section Header */}
        <div className="sec-head center" data-reveal>
          <div className="eyebrow">
            <span className="eb-dot" />
            CAPABILITIES
          </div>
          <h2 className="h2">All-in-one store engine.</h2>
          <p className="lead">
            From barcode checkout to double-entry ledger — zero latency, zero bloat.
          </p>
        </div>

        {/* Architectural Segmented Deck */}
        <div className="pillar-stage" data-reveal>
          <div className="deck-tabs" role="tablist">
            {PILLARS.map((p, idx) => {
              const isSelected = idx === activeIdx;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`deck-tab ${isSelected ? 'active' : ''}`}
                  onClick={() => setActiveIdx(idx)}
                >
                  <span className="deck-num">0{idx + 1}</span>
                  <span className="deck-name">{p.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Pillar Showcase Card */}
          <div className="deck-display">
            <div className="deck-telemetry">
              <div className="deck-spec-row">
                <div className="deck-icon-bubble" style={{ color: active.color, background: `color-mix(in srgb, ${active.color} 14%, transparent)` }}>
                  <ActiveIcon size={24} />
                </div>
                <div>
                  <span className="deck-spec-tag">{active.telemetryTag}</span>
                  <h3 className="deck-title">{active.headline}</h3>
                </div>
              </div>
            </div>

            <p className="deck-summary">{active.summary}</p>

            {/* 3 Presentation Highlights */}
            <div className="deck-hl-grid">
              {active.highlights.map((h, i) => (
                <div key={i} className="deck-hl-item">
                  <div className="deck-hl-bar" style={{ background: active.color }} />
                  <div>
                    <h4 className="deck-hl-label">{h.label}</h4>
                    <p className="deck-hl-detail">{h.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Direct Action Link */}
            <div className="deck-footer">
              <a
                href="#download"
                className="btn btn-primary"
              >
                <Sparkles size={15} />
                <span>Get Started with Kivo</span>
                <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>

        {/* Monolith Quick-Select Grid */}
        <div className="deck-card-grid" data-reveal>
          {PILLARS.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = idx === activeIdx;
            return (
              <div
                key={item.id}
                className={`deck-card ${isSelected ? 'active' : ''}`}
                onClick={() => setActiveIdx(idx)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveIdx(idx);
                  }
                }}
              >
                <span className="deck-card-watermark">0{idx + 1}</span>
                <div className="deck-card-header">
                  <div className="deck-card-icon" style={{ color: item.color }}>
                    <Icon size={20} />
                  </div>
                  <span className="deck-card-spec">{item.telemetryTag}</span>
                </div>
                <h4 className="deck-card-name">{item.name}</h4>
                <p className="deck-card-summary">{item.summary}</p>
                <div className="deck-card-arrow">
                  <span>View Details</span>
                  <ArrowUpRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeatureGrid;
