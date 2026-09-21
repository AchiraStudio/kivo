import React from 'react';
import { BrandLogo } from '../common/BrandLogo';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <a className="brand" href="#top">
              <BrandLogo size={28} />
            </a>
            <p>
              Offline-first desktop POS &amp; ERP for retail and pharmacy. Fast, local, and self-sovereign.
            </p>
          </div>
          <div className="foot-col">
            <h5>Modules</h5>
            <a href="#pos">Point of Sale</a>
            <a href="#inventory">Multi-Tier Inventory</a>
            <a href="#purchasing">Procurement</a>
            <a href="#accounting">Double-Entry Books</a>
            <a href="#customers">Loyalty &amp; Promos</a>
            <a href="#ai">AI Copilot</a>
          </div>
          <div className="foot-col">
            <h5>Architecture</h5>
            <a href="#cloud">Supabase Cloud Sync</a>
            <a href="#offline">Offline SQLite Engine</a>
            <a href="#how">LAN Multi-Terminal</a>
            <a href="#hardware">Thermal Hardware</a>
            <a href="#security">BYOK Security</a>
            <a href="#how">Native Rust Runtime</a>
          </div>
          <div className="foot-col">
            <h5>Resources</h5>
            <a href="https://github.com/AchiraStudio/kivo" target="_blank" rel="noopener noreferrer">
              GitHub Repository
            </a>
            <a href="https://github.com/AchiraStudio/kivo#readme" target="_blank" rel="noopener noreferrer">
              Documentation
            </a>
            <a href="https://github.com/AchiraStudio/kivo/releases" target="_blank" rel="noopener noreferrer">
              Release Notes (v1.4.0)
            </a>
            <a href="https://github.com/AchiraStudio/kivo/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
              MIT License
            </a>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© {currentYear} AchiraStudio · Kivo</span>
          <span>Local-first, open-source retail engine.</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
