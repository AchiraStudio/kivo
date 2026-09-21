import React from 'react';
import { Download } from 'lucide-react';
import { KivoMark, GithubIcon } from '../common/BrandLogo';

export const DownloadSection: React.FC = () => {
  return (
    <section className="section" id="download">
      <div className="wrap">
        {/* Presentation Closing Header */}
        <div className="sec-head center" data-reveal>
          <div className="eyebrow">
            <span className="eb-dot" />
            DOWNLOAD
          </div>
          <h2 className="h2">Ready to run your store?</h2>
          <p className="lead">
            Download Kivo v1.4.0 for Windows 10 &amp; 11. Free, local, and open source.
          </p>
        </div>

        {/* Central Keynote Download Stage */}
        <div style={{ maxWidth: '640px', margin: '0 auto' }} data-reveal>
          <div className="card dl-card" style={{ textAlign: 'center', padding: '44px 36px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <KivoMark size={48} />
            </div>

            <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--heading)' }}>
              Kivo for Windows
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--body)', marginTop: '6px', marginBottom: '26px' }}>
              Release v1.4.0 · 64-bit MSI &amp; Portable
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a
                className="btn btn-primary"
                href="https://github.com/AchiraStudio/kivo/releases"
                target="_blank"
                rel="noopener noreferrer"
                style={{ width: '100%', justifyContent: 'center', height: '52px', fontSize: '15.5px' }}
              >
                <Download size={18} />
                <span>Download Installer (.msi)</span>
              </a>

              <a
                className="btn btn-secondary"
                href="https://github.com/AchiraStudio/kivo"
                target="_blank"
                rel="noopener noreferrer"
                style={{ width: '100%', justifyContent: 'center', height: '48px', fontSize: '14.5px' }}
              >
                <GithubIcon size={16} />
                <span>View on GitHub</span>
              </a>
            </div>

            {/* Technical Trust Strip */}
            <div className="download-spec-row">
              <span className="spec-meta-item">
                <span className="spec-meta-dot g" /> 100% OFFLINE
              </span>
              <span className="spec-meta-sep">/</span>
              <span className="spec-meta-item">
                <span className="spec-meta-dot c" /> MIT OPEN SOURCE
              </span>
              <span className="spec-meta-sep">/</span>
              <span className="spec-meta-item">
                <span className="spec-meta-dot p" /> ~15MB BINARY
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DownloadSection;
