import Image from 'next/image';

type BrandLogoProps = {
  variant?: 'dark' | 'light';
  className?: string;
};

export function BrandLogo({ variant = 'dark', className = '' }: BrandLogoProps) {
  const src = variant === 'light' ? '/agenda-flow-logo-light.svg' : '/agenda-flow-logo.svg';

  return (
    <Image
      src={src}
      alt="AgendaFlow — Tu agenda online, simple y efectiva"
      width={720}
      height={150}
      priority
      className={className}
    />
  );
}
