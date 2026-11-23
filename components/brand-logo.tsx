import Image from 'next/image';

type BrandLogoProps = {
  variant?: 'dark' | 'light';
  className?: string;
  compact?: boolean;
};

export function BrandLogo({ variant = 'dark', className = '', compact = false }: BrandLogoProps) {
  const light = variant === 'light';
  const mainColor = light ? 'text-white' : 'text-[#172B3A]';
  const accentColor = light ? 'text-[#A9D1C7]' : 'text-[#397D78]';

  if (compact) {
    const symbol = light ? '/agenda-flow-symbol-light.svg' : '/agenda-flow-symbol.svg';
    return (
      <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="FlowAgenda by FM Digital">
        <Image src={symbol} alt="" aria-hidden width={42} height={42} priority className="h-9 w-9 shrink-0" />
        <span className="flex min-w-0 flex-col">
          <span className={`whitespace-nowrap text-[17px] font-bold tracking-[-.045em] ${mainColor}`}>
            Flow<span className={accentColor}>Agenda</span>
          </span>
          <span className={`mt-0.5 text-[8px] font-semibold tracking-[.08em] ${light ? 'text-white/60' : 'text-[#718087]'}`}>
            by FM Digital
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-col leading-none ${className}`} role="img" aria-label="FlowAgenda by FM Digital">
      <span className={`whitespace-nowrap text-[30px] font-bold tracking-[-.055em] sm:text-[36px] ${mainColor}`}>
        Flow<span className={accentColor}>Agenda</span>
      </span>
      <span className={`mt-1.5 text-[10px] font-semibold tracking-[.12em] ${light ? 'text-white/65' : 'text-[#718087]'}`}>
        by FM Digital
      </span>
    </span>
  );
}
