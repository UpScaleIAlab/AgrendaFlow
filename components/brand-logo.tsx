import Image from 'next/image';

type BrandLogoProps = {
  variant?: 'dark' | 'light';
  className?: string;
  compact?: boolean;
};

export function BrandLogo({ variant = 'dark', className = '', compact = false }: BrandLogoProps) {
  if (compact) {
    const symbol = variant === 'light' ? '/agenda-flow-symbol-light.svg' : '/agenda-flow-symbol.svg';
    return (
      <span className={`inline-flex items-center gap-2.5 ${className}`}>
        <Image src={symbol} alt="" aria-hidden width={42} height={42} priority className="h-9 w-9 shrink-0" />
        <span className={`text-[19px] font-bold tracking-[-.045em] ${variant === 'light' ? 'text-white' : 'text-[#172B3A]'}`}>
          Agenda<span className={variant === 'light' ? 'text-[#A9D1C7]' : 'text-[#397D78]'}>Flow</span>
        </span>
      </span>
    );
  }

  const src = variant === 'light' ? '/agenda-flow-logo-light.svg' : '/agenda-flow-logo.svg';
  return <Image src={src} alt="AgendaFlow — Tu agenda online, simple y efectiva" width={720} height={150} priority className={className} />;
}
