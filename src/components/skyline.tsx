// Saudi skyline + palm watermark illustration (pure SVG).
export function Skyline({ className = "", opacity = 0.18 }: { className?: string; opacity?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 90"
      preserveAspectRatio="xMidYMax meet"
      className={className}
      style={{ opacity }}
      fill="none"
      stroke="#0F5A3A"
      strokeWidth="0.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* palms */}
      <g>
        <path d="M30 88 V60" />
        <path d="M30 60 Q18 55 12 50 M30 60 Q42 55 48 50 M30 60 Q22 48 18 40 M30 60 Q38 48 42 40 M30 60 Q30 50 30 42" />
        <path d="M295 88 V62" />
        <path d="M295 62 Q283 57 277 52 M295 62 Q307 57 313 52 M295 62 Q287 50 283 42 M295 62 Q303 50 307 42 M295 62 Q295 52 295 44" />
      </g>
      {/* skyline buildings (mosque, towers) */}
      <g>
        <path d="M70 88 V70 H85 V88" />
        <path d="M85 70 Q92 60 99 70 V88 H85" />
        <circle cx="92" cy="64" r="3" />
        <path d="M92 58 V54" />
        <path d="M105 88 V58 L115 50 L125 58 V88" />
        <path d="M115 50 V44" />
        <path d="M135 88 V64 H148 V88" />
        <path d="M155 88 V52 L165 46 L175 52 V88" />
        <path d="M165 46 V40" />
        <path d="M185 88 V68 H198 V88" />
        <path d="M205 88 V58 H220 V88" />
        <path d="M212 58 V50" />
        <path d="M230 88 V64 H245 V88" />
        <path d="M255 88 V60 L265 52 L275 60 V88" />
        <path d="M265 52 V44" />
      </g>
      {/* ground */}
      <path d="M0 88 H320" strokeWidth="0.6" />
    </svg>
  );
}
