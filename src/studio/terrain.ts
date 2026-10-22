import * as THREE from 'three';
import type { RenderStyle, World3D } from '../lib/types';

/**
 * The ground is a square grid of heights: (segments + 1)² numbers, row by row from
 * the back edge (z = -size/2) to the front. Sculpting changes these numbers.
 */
export type BrushMode = 'raise' | 'lower' | 'smooth' | 'flatten';

export const MAX_SEGMENTS = 192;

export function newWorld(): World3D {
  const segments = 64;
  return { kind: '3d', segments, size: 64, heights: new Array((segments + 1) ** 2).fill(0), objects: [], style: 'realistic', water: null };
}

export const cell = (w: { size: number; segments: number }) => w.size / w.segments;

/** Ground height at a world position (blends the 4 nearest grid points). */
export function heightAt(h: ArrayLike<number>, segments: number, size: number, x: number, z: number): number {
  const n = segments + 1;
  const fx = Math.min(segments, Math.max(0, ((x + size / 2) / size) * segments));
  const fz = Math.min(segments, Math.max(0, ((z + size / 2) / size) * segments));
  const x0 = Math.floor(fx), z0 = Math.floor(fz);
  const x1 = Math.min(segments, x0 + 1), z1 = Math.min(segments, z0 + 1);
  const tx = fx - x0, tz = fz - z0;
  const a = h[z0 * n + x0], b = h[z0 * n + x1], c = h[z1 * n + x0], d = h[z1 * n + x1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

/**
 * One brush dab at (cx, cz). strength is "units per second" and dt the frame time,
 * so holding the mouse keeps raising at a steady speed. Returns true if anything moved.
 */
export function brush(h: Float32Array, segments: number, size: number, cx: number, cz: number, radius: number, strength: number, mode: BrushMode, dt: number, target: number): boolean {
  const n = segments + 1;
  const step = size / segments;
  const r2 = radius * radius;
  const gx0 = Math.max(0, Math.floor((cx - radius + size / 2) / step));
  const gx1 = Math.min(segments, Math.ceil((cx + radius + size / 2) / step));
  const gz0 = Math.max(0, Math.floor((cz - radius + size / 2) / step));
  const gz1 = Math.min(segments, Math.ceil((cz + radius + size / 2) / step));
  if (gx0 > gx1 || gz0 > gz1) return false;
  const src = mode === 'smooth' ? h.slice() : h;
  let moved = false;
  for (let gz = gz0; gz <= gz1; gz++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const x = -size / 2 + gx * step, z = -size / 2 + gz * step;
      const d2 = (x - cx) ** 2 + (z - cz) ** 2;
      if (d2 > r2) continue;
      const t = 1 - Math.sqrt(d2) / radius;
      const fall = t * t * (3 - 2 * t); // smoothstep: soft edge, full strength in the middle
      const i = gz * n + gx;
      const k = Math.min(1, strength * fall * dt);
      if (mode === 'raise') h[i] += strength * fall * dt * 2;
      else if (mode === 'lower') h[i] -= strength * fall * dt * 2;
      else if (mode === 'flatten') h[i] += (target - h[i]) * k;
      else {
        let sum = 0, cnt = 0;
        for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
          const xx = gx + ox, zz = gz + oz;
          if (xx < 0 || zz < 0 || xx > segments || zz > segments) continue;
          sum += src[zz * n + xx];
          cnt++;
        }
        h[i] += (sum / cnt - src[i]) * Math.min(1, k * 2);
      }
      h[i] = Math.max(-20, Math.min(40, h[i]));
      moved = true;
    }
  }
  return moved;
}

/** Make the map bigger: add `ring` grid cells on every side, copying the edge heights outward. */
export function extend(w: World3D, ring = 8): World3D {
  const s0 = w.segments, n0 = s0 + 1;
  const s1 = Math.min(MAX_SEGMENTS, s0 + ring * 2);
  const add = (s1 - s0) / 2;
  if (add <= 0) return w;
  const n1 = s1 + 1;
  const out = new Array(n1 * n1);
  for (let z = 0; z < n1; z++) for (let x = 0; x < n1; x++) {
    const ox = Math.min(s0, Math.max(0, x - add));
    const oz = Math.min(s0, Math.max(0, z - add));
    out[z * n1 + x] = w.heights[oz * n0 + ox];
  }
  return { ...w, segments: s1, size: w.size + add * 2 * cell(w), heights: out };
}

const PALETTES: Record<RenderStyle, { sand: string; grass: string; grass2: string; rock: string; snow: string; dirt: string }> = {
  realistic: { sand: '#c9b27c', grass: '#4f7f2f', grass2: '#6d9b3a', rock: '#7b7166', snow: '#f2f5f7', dirt: '#6b4f32' },
  ps1: { sand: '#b59a5b', grass: '#3f6b2a', grass2: '#58823a', rock: '#6a5f55', snow: '#d8dde2', dirt: '#5a4128' },
  cel: { sand: '#ffd97a', grass: '#56d364', grass2: '#7ee787', rock: '#9aa5b1', snow: '#ffffff', dirt: '#b7794a' },
  voxel: { sand: '#e0c36b', grass: '#3fb950', grass2: '#56d364', rock: '#8b949e', snow: '#f0f6fc', dirt: '#8b5a2b' },
};

/** Color each grid point by height and steepness: sand by water, grass, rock on cliffs, snow on peaks. */
export function colorFor(style: RenderStyle, h: number, slope: number, water: number | null, noise: number): THREE.Color {
  const p = PALETTES[style];
  const c = new THREE.Color();
  const w = water ?? -999;
  if (h < w + 0.4) c.set(p.sand);
  else if (h > 11) c.set(p.snow);
  else if (slope > 0.9) c.set(p.rock);
  else if (slope > 0.6) c.set(p.dirt).lerp(new THREE.Color(p.rock), 0.4);
  else c.set(p.grass).lerp(new THREE.Color(p.grass2), noise);
  if (style !== 'cel' && style !== 'voxel') c.offsetHSL(0, 0, (noise - 0.5) * 0.05);
  return c;
}

const noise2 = (x: number, z: number) => {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Build (or rebuild) the ground mesh from the heights. */
export function buildGeometry(w: World3D, geo?: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = w.segments + 1;
  let g = geo;
  if (!g || g.getAttribute('position').count !== n * n) {
    g?.dispose();
    g = new THREE.PlaneGeometry(w.size, w.size, w.segments, w.segments);
    g.rotateX(-Math.PI / 2);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
  }
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < n * n; i++) pos.setY(i, w.heights[i]);
  pos.needsUpdate = true;
  g.computeVertexNormals();
  recolor(w, g);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

export function recolor(w: World3D, g: THREE.BufferGeometry) {
  const n = w.segments + 1;
  const nor = g.getAttribute('normal') as THREE.BufferAttribute;
  const col = g.getAttribute('color') as THREE.BufferAttribute;
  for (let i = 0; i < n * n; i++) {
    const slope = 1 - nor.getY(i);
    const c = colorFor(w.style, w.heights[i], slope * 4, w.water, noise2(i % n, Math.floor(i / n)));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

/** Keep the saved heights small: two decimals are plenty. */
export const packHeights = (h: ArrayLike<number>) => Array.from(h, (v) => Math.round(v * 100) / 100);
