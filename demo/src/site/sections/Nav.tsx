import { Moon, Sun, Download } from 'lucide-react';
import { useI18n } from '../i18n';
import { useSiteTheme } from '../theme';
import { useRelease } from '../useRelease';

export function Nav() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useSiteTheme();
  const rel = useRelease();

  return (
    <header className="fixed top-0 inset-x-0 z-50 glass border-b border-line/70">
      <div className="mx-auto max-w-[1280px] h-16 px-5 sm:px-8 flex items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2.5 shrink-0" aria-label="Kivo">
          <img src="./kivo.png" alt="" className="w-8 h-8" />
          <span className="text-[17px] font-extrabold tracking-tight text-heading">Kivo</span>
          <span className="hidden sm:inline text-[11px] font-mono font-semibold text-dim border border-line rounded-md px-1.5 py-0.5">
            v{rel.version}
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-1 text-sm font-semibold">
          {[
            ['#tour', t('nav.live')],
            ['#phone', 'Android'],
            ['#offline', 'Offline'],
            ['#features', t('features.eyebrow')],
          ].map(([href, label]) => (
            <a key={href} href={href} className="px-3 h-9 inline-flex items-center rounded-lg text-body hover:text-heading hover:bg-muted transition-colors">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'id' : 'en')}
            aria-label="Language"
            className="h-9 px-2.5 rounded-lg text-xs font-bold text-body hover:text-heading hover:bg-muted transition-colors cursor-pointer"
          >
            {lang === 'en' ? 'ID' : 'EN'}
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-body hover:text-heading hover:bg-muted transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <a
            href="#download"
            className="ml-1 h-9 px-4 inline-flex items-center gap-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors"
          >
            <Download size={15} />
            <span className="hidden sm:inline">{t('nav.download')}</span>
          </a>
        </div>
      </div>
    </header>
  );
}
