import { useEffect, useMemo, useRef } from 'react';
import type { Deco } from '../lib/themes';

/**
 * The scenery behind the whole site for each theme (drawn in SVG, animated with CSS).
 * Layers drift a little as you scroll for a soft parallax. Original artwork in the spirit of each theme.
 */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** A row of pine trees standing on a wavy ridge, as one filled path. */
function pineRidge(seed: number, base: number, wave: number, treeH: number, step: number, w = 1600, h = 900) {
  const r = rng(seed);
  const ridge = (x: number) => base + Math.sin(x / 210 + seed) * wave + Math.sin(x / 77 + seed * 2) * wave * 0.35;
  let d = `M0 ${h} L0 ${ridge(0)}`;
  for (let x = 0; x <= w; x += step) {
    const y = ridge(x);
    const th = treeH * (0.6 + r() * 0.7);
    const tw = step * (0.55 + r() * 0.3);
    d += ` L${x} ${y} L${x + tw / 2} ${y - th} L${x + tw} ${y}`;
  }
  return d + ` L${w} ${h} Z`;
}

function mountains(seed: number, base: number, height: number, peaks: number, w = 1600, h = 900) {
  const r = rng(seed);
  let d = `M0 ${h} L0 ${base}`;
  const step = w / peaks;
  for (let i = 0; i <= peaks; i++) {
    const x = i * step;
    d += ` L${x + step * 0.5} ${base - height * (0.45 + r() * 0.55)} L${x + step} ${base - height * r() * 0.25}`;
  }
  return d + ` L${w} ${h} Z`;
}

function Sunset() {
  const far = useMemo(() => mountains(3, 560, 230, 7), []);
  const mid = useMemo(() => mountains(11, 620, 180, 9), []);
  const pines1 = useMemo(() => pineRidge(5, 660, 26, 70, 22), []);
  const pines2 = useMemo(() => pineRidge(17, 735, 22, 95, 30), []);
  const near = useMemo(() => pineRidge(29, 820, 18, 140, 46), []);
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="bd-svg">
      <defs>
        <linearGradient id="ss-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc94a" />
          <stop offset="0.35" stopColor="#ffae19" />
          <stop offset="0.6" stopColor="#ff9000" />
          <stop offset="0.75" stopColor="#e2702a" />
        </linearGradient>
        <radialGradient id="ss-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff4c2" />
          <stop offset="0.35" stopColor="#ffe08a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffd24d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ss-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb35c" stopOpacity="0" />
          <stop offset="1" stopColor="#ffb35c" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#ss-sky)" />
      <g className="px px1"><circle cx="1060" cy="470" r="230" fill="url(#ss-sun)" /><circle cx="1060" cy="470" r="70" fill="#fff1b8" opacity="0.9" /></g>
      <g className="px px1">
        <path d={far} fill="#c85a2b" opacity="0.85" />
        <rect y="420" width="1600" height="170" fill="url(#ss-mist)" />
      </g>
      <g className="px px2">
        <path d={mid} fill="#9e3d23" />
        <rect y="520" width="1600" height="140" fill="url(#ss-mist)" opacity="0.6" />
      </g>
      <g className="px px3"><path d={pines1} fill="#5a1b1b" /></g>
      <g className="px px4"><path d={pines2} fill="#3b1114" /></g>
      <g className="px px5"><path d={near} fill="#1f0a0e" /><rect y="860" width="1600" height="60" fill="#140508" /></g>
      <g className="embers">
        {Array.from({ length: 16 }, (_, i) => <circle key={i} cx={(i * 97) % 1600} cy={700 + (i % 5) * 30} r={1.6 + (i % 3)} fill="#ffd24d" style={{ animationDelay: `${(i * 0.7) % 9}s` }} />)}
      </g>
    </svg>
  );
}

function PixelCloud({ x, y, s }: { x: number; y: number; s: number }) {
  // A blocky cloud on an 8px grid
  const rows = ['..XXX.....', '.XXXXX.XX.', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.'];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} shapeRendering="crispEdges">
      {rows.flatMap((r, j) => r.split('').map((c, i) => (c === 'X' ? <rect key={i + ':' + j} x={i * 8} y={j * 8} width={8.5} height={8.5} fill={j >= 3 ? '#dbeafe' : '#ffffff'} /> : null)))}
    </g>
  );
}

function QBlock({ x, y }: { x: number; y: number }) {
  return (
    <g className="qblock" style={{ transformOrigin: `${x + 24}px ${y + 24}px` }} shapeRendering="crispEdges">
      <rect x={x} y={y} width="48" height="48" fill="#3b2a0e" />
      <rect x={x + 3} y={y + 3} width="42" height="42" fill="#fbd000" />
      <rect x={x + 3} y={y + 3} width="42" height="4" fill="#ffe86b" />
      {[[6, 6], [39, 6], [6, 39], [39, 39]].map(([a, b]) => <rect key={a + ':' + b} x={x + a} y={y + b} width="3" height="3" fill="#3b2a0e" />)}
      <text x={x + 24} y={y + 34} textAnchor="middle" fontFamily='"Press Start 2P", monospace' fontSize="22" fill="#b45309">?</text>
    </g>
  );
}

function Mario() {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="bd-svg">
      <rect width="1600" height="900" fill="#5c94fc" />
      <g className="drift"><PixelCloud x={120} y={110} s={2} /><PixelCloud x={700} y={70} s={1.5} /><PixelCloud x={1250} y={150} s={2.2} /></g>
      <g className="drift slow"><PixelCloud x={420} y={260} s={1.2} /><PixelCloud x={1000} y={300} s={1.3} /></g>
      <g className="px px2">
        <path d="M-40 900 V720 Q 80 560 200 720 V900 Z" fill="#43b047" stroke="#0b3d12" strokeWidth="6" />
        <path d="M150 900 V760 Q 330 520 510 760 V900 Z" fill="#5ac05e" stroke="#0b3d12" strokeWidth="6" />
        <path d="M1180 900 V700 Q 1330 500 1480 700 V900 Z" fill="#43b047" stroke="#0b3d12" strokeWidth="6" />
        <path d="M1400 900 V770 Q 1520 640 1640 770 V900 Z" fill="#5ac05e" stroke="#0b3d12" strokeWidth="6" />
      </g>
      <g><QBlock x={560} y={470} /><QBlock x={608} y={470} /><QBlock x={1060} y={400} /></g>
      <g shapeRendering="crispEdges">
        <rect y="836" width="1600" height="64" fill="#b0682a" />
        <rect y="828" width="1600" height="14" fill="#43b047" />
        <rect y="826" width="1600" height="4" fill="#0b3d12" />
        {Array.from({ length: 50 }, (_, i) => <rect key={i} x={(i * 37) % 1600} y={856 + (i % 3) * 12} width="6" height="6" fill="#7a4518" />)}
      </g>
    </svg>
  );
}

function MapleLeaf({ color }: { color: string }) {
  return <path d="M0 -12 L3 -5 L9 -8 L6 -1 L12 1 L5 4 L6 10 L0 6 L-6 10 L-5 4 L-12 1 L-6 -1 L-9 -8 L-3 -5 Z M0 6 L0 14" fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" />;
}
function GinkgoLeaf() {
  return <path d="M0 10 L0 2 C -10 0, -12 -10, -6 -12 C -2 -9, 2 -9, 6 -12 C 12 -10, 10 0, 0 2" fill="#facc15" />;
}

function October() {
  const leaves = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="bd-fill">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="bd-svg">
        <defs>
          <linearGradient id="oc-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#120d22" />
            <stop offset="0.6" stopColor="#2a1d4a" />
            <stop offset="1" stopColor="#5a2f4a" />
          </linearGradient>
          <radialGradient id="oc-moon" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffe6b3" />
            <stop offset="0.3" stopColor="#ffd9a0" stopOpacity="0.85" />
            <stop offset="1" stopColor="#ff7b54" stopOpacity="0" />
          </radialGradient>
          <filter id="oc-blur"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>
        <rect width="1600" height="900" fill="url(#oc-sky)" />
        {Array.from({ length: 60 }, (_, i) => <circle key={i} className="twinkle" cx={(i * 263) % 1600} cy={(i * 131) % 480} r={i % 4 === 0 ? 1.8 : 1} fill="#fff" style={{ animationDelay: `${(i % 7) * 0.6}s` }} />)}
        <g className="px px1"><circle cx="1230" cy="200" r="260" fill="url(#oc-moon)" /><circle cx="1230" cy="200" r="95" fill="#ffe1ad" /><circle cx="1200" cy="180" r="14" fill="#f3c88a" opacity="0.6" /><circle cx="1262" cy="228" r="9" fill="#f3c88a" opacity="0.5" /></g>
        <g className="px px3"><path d={mountains(41, 760, 170, 6)} fill="#1a1230" /></g>
        <g className="px px4"><path d={pineRidge(43, 820, 16, 70, 26)} fill="#110b1f" /></g>
        <g className="wisps" filter="url(#oc-blur)">
          {Array.from({ length: 8 }, (_, i) => <circle key={i} cx={150 + i * 190} cy={760 - (i % 3) * 60} r={10 + (i % 3) * 5} fill={i % 2 ? '#8B5CF6' : '#c4b5fd'} style={{ animationDelay: `${i * 1.3}s` }} />)}
        </g>
        {/* A friendly pumpkin peeking from the corner */}
        <g transform="translate(70 800)"><g className="pumpkin">
          <ellipse cx="60" cy="40" rx="62" ry="48" fill="#FF7B54" />
          <path d="M20 40 Q 60 -10 100 40 M38 70 Q 60 90 82 70" stroke="#e8603a" strokeWidth="4" fill="none" />
          <rect x="54" y="-14" width="12" height="18" rx="4" fill="#5b8c3a" />
          <path d="M34 34 q 8 -10 16 0 M70 34 q 8 -10 16 0" stroke="#3b1d14" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M48 52 q 12 10 24 0" stroke="#3b1d14" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="30" cy="50" rx="7" ry="4" fill="#ff9e8a" opacity="0.8" /><ellipse cx="90" cy="50" rx="7" ry="4" fill="#ff9e8a" opacity="0.8" />
        </g></g>
      </svg>
      <div className="leaves" aria-hidden>
        {leaves.map((i) => (
          <svg key={i} className="leaf" viewBox="-14 -14 28 30" style={{ left: `${(i * 7.3) % 100}%`, animationDuration: `${9 + (i % 5) * 2}s`, animationDelay: `${-(i * 1.7)}s`, width: 18 + (i % 3) * 8 }}>
            {i % 4 === 3 ? <GinkgoLeaf /> : <MapleLeaf color={['#FF7B54', '#f59e0b', '#dc2626'][i % 3]} />}
          </svg>
        ))}
      </div>
    </div>
  );
}

function OnePiece() {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="bd-svg">
      <defs>
        <linearGradient id="op-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b3a63" />
          <stop offset="0.55" stopColor="#0f4c81" />
          <stop offset="1" stopColor="#1b6ca8" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#op-sea)" />
      <g stroke="#f5e6c8" strokeOpacity="0.08" strokeWidth="1.5">
        {Array.from({ length: 17 }, (_, i) => <line key={'v' + i} x1={i * 100} y1="0" x2={i * 100} y2="900" />)}
        {Array.from({ length: 10 }, (_, i) => <line key={'h' + i} x1="0" y1={i * 100} x2="1600" y2={i * 100} />)}
      </g>
      {/* Compass rose */}
      <g transform="translate(1320 230)" opacity="0.22"><g className="spin-slow">
        <circle r="150" fill="none" stroke="#f5e6c8" strokeWidth="3" />
        <circle r="120" fill="none" stroke="#f5e6c8" strokeWidth="1.5" strokeDasharray="4 8" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d={a % 90 === 0 ? 'M0 -150 L14 0 L0 14 L-14 0 Z' : 'M0 -95 L9 0 L0 9 L-9 0 Z'} fill="#f7c844" transform={`rotate(${a})`} />)}
        <text y="-160" textAnchor="middle" fontFamily='"Pirata One", serif' fontSize="34" fill="#f5e6c8">N</text>
      </g></g>
      {/* A small ship on the horizon */}
      <g transform="translate(260 600)"><g className="bob">
        <path d="M0 40 L180 40 L150 70 L30 70 Z" fill="#5b3a1e" />
        <path d="M90 40 V-60" stroke="#3b2410" strokeWidth="6" />
        <path d="M94 -55 Q 150 -10 94 30 Z" fill="#f5e6c8" />
        <path d="M86 -45 Q 40 -5 86 30 Z" fill="#ece0c4" />
        <path d="M90 -60 h30 v18 h-30z" fill="#111" />
        <circle cx="105" cy="-51" r="5" fill="#fff" />
      </g></g>
      <g stroke="#f5e6c8" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7">
        <path d="M600 200 q 12 -12 24 0 q 12 -12 24 0" /><path d="M700 160 q 9 -9 18 0 q 9 -9 18 0" /><path d="M820 230 q 10 -10 20 0 q 10 -10 20 0" />
      </g>
      <g className="waves">
        <path d="M0 760 Q 100 730 200 760 T 400 760 T 600 760 T 800 760 T 1000 760 T 1200 760 T 1400 760 T 1600 760 T 1800 760 V900 H0Z" fill="#1b6ca8" opacity="0.8" />
        <path d="M-100 810 Q 0 780 100 810 T 300 810 T 500 810 T 700 810 T 900 810 T 1100 810 T 1300 810 T 1500 810 T 1700 810 V900 H-100Z" fill="#2a8bd1" opacity="0.8" />
      </g>
    </svg>
  );
}

function Ghibli() {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="bd-svg">
      <defs>
        <linearGradient id="gh-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cbfe0" />
          <stop offset="0.7" stopColor="#cfe8f3" />
        </linearGradient>
        <filter id="gh-paint" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="40" />
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <linearGradient id="gh-h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b7d38f" /><stop offset="1" stopColor="#8db36a" /></linearGradient>
        <linearGradient id="gh-h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8db36a" /><stop offset="1" stopColor="#6a9255" /></linearGradient>
        <linearGradient id="gh-h3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6a9255" /><stop offset="1" stopColor="#4a6f43" /></linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#gh-sky)" />
      <g filter="url(#gh-paint)" className="drift slow" opacity="0.95">
        <ellipse cx="300" cy="200" rx="200" ry="70" fill="#fefae0" />
        <ellipse cx="420" cy="170" rx="140" ry="80" fill="#ffffff" />
        <ellipse cx="1150" cy="140" rx="260" ry="90" fill="#fefae0" />
        <ellipse cx="1300" cy="110" rx="150" ry="85" fill="#ffffff" />
        <ellipse cx="780" cy="300" rx="180" ry="50" fill="#fdf7e3" opacity="0.8" />
      </g>
      <g className="px px2"><path d="M0 640 Q 300 520 650 610 T 1600 560 V900 H0Z" fill="url(#gh-h1)" /></g>
      <g className="px px3">
        <path d="M0 720 Q 400 620 820 700 T 1600 680 V900 H0Z" fill="url(#gh-h2)" />
        <g transform="translate(1130 640)"><rect x="-6" y="-10" width="12" height="60" fill="#6b4a2b" /><ellipse cx="0" cy="-40" rx="70" ry="55" fill="#4f7a3f" /><ellipse cx="-30" cy="-25" rx="40" ry="30" fill="#5d8a4a" /></g>
      </g>
      <g className="px px4"><path d="M0 800 Q 500 730 1000 790 T 1600 780 V900 H0Z" fill="url(#gh-h3)" /></g>
      <g className="motes">
        {Array.from({ length: 24 }, (_, i) => <circle key={i} cx={(i * 71) % 1600} cy={300 + ((i * 53) % 500)} r={1.5 + (i % 3)} fill="#fffbe6" style={{ animationDelay: `${-(i * 0.9)}s` }} />)}
      </g>
    </svg>
  );
}

function Jjk() {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="bd-svg">
      <defs>
        <radialGradient id="jj-v1" cx="0.2" cy="0.3" r="0.6"><stop offset="0" stopColor="#7209b7" stopOpacity="0.45" /><stop offset="1" stopColor="#07070a" stopOpacity="0" /></radialGradient>
        <radialGradient id="jj-v2" cx="0.85" cy="0.75" r="0.5"><stop offset="0" stopColor="#e63946" stopOpacity="0.3" /><stop offset="1" stopColor="#07070a" stopOpacity="0" /></radialGradient>
        <linearGradient id="jj-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#00f5d4" stopOpacity="0" /><stop offset="0.5" stopColor="#00f5d4" /><stop offset="1" stopColor="#7209b7" /></linearGradient>
        <filter id="jj-glow"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <rect width="1600" height="900" fill="#07070a" />
      <rect width="1600" height="900" fill="url(#jj-v1)" />
      <rect width="1600" height="900" fill="url(#jj-v2)" />
      {/* A shrine silhouette rising from the dark */}
      <g className="px px3" fill="#101018">
        <path d="M520 900 V700 H1080 V900 Z" />
        <path d="M440 710 Q 800 600 1160 710 L1120 690 Q 800 590 480 690 Z" />
        <path d="M560 640 Q 800 540 1040 640 L1000 625 Q 800 535 600 625 Z" />
        <rect x="770" y="560" width="60" height="80" />
        {[600, 680, 920, 1000].map((x) => <rect key={x} x={x} y="700" width="18" height="200" />)}
      </g>
      <g className="flames" filter="url(#jj-glow)">
        {[220, 420, 1220, 1420, 820].map((x, i) => (
          <path key={x} d={`M${x} 900 C ${x - 40} 780, ${x + 50} 720, ${x} 600 C ${x - 30} 680, ${x + 40} 760, ${x} 900`} fill="url(#jj-flame)" style={{ animationDelay: `${i * 0.5}s` }} />
        ))}
      </g>
      <g className="sparks">
        {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={(i * 113) % 1600} cy={(i * 197) % 900} r={i % 5 === 0 ? 2.5 : 1.4} fill={i % 3 ? '#00f5d4' : '#e63946'} style={{ animationDelay: `${(i % 9) * 0.4}s` }} />)}
      </g>
    </svg>
  );
}

function Snow() {
  return (
    <div className="bd-fill">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="bd-svg">
        <g fill="none" stroke="#38bdf8" strokeWidth="3" opacity="0.5" className="rink">
          <ellipse cx="800" cy="840" rx="700" ry="120" />
          <ellipse cx="800" cy="840" rx="160" ry="40" />
          <line x1="800" y1="720" x2="800" y2="960" />
        </g>
        <path d="M0 900 L0 780 L120 700 L220 760 L360 640 L470 720 L560 690 L700 760 L0 760Z" fill="#0b3a55" opacity="0.6" />
        <path d="M1600 900 L1600 760 L1480 680 L1380 740 L1260 650 L1150 730 L1600 760Z" fill="#0b3a55" opacity="0.6" />
      </svg>
      <div className="snow" aria-hidden>
        {Array.from({ length: 50 }, (_, i) => <i key={i} style={{ left: `${(i * 2.03) % 100}%`, animationDuration: `${7 + (i % 6)}s`, animationDelay: `${-(i * 0.37) % 12}s`, width: 2 + (i % 4), height: 2 + (i % 4) }} />)}
      </div>
    </div>
  );
}

function Gold() {
  return (
    <div className="bd-fill">
      <div className="holo" />
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="bd-svg">
        {Array.from({ length: 22 }, (_, i) => (
          <path key={i} className="twinkle" d="M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5Z" fill={i % 3 ? '#facc15' : '#f9a8d4'} transform={`translate(${(i * 151) % 1600} ${(i * 89) % 900}) scale(${0.6 + (i % 3) * 0.4})`} style={{ animationDelay: `${(i % 8) * 0.5}s` }} />
        ))}
      </svg>
    </div>
  );
}

export function ThemeBackdrop({ deco }: { deco: Deco }) {
  const ref = useRef<HTMLDivElement>(null);
  // Parallax: the page scrolls inside .main, so pass its scroll to the layers as --scroll
  useEffect(() => {
    const el = ref.current;
    const main = document.querySelector('.main');
    if (!el || !main) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => el.style.setProperty('--scroll', String(Math.min(2000, main.scrollTop))));
    };
    main.addEventListener('scroll', on, { passive: true });
    return () => {
      main.removeEventListener('scroll', on);
      cancelAnimationFrame(raf);
    };
  });
  const scene =
    deco === 'sunset' ? <Sunset /> :
    deco === 'mario' ? <Mario /> :
    deco === 'october' ? <October /> :
    deco === 'onepiece' ? <OnePiece /> :
    deco === 'ghibli' ? <Ghibli /> :
    deco === 'jjk' ? <Jjk /> :
    deco === 'snow' ? <Snow /> :
    deco === 'gold' ? <Gold /> : null;
  if (!scene) return null;
  return <div ref={ref} className={'backdrop bd-' + deco} aria-hidden>{scene}</div>;
}
