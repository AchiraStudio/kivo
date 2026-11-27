import { useI18n } from '../i18n';

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8 h-20 flex items-center justify-between gap-4 text-xs font-semibold text-dim">
        <a href="#top" className="flex items-center gap-2 text-heading">
          <img src="./kivo.png" alt="" className="w-6 h-6" />
          <span className="font-extrabold">Kivo</span>
        </a>
        <span>© {new Date().getFullYear()} Achira Studio · {t('footer.rights')}</span>
      </div>
    </footer>
  );
}
