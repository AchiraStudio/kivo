import { useCallback, useEffect, useRef } from 'react';
import { ArrowDown, Download } from 'lucide-react';
import { useI18n } from '../i18n';
import { useRelease } from '../useRelease';
import { AppFrame, type AppFrameHandle } from '../AppFrame';
import { SCENE_MS } from '../sceneTimes';
import { useIsSmall } from '../useIsSmall';

// Plays a list of scenes one after another until the visitor takes over.
export function useSceneLoop(frame: React.RefObject<AppFrameHandle | null>, scenes: string[], startDelay = 2200) {
  const paused = useRef(false);
  const index = useRef(0);
  const timer = useRef<number>(0);

  const step = useCallback(() => {
    window.clearTimeout(timer.current);
    if (paused.current) return;
    const scene = scenes[index.current % scenes.length];
    frame.current?.play(scene);
    index.current++;
    timer.current = window.setTimeout(step, (SCENE_MS[scene] ?? 12000) + 900);
  }, [frame, scenes]);

  useEffect(() => {
    timer.current = window.setTimeout(step, startDelay);
    return () => window.clearTimeout(timer.current);
  }, [step, startDelay]);

  return {
    onTakeover: () => {
      paused.current = true;
      window.clearTimeout(timer.current);
    },
    onRelease: () => {
      paused.current = false;
      step();
    },
  };
}

const DESKTOP_LOOP = ['pos', 'dashboard', 'customers', 'reports'];
const PHONE_LOOP = ['p-pos', 'p-customer', 'p-home'];

export function Hero() {
  const { t } = useI18n();
  const rel = useRelease();
  const desktop = useRef<AppFrameHandle>(null);
  const phone = useRef<AppFrameHandle>(null);
  const dLoop = useSceneLoop(desktop, DESKTOP_LOOP, 2600);
  const small = useIsSmall();
  const pLoop = useSceneLoop(phone, PHONE_LOOP, small ? 2600 : 5200);

  return (
    <section id="top" className="relative pt-28 sm:pt-36 pb-16 sm:pb-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden="true" />
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2 w-[900px] max-w-[140%] h-[520px] rounded-full blur-3xl pointer-events-none opacity-80"
        style={{ background: 'radial-gradient(closest-side, var(--glow), transparent)' }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1280px] px-5 sm:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div data-reveal className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-line bg-card/70 text-xs font-bold text-body">
            <span className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_var(--color-success)]" />
            v{rel.version} · {t('hero.eyebrow')}
          </div>

          <h1 data-reveal style={{ '--d': '80ms' } as React.CSSProperties} className="mt-6 text-[clamp(2.6rem,7vw,5.4rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-heading">
            {t('hero.l1')}
            <br />
            <span className="text-gradient">{t('hero.l2')}</span>
          </h1>

          <p data-reveal style={{ '--d': '160ms' } as React.CSSProperties} className="mt-5 text-base sm:text-lg text-body max-w-xl mx-auto">
            {t('hero.sub')}
          </p>

          <div data-reveal style={{ '--d': '240ms' } as React.CSSProperties} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#download" className="h-12 px-6 inline-flex items-center gap-2 rounded-xl bg-primary text-white text-[15px] font-bold hover:bg-primary-hover transition-colors shadow-lg shadow-primary/25">
              <Download size={18} /> {t('nav.download')}
            </a>
            <a href="#tour" className="h-12 px-6 inline-flex items-center gap-2 rounded-xl border border-line bg-card text-heading text-[15px] font-bold hover:border-line-strong hover:bg-muted transition-colors">
              {t('hero.try')} <ArrowDown size={16} />
            </a>
          </div>
        </div>

        <div data-reveal style={{ '--d': '320ms' } as React.CSSProperties} className="relative mt-14 sm:mt-20">
          {small ? (
            <div className="w-full max-w-[290px] mx-auto">
              <AppFrame ref={phone} device="phone" {...pLoop} />
            </div>
          ) : (
            <>
              <AppFrame ref={desktop} device="desktop" className="w-full" {...dLoop} />
              <div className="hidden sm:block absolute -right-2 lg:-right-8 -bottom-10 w-[22%] min-w-[150px] max-w-[230px] float-slow">
                <AppFrame ref={phone} device="phone" {...pLoop} />
              </div>
            </>
          )}
        </div>

        <p className="mt-10 text-center text-xs font-semibold text-dim">{t('hero.hint')}</p>
      </div>
    </section>
  );
}
