import React from 'react';
import { Download, ArrowRight, Zap, QrCode, Check, Layers, ShieldCheck, Globe } from 'lucide-react';
import { scrollToTarget } from '../../utils/scroll';

export const Hero: React.FC = () => {
  return (
    <section className="hero" id="top">
      {/* ─── Sculpted Dimensional Organic Wave Backdrop (Inspirations 1 & 2) ─── */}
      <div className="hero-waves-container" aria-hidden="true">
        <svg
          className="hero-waves-svg"
          viewBox="0 0 1440 960"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMin slice"
        >
          <defs>
            <linearGradient id="hwGradDeep" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="hwGradMagenta" x1="100%" y1="0%" x2="30%" y2="100%">
              <stop offset="0%" stopColor="#CB3CFF" stopOpacity="0.35" />
              <stop offset="45%" stopColor="#8A2BE2" stopOpacity="0.22" />
              <stop offset="85%" stopColor="#0B1739" stopOpacity="0.05" />
            </linearGradient>

            <linearGradient id="hwGradCyan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00C2FF" stopOpacity="0.38" />
              <stop offset="60%" stopColor="#CB3CFF" stopOpacity="0.18" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="hwStrokeCyan" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00C2FF" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#CB3CFF" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#00C2FF" stopOpacity="0.15" />
            </linearGradient>

            <filter id="hwDropShadow1" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="24" stdDeviation="36" floodColor="#020614" floodOpacity="0.7" />
            </filter>

            <filter id="hwDropShadow2" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="16" stdDeviation="24" floodColor="#000000" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Layer 1: Ambient Deep Glow Pods */}
          <circle cx="920" cy="220" r="340" fill="url(#hwGradDeep)" filter="blur(60px)" />
          <circle cx="260" cy="460" r="280" fill="url(#hwGradMagenta)" filter="blur(70px)" />

          {/* Layer 2: Organic Sculpted Wave Contour (Deep Fluid Form) */}
          <path
            d="M 1440,0 L 980,0 C 860,140 820,280 940,410 C 1080,560 1140,680 980,850 C 900,930 820,970 760,1020 L 1440,1020 Z"
            fill="url(#hwGradMagenta)"
            filter="url(#hwDropShadow1)"
          />

          {/* Layer 3: Dynamic Sweeping Wave Shelf */}
          <path
            d="M 1440,120 C 1220,160 1120,320 1240,460 C 1360,600 1380,720 1200,860 C 1100,940 980,980 900,1020 L 1440,1020 Z"
            fill="url(#hwGradCyan)"
            filter="url(#hwDropShadow2)"
          />

          {/* Layer 4: Orbital Constellation Circuit Line (Image 1 Inspiration) */}
          <path
            d="M 80,440 C 220,400 340,490 480,450 C 660,400 820,190 1080,230 C 1240,250 1380,150 1440,90"
            stroke="url(#hwStrokeCyan)"
            strokeWidth="2"
            strokeDasharray="6 8"
            fill="none"
            opacity="0.65"
          />

          {/* Constellation Waypoint Beads */}
          <circle cx="480" cy="450" r="4" fill="#00C2FF" />
          <circle cx="1080" cy="230" r="5" fill="#CB3CFF" />
        </svg>

        {/* Ambient Radial Vignette */}
        <div className="hero-waves-vignette" />
      </div>

      <div className="wrap hero-wrap">
        <div className="hero-top">
          {/* ─── Monumental Full-Page Headline (Solid Pure White, No Gradient) ─── */}
          <h1 className="hero-title">
            Retail, at full speed.<br />
            Offline. Instant. Yours.
          </h1>
          {/* ─── Action Group: Clean, Consistent Hero CTAs ─── */}
          <div className="hero-cta">
            <a className="btn btn-primary hero-btn-main" href="#download">
              <Download size={16} strokeWidth={2.2} />
              <span>Download for Windows</span>
              <ArrowRight size={15} strokeWidth={2.2} />
            </a>

            <a
              className="btn btn-secondary hero-btn-sub"
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                scrollToTarget('features', { offset: 40 });
              }}
            >
              <Layers size={16} strokeWidth={2} />
              <span>Explore Features</span>
            </a>
          </div>

          {/* ─── Trust & Security Micro-Badges ─── */}
          <div className="hero-trust-strip">
            <div className="hero-trust-item">
              <Check size={13} className="text-success" />
              <span>Open Source</span>
            </div>
            <span className="hero-trust-dot">·</span>
            <div className="hero-trust-item">
              <Check size={13} className="text-success" />
              <span>Zero Cloud Lock-in</span>
            </div>
            <span className="hero-trust-dot">·</span>
            <div className="hero-trust-item">
              <Check size={13} className="text-success" />
              <span>Retail &amp; Pharmacy Ready</span>
            </div>
          </div>
        </div>

        {/* ─── Architectural Telemetry Metrics Console ─── */}
        <div className="hero-metrics-strip">
          <div className="hm-item">
            <div className="hm-icon-box color-warning">
              <Zap size={16} />
            </div>
            <div className="hm-info">
              <span className="hm-val">0.0ms</span>
              <span className="hm-desc">Local Latency</span>
            </div>
          </div>

          <div className="hm-divider" />

          <div className="hm-item">
            <div className="hm-icon-box color-success">
              <ShieldCheck size={16} />
            </div>
            <div className="hm-info">
              <span className="hm-val">100%</span>
              <span className="hm-desc">Offline First</span>
            </div>
          </div>

          <div className="hm-divider" />

          <div className="hm-item">
            <div className="hm-icon-box color-accent">
              <Globe size={16} />
            </div>
            <div className="hm-info">
              <span className="hm-val">34 Tables</span>
              <span className="hm-desc">Cloud Sync</span>
            </div>
          </div>

          <div className="hm-divider" />

          <div className="hm-item">
            <div className="hm-icon-box color-primary">
              <QrCode size={16} />
            </div>
            <div className="hm-info">
              <span className="hm-val">LAN QR</span>
              <span className="hm-desc">Mobile POS</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
