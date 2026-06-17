/**
 * BrandMark — the meridianjourney.ai flame-in-ring glyph.
 *
 * USA-flag identity: a flag-navy ring around a flame-red flame, with a row of
 * navy stars beneath (echoes logo3-vivid.jpeg). Crisp transparent SVG so it
 * sits cleanly on the near-white header. Pair with the "meridianjourney.ai" wordmark.
 */
type BrandMarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

export default function BrandMark({ size = 30, className, title }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* Navy ring on a white field */}
      <circle cx="18" cy="18" r="15.2" fill="#ffffff" stroke="#15487e" strokeWidth="3.4" />
      {/* Flame (Lucide flame silhouette), centred and lifted to leave room for stars */}
      <path
        transform="translate(7.6 4.6) scale(0.86)"
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        fill="#d62828"
      />
      {/* Star row */}
      <g fill="#15487e">
        <circle cx="12.6" cy="27.6" r="1" />
        <circle cx="18" cy="28.4" r="1" />
        <circle cx="23.4" cy="27.6" r="1" />
      </g>
    </svg>
  );
}
