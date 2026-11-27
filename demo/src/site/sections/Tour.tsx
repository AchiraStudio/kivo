import { useEffect, useRef, useState } from 'react';
import { BookOpenText, LayoutDashboard, MessageSquare, Package, Settings, ShoppingCart, Truck, Users, type LucideIcon } from 'lucide-react';
import { useI18n, type Key } from '../i18n';
import { AppFrame, type AppFrameHandle } from '../AppFrame';
import { useIsSmall } from '../useIsSmall';

interface Chapter {
  id: string;
  icon: LucideIcon;
  title: Key;
  tag: Key;
}

const CHAPTERS: Chapter[] = [
  { id: 'pos', icon: ShoppingCart, title: 'tour.pos', tag: 'tour.pos.tag' },
  { id: 'dashboard', icon: LayoutDashboard, title: 'tour.dashboard', tag: 'tour.dashboard.tag' },
  { id: 'inventory', icon: Package, title: 'tour.inventory', tag: 'tour.inventory.tag' },
  { id: 'customers', icon: Users, title: 'tour.customers', tag: 'tour.customers.tag' },
  { id: 'purchasing', icon: Truck, title: 'tour.purchasing', tag: 'tour.purchasing.tag' },
  { id: 'reports', icon: BookOpenText, title: 'tour.reports', tag: 'tour.reports.tag' },
  { id: 'ai', icon: MessageSquare, title: 'tour.ai', tag: 'tour.ai.tag' },
  { id: 'settings', icon: Settings, title: 'tour.settings', tag: 'tour.settings.tag' },
];

export function Tour() {
  const { t } = useI18n();
  const frame = useRef<AppFrameHandle>(null);
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const manual = useRef(false);
  const small = useIsSmall();

  // Scroll-linked on large screens: the chapter in the middle of the viewport plays.
  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        });
      },
      { rootMargin: '-42% 0px -42% 0px' },
    );
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    frame.current?.play(CHAPTERS[active].id);
  }, [active]);

  const choose = (i: number) => {
    manual.current = true;
    if (i === active) frame.current?.play(CHAPTERS[i].id);
    setActive(i);
  };

  return (
    <section id="tour" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-[1360px] px-5 sm:px-8">
        <div data-reveal className="max-w-2xl">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">{t('tour.eyebrow')}</div>
        </div>

        {/* small screens: chips above one frame */}
        <div className="lg:hidden mt-6 -mx-5 px-5 flex gap-2 overflow-x-auto no-scrollbar">
          {CHAPTERS.map((c, i) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => choose(i)}
                aria-pressed={i === active}
                className={`shrink-0 h-10 px-4 inline-flex items-center gap-2 rounded-full border text-sm font-bold cursor-pointer transition-colors ${
                  i === active ? 'bg-primary-soft text-primary border-primary/40' : 'bg-card text-body border-line'
                }`}
              >
                <Icon size={15} /> {t(c.title)}
              </button>
            );
          })}
        </div>

        <div className="mt-8 lg:mt-12 grid lg:grid-cols-[minmax(250px,300px)_1fr] gap-8 xl:gap-12">
          <ol className="hidden lg:block">
            {CHAPTERS.map((c, i) => {
              const Icon = c.icon;
              const on = i === active;
              return (
                <li
                  key={c.id}
                  ref={(el) => { stepRefs.current[i] = el; }}
                  data-index={i}
                  className="min-h-[58vh] flex items-center"
                >
                  <button
                    type="button"
                    onClick={() => choose(i)}
                    className={`group w-full text-left rounded-2xl border p-6 transition-all duration-500 cursor-pointer ${
                      on ? 'bg-card border-line-strong/50 opacity-100 translate-x-0 frame-shadow' : 'border-transparent opacity-35 hover:opacity-70 -translate-x-1'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${on ? 'bg-primary text-white' : 'bg-muted text-dim'}`}>
                        <Icon size={20} />
                      </span>
                      <span className="font-mono text-xs font-bold text-dim tnum">0{i + 1}</span>
                    </div>
                    <h3 className="mt-4 text-3xl font-extrabold tracking-tight text-heading">{t(c.title)}</h3>
                    <p className="mt-1.5 text-[15px] text-body">{t(c.tag)}</p>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="lg:sticky lg:top-24 self-start">
            <div className="lg:hidden mb-4">
              <h3 className="text-2xl font-extrabold tracking-tight text-heading">{t(CHAPTERS[active].title)}</h3>
              <p className="text-sm text-body">{t(CHAPTERS[active].tag)}</p>
            </div>
            {small ? (
              // Phones get the phone app, restarted for each chapter.
              <div className="w-full max-w-[290px] mx-auto">
                <AppFrame key={CHAPTERS[active].id} device="phone" scene={`p-${CHAPTERS[active].id}`} />
              </div>
            ) : (
              <AppFrame ref={frame} device="desktop" virtualWidth={1120} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
