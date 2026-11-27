import { useRef, useState } from 'react';
import { ArrowUpCircle, Menu, ShoppingCart, UserPlus, Wifi, type LucideIcon } from 'lucide-react';
import { useI18n, type Key } from '../i18n';
import { AppFrame, type AppFrameHandle } from '../AppFrame';

const SCENES: { id: string; icon: LucideIcon; label: Key }[] = [
  { id: 'p-connect', icon: Wifi, label: 'phone.connect' },
  { id: 'p-pos', icon: ShoppingCart, label: 'phone.pos' },
  { id: 'p-customer', icon: UserPlus, label: 'phone.customer' },
  { id: 'p-update', icon: ArrowUpCircle, label: 'phone.update' },
  { id: 'p-home', icon: Menu, label: 'phone.home' },
];

export function PhoneSection() {
  const { t } = useI18n();
  const frame = useRef<AppFrameHandle>(null);
  const [active, setActive] = useState('p-pos');
  // Each scene starts from a fresh app so it always begins at the same place.
  const [nonce, setNonce] = useState(0);

  const choose = (id: string) => {
    setActive(id);
    setNonce((n) => n + 1);
  };

  return (
    <section id="phone" className="relative py-20 sm:py-28 overflow-hidden">
      <div
        className="absolute right-0 top-1/3 w-[640px] h-[640px] rounded-full blur-3xl opacity-60 pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, var(--glow), transparent)' }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-[1280px] px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <div data-reveal>
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">{t('phone.eyebrow')}</div>
          <h2 className="mt-3 text-[clamp(2rem,4.6vw,3.4rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-heading">
            {t('phone.title')}
          </h2>

          <div className="mt-8 flex flex-wrap gap-2.5">
            {SCENES.map((s) => {
              const Icon = s.icon;
              const on = s.id === active;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => choose(s.id)}
                  aria-pressed={on}
                  className={`h-12 px-5 inline-flex items-center gap-2.5 rounded-2xl border text-[15px] font-bold cursor-pointer transition-all ${
                    on ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25 -translate-y-0.5' : 'bg-card text-heading border-line hover:border-line-strong'
                  }`}
                >
                  <Icon size={17} /> {t(s.label)}
                </button>
              );
            })}
          </div>
        </div>

        <div data-reveal style={{ '--d': '120ms' } as React.CSSProperties} className="w-full max-w-[340px] mx-auto">
          <AppFrame key={`${active}-${nonce}`} ref={frame} device="phone" scene={active} />
        </div>
      </div>
    </section>
  );
}
