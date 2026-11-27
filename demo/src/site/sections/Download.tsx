import { QRCodeSVG } from 'qrcode.react';
import { Download, MonitorDown, Smartphone, RefreshCw, ArrowUpRight, WifiOff, Printer, Network } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatSize, useRelease } from '../useRelease';

const GithubMark = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.1c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
  </svg>
);

export function DownloadSection() {
  const { t, lang } = useI18n();
  const rel = useRelease();
  const date = rel.date ? new Date(rel.date).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const winUrl = rel.windows?.url ?? rel.pageUrl;
  const apkUrl = rel.android?.url ?? rel.pageUrl;

  return (
    <section id="download" className="relative py-20 sm:py-28 overflow-hidden">
      <div
        className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[900px] max-w-[140%] h-[420px] rounded-full blur-3xl opacity-70 pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, var(--glow), transparent)' }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-[1080px] px-5 sm:px-8">
        <div data-reveal className="text-center">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">{t('dl.eyebrow')}</div>
          <h2 className="mt-3 text-[clamp(2.2rem,5vw,3.8rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-heading">{t('dl.title')}</h2>
          <p className="mt-3 text-sm font-semibold text-dim tnum">
            {t('dl.latest')} · v{rel.version}{date ? ` · ${date}` : ''}
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-5">
          <div data-reveal className="rounded-3xl border border-line bg-card p-7 sm:p-8 flex flex-col frame-shadow">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center"><MonitorDown size={24} /></span>
              <div>
                <h3 className="text-xl font-extrabold text-heading">{t('dl.windows')}</h3>
                <p className="text-xs font-semibold text-dim">Windows 10 / 11 · 64-bit{rel.windows ? ` · ${formatSize(rel.windows.size)}` : ''}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {[[WifiOff, 'Offline'], [Printer, 'Thermal'], [Network, 'LAN host']].map(([Icon, label]) => {
                const I = Icon as typeof WifiOff;
                return (
                  <span key={label as string} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-muted text-xs font-bold text-body">
                    <I size={13} className="text-primary" /> {label as string}
                  </span>
                );
              })}
            </div>
            <div className="flex-1" />
            <a
              href={winUrl}
              className="mt-10 h-13 py-3.5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white text-[15px] font-bold hover:bg-primary-hover transition-colors shadow-lg shadow-primary/25"
            >
              <Download size={18} /> {t('dl.get')} {rel.windows ? `.${rel.windows.name.split('.').pop()}` : ''}
            </a>
          </div>

          <div data-reveal style={{ '--d': '100ms' } as React.CSSProperties} className="rounded-3xl border border-line bg-card p-7 sm:p-8 flex flex-col frame-shadow">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-success-soft text-success flex items-center justify-center"><Smartphone size={24} /></span>
              <div>
                <h3 className="text-xl font-extrabold text-heading">{t('dl.android')}</h3>
                <p className="text-xs font-semibold text-dim">Android 7+ · APK{rel.android ? ` · ${formatSize(rel.android.size)}` : ''}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-5">
              <div className="p-2.5 rounded-2xl bg-white shrink-0">
                <QRCodeSVG value={apkUrl} size={104} level="M" />
              </div>
              <div className="text-xs font-semibold text-dim leading-relaxed">
                <p className="text-heading font-bold text-sm">{t('dl.scan')}</p>
                <p className="mt-1.5 inline-flex items-center gap-1.5"><RefreshCw size={13} className="text-success" /> {t('dl.autoupdate')}</p>
              </div>
            </div>

            <a
              href={apkUrl}
              className="mt-7 py-3.5 inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-background text-heading text-[15px] font-bold hover:border-line-strong hover:bg-muted transition-colors"
            >
              <Download size={18} /> {t('dl.get')} .apk
            </a>
          </div>
        </div>

        <div data-reveal className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-semibold text-dim">
          <span>{t('dl.free')}</span>
          <a href="https://github.com/AchiraStudio/kivo" className="inline-flex items-center gap-2 text-heading hover:text-primary transition-colors">
            <GithubMark /> {t('dl.github')} <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}
