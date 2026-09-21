import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  Database,
  Atom,
  Braces,
  Cloud,
  Boxes,
  Wifi,
  Sparkles,
} from 'lucide-react';

export const TechArchitecture: React.FC = () => {
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="sec-head center" data-reveal>
          <div className="eyebrow">
            <span className="eb-dot" />
            ARCHITECTURE
          </div>
          <h2 className="h2">Native speed. 15MB binary.</h2>
          <p className="lead">
            Built with Rust and Tauri v2 on local SQLite. No Electron, no Chromium runtime overhead.
          </p>
        </div>

        <div className="arch">
          {/* Keynote Visual Architecture Stack */}
          <div className="stack" data-reveal>
            <div className="layer">
              <span className="l-ic color-primary">
                <LayoutDashboard size={20} />
              </span>
              <div>
                <b>React 19 + TypeScript</b>
                <small>60fps desktop UI with hardware acceleration</small>
              </div>
            </div>

            <span className="bk-link" />

            <div className="layer">
              <span className="l-ic color-warning">
                <Cpu size={20} />
              </span>
              <div>
                <b>Tauri v2 + Rust</b>
                <small>15MB binary footprint with memory-safe concurrency</small>
              </div>
            </div>

            <span className="bk-link" />

            <div className="layer">
              <span className="l-ic color-accent">
                <Database size={20} />
              </span>
              <div>
                <b>SQLite (WAL Mode)</b>
                <small>Sub-millisecond ACID transactions on local SSD</small>
              </div>
            </div>

            {/* Downstream Connectors */}
            <div className="arch-branches">
              <div className="bk-node">
                <Wifi size={16} className="text-primary" />
                <b>LAN P2P</b>
                <small>Local UDP sync</small>
              </div>
              <div className="bk-node">
                <Cloud size={16} className="text-accent" />
                <b>Supabase</b>
                <small>Cloud sync</small>
              </div>
              <div className="bk-node">
                <Sparkles size={16} className="text-warning" />
                <b>Kivo AI</b>
                <small>BYOK Copilot</small>
              </div>
            </div>
          </div>

          {/* Core Technology Spec Badges */}
          <div data-reveal style={{ '--d': '100ms' } as React.CSSProperties}>
            <div className="tech-badge-deck" style={{ justifyContent: 'center' }}>
              <div className="tech-badge">
                <Cpu size={14} /> <span>Rust Core</span>
              </div>
              <div className="tech-badge">
                <LayoutDashboard size={14} /> <span>Tauri v2</span>
              </div>
              <div className="tech-badge">
                <Database size={14} /> <span>SQLite WAL</span>
              </div>
              <div className="tech-badge">
                <Atom size={14} /> <span>React 19</span>
              </div>
              <div className="tech-badge">
                <Braces size={14} /> <span>TypeScript</span>
              </div>
              <div className="tech-badge">
                <Cloud size={14} /> <span>Supabase</span>
              </div>
              <div className="tech-badge">
                <Boxes size={14} /> <span>Zustand</span>
              </div>
            </div>

            {/* 3 Presentation Metric Pillars */}
            <div className="arch-kpis" style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div className="panel" style={{ textAlign: 'center', padding: '18px 14px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)', display: 'block', fontFamily: 'ui-monospace, monospace' }}>~15 MB</span>
                <span style={{ fontSize: '11px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Installer Payload</span>
              </div>
              <div className="panel" style={{ textAlign: 'center', padding: '18px 14px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent)', display: 'block', fontFamily: 'ui-monospace, monospace' }}>&lt; 40 MB</span>
                <span style={{ fontSize: '11px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Idle Memory (RAM)</span>
              </div>
              <div className="panel" style={{ textAlign: 'center', padding: '18px 14px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--success)', display: 'block', fontFamily: 'ui-monospace, monospace' }}>0.2 ms</span>
                <span style={{ fontSize: '11px', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Local SSD Commit</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TechArchitecture;
