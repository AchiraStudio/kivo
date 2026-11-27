import { useEffect, useRef, useState } from 'react';
import { Cloud, Laptop, Smartphone, Tablet, Wifi, WifiOff, Globe, GlobeLock, Database } from 'lucide-react';
import { useI18n } from '../i18n';
import { AppFrame, type AppFrameHandle } from '../AppFrame';

function Toggle({ on, onChange, label, icon: Icon, offIcon: OffIcon }: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon: typeof Wifi;
  offIcon: typeof Wifi;
}) {
  const I = on ? Icon : OffIcon;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`h-14 pl-4 pr-3 inline-flex items-center gap-3 rounded-2xl border cursor-pointer transition-all ${
        on ? 'bg-card border-line text-heading' : 'bg-danger-soft border-danger/30 text-danger'
      }`}
    >
      <I size={19} />
      <span className="text-[15px] font-bold">{label}</span>
      <span className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-success' : 'bg-line-strong'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export function Offline() {
  const { t } = useI18n();
  const phone = useRef<AppFrameHandle>(null);
  const [wifi, setWifi] = useState(true);
  const [internet, setInternet] = useState(true);
  const [sales, setSales] = useState(23);
  const [queued, setQueued] = useState(0);
  const internetRef = useRef(internet);
  internetRef.current = internet;

  // The cashier PC keeps selling no matter what the network does.
  useEffect(() => {
    const id = window.setInterval(() => {
      setSales((n) => n + 1);
      if (!internetRef.current) setQueued((q) => q + 1);
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  // Reconnecting drains the queue.
  useEffect(() => {
    if (!internet || queued === 0) return;
    const id = window.setInterval(() => setQueued((q) => Math.max(0, q - 1)), 140);
    return () => window.clearInterval(id);
  }, [internet, queued]);

  const changeWifi = (v: boolean) => {
    setWifi(v);
    phone.current?.setOffline(!v);
  };

  const wifiLine = wifi ? 'flow-line' : 'flow-line off';
  const cloudLine = internet ? 'flow-line' : 'flow-line off';

  return (
    <section id="offline" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <div data-reveal className="max-w-2xl">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">{t('offline.eyebrow')}</div>
          <h2 className="mt-3 text-[clamp(2rem,4.6vw,3.4rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-heading">
            {t('offline.title')}
          </h2>
        </div>

        <div className="mt-12 grid lg:grid-cols-[1fr_320px] gap-8 lg:gap-14 items-center">
          <div data-reveal className="rounded-3xl border border-line bg-card/60 p-5 sm:p-8 frame-shadow">
            <div className="flex flex-wrap gap-3">
              <Toggle on={wifi} onChange={changeWifi} label={t('offline.wifi')} icon={Wifi} offIcon={WifiOff} />
              <Toggle on={internet} onChange={setInternet} label={t('offline.internet')} icon={Globe} offIcon={GlobeLock} />
            </div>

            <svg viewBox="0 0 560 330" className="mt-6 w-full h-auto" role="img" aria-label="Network diagram">
              {/* links */}
              <path d="M280 120 V 58" stroke="var(--color-primary)" strokeWidth="2" fill="none" className={cloudLine} />
              <path d="M340 190 C 400 190, 410 120, 470 110" stroke="var(--color-primary)" strokeWidth="2" fill="none" className={wifiLine} />
              <path d="M340 215 C 400 215, 410 260, 470 262" stroke="var(--color-primary)" strokeWidth="2" fill="none" className={wifiLine} />

              {/* cloud */}
              <g opacity={internet ? 1 : 0.4}>
                <rect x="232" y="6" width="96" height="52" rx="14" fill="var(--color-card)" stroke="var(--color-line)" />
                <foreignObject x="232" y="6" width="96" height="52">
                  <div className="h-full flex flex-col items-center justify-center text-heading">
                    <Cloud size={20} />
                    <span className="text-[11px] font-bold mt-0.5">{t('offline.cloud')}</span>
                  </div>
                </foreignObject>
              </g>
              {queued > 0 && (
                <g>
                  <rect x="292" y="74" width="74" height="24" rx="12" fill="var(--color-warning-soft)" stroke="var(--color-warning)" strokeOpacity="0.4" />
                  <text x="329" y="90" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--color-warning)" className="tnum">{queued} queued</text>
                </g>
              )}

              {/* cashier PC */}
              <rect x="150" y="120" width="190" height="130" rx="20" fill="var(--color-card)" stroke="var(--color-primary)" strokeOpacity="0.55" strokeWidth="1.5" />
              <foreignObject x="150" y="120" width="190" height="130">
                <div className="h-full p-4 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-heading">
                    <Laptop size={19} className="text-primary" />
                    <span className="text-[13px] font-extrabold">{t('offline.pc')}</span>
                  </div>
                  <div>
                    <div className="text-[34px] leading-none font-extrabold text-heading tnum tracking-tight">{sales}</div>
                    <div className="text-[11px] font-semibold text-dim mt-1">{t('offline.sales')}</div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 self-start text-[10px] font-bold text-success bg-success-soft rounded-md px-1.5 py-0.5">
                    <Database size={11} /> SQLite
                  </div>
                </div>
              </foreignObject>

              {/* devices */}
              <g opacity={wifi ? 1 : 0.4}>
                <rect x="470" y="80" width="84" height="60" rx="14" fill="var(--color-card)" stroke="var(--color-line)" />
                <foreignObject x="470" y="80" width="84" height="60">
                  <div className="h-full flex flex-col items-center justify-center text-heading">
                    <Smartphone size={20} />
                    <span className="text-[11px] font-bold mt-0.5">{t('offline.phone')}</span>
                  </div>
                </foreignObject>
                <rect x="470" y="232" width="84" height="60" rx="14" fill="var(--color-card)" stroke="var(--color-line)" />
                <foreignObject x="470" y="232" width="84" height="60">
                  <div className="h-full flex flex-col items-center justify-center text-heading">
                    <Tablet size={20} />
                    <span className="text-[11px] font-bold mt-0.5">Tablet</span>
                  </div>
                </foreignObject>
              </g>
            </svg>
          </div>

          <div data-reveal style={{ '--d': '120ms' } as React.CSSProperties} className="w-full max-w-[300px] mx-auto">
            <AppFrame ref={phone} device="phone" />
          </div>
        </div>
      </div>
    </section>
  );
}
