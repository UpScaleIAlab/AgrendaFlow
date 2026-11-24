import Image from 'next/image';

type BrandLogoProps = {
  variant?: 'dark' | 'light';
  className?: string;
  compact?: boolean;
  responsive?: boolean;
};

export function BrandLogo({ variant = 'dark', className = '', compact = false, responsive = false }: BrandLogoProps) {
  const light = variant === 'light';
  const mainColor = light ? 'text-white' : 'text-[#172B3A]';
  const accentColor = light ? 'text-[#A9D1C7]' : 'text-[#397D78]';
  const symbol = light ? '/agenda-flow-symbol-light.svg' : '/agenda-flow-symbol.svg';

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} role="img" aria-label="FM Digital Growth">
      <Image
        src={symbol}
        alt=""
        aria-hidden
        width={compact ? 42 : 58}
        height={compact ? 42 : 58}
        priority
        className={compact ? 'h-9 w-9 shrink-0' : responsive ? 'h-8 w-8 shrink-0 sm:h-12 sm:w-12' : 'h-11 w-11 shrink-0 sm:h-12 sm:w-12'}
      />
      <span className="flex min-w-0 flex-col">
        <span className={`whitespace-nowrap font-bold tracking-[-.045em] ${compact ? 'text-[17px]' : responsive ? 'text-[clamp(18px,4.5vw,30px)] sm:text-[36px]' : 'text-[30px] sm:text-[36px]'} ${mainColor}`}>
          FM <span className={accentColor}>Digital Growth</span>
        </span>
        <span className={`mt-0.5 font-semibold tracking-[.08em] ${compact ? 'text-[8px]' : responsive ? 'text-[9px] sm:text-[10px] tracking-[.12em]' : 'text-[10px] tracking-[.12em]'} ${light ? 'text-white/65' : 'text-[#718087]'}`}>
          by FM Digital
        </span>
      </span>
    </span>
  );
}
