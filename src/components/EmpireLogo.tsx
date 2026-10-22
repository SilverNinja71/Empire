import { useId } from 'react';

/**
 * The Empire wordmark, drawn as one-line rounded letters so it looks the same in every theme.
 * Brand rules: the bowl of the "p" holds an orange, and the "i" is dotted with a green citrus leaf.
 * fontColor changes the letters only; the orange and the leaf always keep their fruit colors.
 */
export function EmpireLogo({ fontColor = '#ffffff', size = 34, className, title = 'Empire' }: {
  fontColor?: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const id = useId().replace(/:/g, '');
  const w = 252, h = 88;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${w} ${h}`}
      height={size}
      width={(size * w) / h}
      role="img"
      aria-label={title}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <title>{title}</title>
      <defs>
        <radialGradient id={`orange-${id}`} cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#ffd08a" />
          <stop offset="0.35" stopColor="#ffa22e" />
          <stop offset="1" stopColor="#f26a0b" />
        </radialGradient>
        <linearGradient id={`leaf-${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#1f8a3b" />
          <stop offset="1" stopColor="#5fd35f" />
        </linearGradient>
      </defs>
      {/* Letters: one stroke, round ends. Baseline y=62, x-height top y=26, cap top y=6 */}
      <g fill="none" stroke={fontColor} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round">
        {/* E */}
        <path d="M8 6 V62 M8 6 H36 M8 34 H31 M8 62 H36" />
        {/* m */}
        <path d="M50 62 V38 a12 12 0 0 1 24 0 V62 M74 38 a12 12 0 0 1 24 0 V62" />
        {/* p: stem dropping below the line, round bowl */}
        <path d="M112 30 V80" />
        <circle cx="129" cy="44" r="16.5" />
        {/* i: stem only, its dot is the leaf */}
        <path d="M162 34 V62" />
        {/* r */}
        <path d="M178 62 V30 M178 44 a14 14 0 0 1 22 -12" />
        {/* e */}
        <path d="M212 44 H244 A16 16 0 1 0 238 57" />
      </g>
      {/* The orange inside the p (never takes the font color) */}
      <g>
        <circle cx="129" cy="44" r="9.2" fill={`url(#orange-${id})`} />
        <path d="M129 37.5 V50.5 M123 44 H135 M124.5 39.5 L133.5 48.5 M133.5 39.5 L124.5 48.5" stroke="#ffd9a3" strokeWidth={0.9} strokeOpacity={0.75} />
        <circle cx="129" cy="44" r="2" fill="#fff3d6" fillOpacity={0.9} />
        <ellipse cx="125.6" cy="40.4" rx="2.3" ry="1.4" fill="#fff" fillOpacity={0.65} transform="rotate(-35 125.6 40.4)" />
      </g>
      {/* The leaf over the i (never takes the font color) */}
      <g transform="rotate(-28 163 16)">
        <path d="M152 18 C 156 6, 170 4, 176 12 C 170 22, 158 24, 152 18 Z" fill={`url(#leaf-${id})`} />
        <path d="M153.5 17.5 C 160 14, 166 12, 174 12.5" fill="none" stroke="#c9f7c0" strokeWidth={1.2} strokeLinecap="round" />
        <path d="M152 18 l -3 2.5" stroke="#1f8a3b" strokeWidth={2.2} strokeLinecap="round" />
      </g>
    </svg>
  );
}
