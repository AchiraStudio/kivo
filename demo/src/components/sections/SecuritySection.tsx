import React from 'react';
import { KeyRound, Shield, HardDrive } from 'lucide-react';
import { RbacMatrix } from '../interactive/RbacMatrix';

export const SecuritySection: React.FC = () => {
  return (
    <section className="section" id="security">
      <div className="wrap">
        {/* Keynote Header */}
        <div className="sec-head center" data-reveal>
          <div className="eyebrow">
            <span className="eb-dot" />
            SECURITY
          </div>
          <h2 className="h2">Your keys. Your database.</h2>
          <p className="lead">
            Your credentials stay encrypted locally on your machine. Connect directly to your private Supabase.
          </p>
        </div>

        {/* Presentation Split: Visual BYOK Diagram + Interactive RBAC */}
        <div className="split" style={{ alignItems: 'start' }}>
          {/* Visual Sovereignty Flow */}
          <div data-reveal>
            <div className="byok-diagram">
              <div className="bk-node hl">
                <Shield size={18} className="text-primary" />
                <b>Business Owner</b>
                <small>Sole credentials holder</small>
              </div>

              <div className="bk-link" />

              <div className="bk-keys">
                <span className="bk-key">
                  <KeyRound size={13} /> Supabase URL &amp; Key
                </span>
                <span className="bk-key">
                  <KeyRound size={13} /> AI API Key
                </span>
              </div>

              <div className="bk-link" />

              <div className="bk-node">
                <HardDrive size={18} className="text-accent" />
                <b>Local Keyring</b>
                <small>Secured on your local NVMe</small>
              </div>

              <div className="bk-link" />

              <div className="bk-split">
                <div className="bk-node">
                  <b>Local SQLite</b>
                  <small>0ms SSD storage</small>
                </div>
                <div className="bk-node">
                  <b>Private Supabase</b>
                  <small>Mesh sync across stores</small>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Role Permissions Inspector */}
          <div data-reveal style={{ '--d': '100ms' } as React.CSSProperties}>
            <RbacMatrix />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SecuritySection;
