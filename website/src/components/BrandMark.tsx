/**
 * BrandMark — the Meridian logo mark.
 *
 * Meridian brand identity: Meridian red primary with clean, minimal design.
 * Uses the compass/navigation-inspired logo matching the mobile app.
 */
import Image from 'next/image';

type BrandMarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

export default function BrandMark({ size = 30, className, title }: BrandMarkProps) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-full bg-primary ${className || ''}`}
      style={{ width: size, height: size }}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <Image
        src="/meridian-logo.png"
        alt={title || 'Meridian'}
        width={size * 0.7}
        height={size * 0.7}
        className="object-contain"
        style={{ filter: 'brightness(0) invert(1)' }}
      />
    </div>
  );
}
