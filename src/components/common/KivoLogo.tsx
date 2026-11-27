interface KivoLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
  variant?: 'gradient' | 'white' | 'monochrome';
}

export default function KivoLogo({
  size = 32,
  className = '',
  showText = false,
  textClassName = '',
}: KivoLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <img
        src={`${import.meta.env.BASE_URL}kivo.png`}
        alt="Kivo"
        width={size}
        height={size}
        className="shrink-0 object-contain rounded-lg"
        style={{ width: size, height: size }}
      />

      {showText && (
        <span className={`font-bold tracking-tight text-heading ${textClassName || 'text-lg'}`}>
          Kivo
        </span>
      )}
    </div>
  );
}
