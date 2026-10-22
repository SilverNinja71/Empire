import { createContext, useContext, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { Outlines } from '@react-three/drei';
import type { RenderStyle } from '../lib/types';

/** Everything you can place in a 3D world. radius = how close the player can walk (0 = walk through). */
export interface AssetDef {
  id: string;
  name: string;
  cat: 'Trees & Foliage' | 'Rocks & Cliffs' | 'Forest Packs' | 'Water & Paths' | 'Props & Buildings' | 'Game Pieces';
  radius: number;
  emoji: string;
  pack?: { of: string[]; count: number; spread: number };
}

export const ASSETS: AssetDef[] = [
  { id: 'pine', name: 'Pine tree', cat: 'Trees & Foliage', radius: 0.6, emoji: '🌲' },
  { id: 'oak', name: 'Oak tree', cat: 'Trees & Foliage', radius: 0.7, emoji: '🌳' },
  { id: 'birch', name: 'Birch', cat: 'Trees & Foliage', radius: 0.4, emoji: '🌿' },
  { id: 'palm', name: 'Palm tree', cat: 'Trees & Foliage', radius: 0.4, emoji: '🌴' },
  { id: 'bush', name: 'Bush', cat: 'Trees & Foliage', radius: 0, emoji: '🫧' },
  { id: 'flowers', name: 'Flowers', cat: 'Trees & Foliage', radius: 0, emoji: '🌼' },
  { id: 'rock', name: 'Rock', cat: 'Rocks & Cliffs', radius: 0.7, emoji: '🪨' },
  { id: 'boulder', name: 'Boulder', cat: 'Rocks & Cliffs', radius: 1.6, emoji: '⛰️' },
  { id: 'cliff', name: 'Cliff wall', cat: 'Rocks & Cliffs', radius: 2.2, emoji: '🧱' },
  { id: 'crystal', name: 'Ice crystal', cat: 'Rocks & Cliffs', radius: 0.6, emoji: '💎' },
  { id: 'forest', name: 'Pine forest', cat: 'Forest Packs', radius: 0, emoji: '🌲🌲', pack: { of: ['pine', 'pine', 'pine', 'bush'], count: 10, spread: 7 } },
  { id: 'grove', name: 'Oak grove', cat: 'Forest Packs', radius: 0, emoji: '🌳🌳', pack: { of: ['oak', 'birch', 'bush', 'flowers'], count: 9, spread: 6 } },
  { id: 'rockfield', name: 'Rock field', cat: 'Forest Packs', radius: 0, emoji: '🪨🪨', pack: { of: ['rock', 'rock', 'boulder', 'bush'], count: 7, spread: 6 } },
  { id: 'pond', name: 'Pond', cat: 'Water & Paths', radius: 0, emoji: '💧' },
  { id: 'path', name: 'Path stones', cat: 'Water & Paths', radius: 0, emoji: '🟫' },
  { id: 'bridge', name: 'Bridge', cat: 'Water & Paths', radius: 0, emoji: '🌉' },
  { id: 'house', name: 'Cabin', cat: 'Props & Buildings', radius: 2.2, emoji: '🏠' },
  { id: 'tower', name: 'Watchtower', cat: 'Props & Buildings', radius: 1.3, emoji: '🗼' },
  { id: 'fence', name: 'Fence', cat: 'Props & Buildings', radius: 0.4, emoji: '🚧' },
  { id: 'lamp', name: 'Lamp post', cat: 'Props & Buildings', radius: 0.25, emoji: '💡' },
  { id: 'crate', name: 'Crate', cat: 'Props & Buildings', radius: 0.6, emoji: '📦' },
  { id: 'spawn', name: 'Player start', cat: 'Game Pieces', radius: 0, emoji: '🐧' },
  { id: 'coin', name: 'Coin', cat: 'Game Pieces', radius: 0, emoji: '🪙' },
  { id: 'flag', name: 'Goal flag', cat: 'Game Pieces', radius: 0, emoji: '🏁' },
];

export const ASSET = Object.fromEntries(ASSETS.map((a) => [a.id, a])) as Record<string, AssetDef>;
export const CATEGORIES = Array.from(new Set(ASSETS.map((a) => a.cat)));

// ---------- Materials for each look ----------

export const StyleContext = createContext<RenderStyle>('realistic');

let toonRamp: THREE.DataTexture | null = null;
function ramp() {
  if (!toonRamp) {
    toonRamp = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
    toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
    toonRamp.needsUpdate = true;
  }
  return toonRamp;
}

/** PS1 look: snap every vertex to a coarse screen grid so models wobble like 1996 hardware. */
export function psxSnap(shader: { vertexShader: string }) {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <project_vertex>',
    `#include <project_vertex>
     vec2 grid = vec2(160.0, 120.0);
     gl_Position.xy = floor(gl_Position.xy / gl_Position.w * grid + 0.5) / grid * gl_Position.w;`,
  );
}

export function Mat({ color, emissive, transparent, opacity, vertexColors }: { color?: string; emissive?: string; transparent?: boolean; opacity?: number; vertexColors?: boolean }) {
  const style = useContext(StyleContext);
  const common = { color: vertexColors ? '#ffffff' : color, transparent, opacity, vertexColors };
  if (style === 'ps1') return <meshLambertMaterial {...common} flatShading emissive={emissive} dithering onBeforeCompile={psxSnap} />;
  if (style === 'cel') return <meshToonMaterial {...common} gradientMap={ramp()} emissive={emissive} />;
  if (style === 'voxel') return <meshStandardMaterial {...common} flatShading roughness={0.8} emissive={emissive ?? color} emissiveIntensity={emissive ? 0.8 : 0.08} />;
  return <meshStandardMaterial {...common} roughness={0.85} metalness={0} emissive={emissive} />;
}

type ShapeKind = 'cone' | 'sphere' | 'cyl' | 'box' | 'ico' | 'dodeca';

/** A basic shape. In the voxel look everything becomes a block; in cel it gets an outline. */
function Shape({ kind, args, color, emissive, position, rotation, scale, cast = true, transparent, opacity }: {
  kind: ShapeKind;
  args?: number[];
  color: string;
  emissive?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  cast?: boolean;
  transparent?: boolean;
  opacity?: number;
}) {
  const style = useContext(StyleContext);
  const a = args ?? [];
  let geo: ReactNode;
  if (style === 'voxel') {
    // Block version of the same size
    const [w, h, d] =
      kind === 'cone' ? [a[0] * 1.5, a[1], a[0] * 1.5] :
      kind === 'sphere' || kind === 'ico' || kind === 'dodeca' ? [a[0] * 1.7, a[0] * 1.7, a[0] * 1.7] :
      kind === 'cyl' ? [a[0] * 1.8, a[2], a[0] * 1.8] : [a[0], a[1], a[2]];
    geo = <boxGeometry args={[w, h, d]} />;
  } else if (kind === 'cone') geo = <coneGeometry args={[a[0], a[1], style === 'ps1' ? 6 : (a[2] ?? 10)]} />;
  else if (kind === 'sphere') geo = <sphereGeometry args={[a[0], style === 'ps1' ? 6 : 14, style === 'ps1' ? 5 : 10]} />;
  else if (kind === 'cyl') geo = <cylinderGeometry args={[a[0], a[1], a[2], style === 'ps1' ? 5 : (a[3] ?? 10)]} />;
  else if (kind === 'ico') geo = <icosahedronGeometry args={[a[0], 0]} />;
  else if (kind === 'dodeca') geo = <dodecahedronGeometry args={[a[0], 0]} />;
  else geo = <boxGeometry args={[a[0], a[1], a[2]]} />;
  return (
    <mesh position={position} rotation={rotation} scale={scale} castShadow={cast} receiveShadow>
      {geo}
      <Mat color={color} emissive={emissive} transparent={transparent} opacity={opacity} />
      {style === 'cel' && !transparent && <Outlines thickness={0.035} color="#1b1b2f" />}
    </mesh>
  );
}

function rand(seed: string, k: number) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const s = Math.sin(h * 0.0001 + k * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** The 3D model for each asset type. `seed` varies colors a little so forests don't look copy-pasted. */
export function AssetModel({ type, seed = '', spin = 0 }: { type: string; seed?: string; spin?: number }) {
  const v = rand(seed, 1);
  const leaf = useMemo(() => new THREE.Color('#2f7d32').offsetHSL((v - 0.5) * 0.06, 0, (v - 0.5) * 0.12).getStyle(), [v]);
  switch (type) {
    case 'pine':
      return (
        <group>
          <Shape kind="cyl" args={[0.18, 0.25, 1.2]} color="#6b4423" position={[0, 0.6, 0]} />
          <Shape kind="cone" args={[1.3, 2.2, 8]} color={leaf} position={[0, 2.0, 0]} />
          <Shape kind="cone" args={[1.0, 1.8, 8]} color={leaf} position={[0, 3.1, 0]} />
          <Shape kind="cone" args={[0.65, 1.4, 8]} color={leaf} position={[0, 4.0, 0]} />
        </group>
      );
    case 'oak':
      return (
        <group>
          <Shape kind="cyl" args={[0.25, 0.35, 1.8]} color="#5d4027" position={[0, 0.9, 0]} />
          <Shape kind="sphere" args={[1.5]} color={new THREE.Color('#3f8f3a').offsetHSL((v - 0.5) * 0.08, 0, 0).getStyle()} position={[0, 2.7, 0]} />
          <Shape kind="sphere" args={[1.0]} color="#4d9e44" position={[0.9, 2.3, 0.3]} />
          <Shape kind="sphere" args={[0.9]} color="#3a8535" position={[-0.8, 2.4, -0.4]} />
        </group>
      );
    case 'birch':
      return (
        <group>
          <Shape kind="cyl" args={[0.12, 0.16, 3.2]} color="#f1efe6" position={[0, 1.6, 0]} />
          <Shape kind="sphere" args={[0.95]} color="#9ccc4a" position={[0, 3.4, 0]} scale={[1, 1.3, 1]} />
        </group>
      );
    case 'palm':
      return (
        <group>
          <Shape kind="cyl" args={[0.14, 0.22, 3.4]} color="#9c6b3c" position={[0.15, 1.7, 0]} rotation={[0, 0, -0.08]} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Shape key={i} kind="box" args={[2.2, 0.08, 0.5]} color="#3fa34d" position={[Math.cos((i / 5) * Math.PI * 2) * 0.9 + 0.3, 3.3, Math.sin((i / 5) * Math.PI * 2) * 0.9]} rotation={[0, -(i / 5) * Math.PI * 2, -0.35]} />
          ))}
        </group>
      );
    case 'bush':
      return (
        <group>
          <Shape kind="sphere" args={[0.6]} color="#3b8d3b" position={[0, 0.4, 0]} />
          <Shape kind="sphere" args={[0.45]} color="#4aa34a" position={[0.45, 0.32, 0.1]} />
          <Shape kind="sphere" args={[0.4]} color="#358035" position={[-0.4, 0.3, -0.1]} />
        </group>
      );
    case 'flowers':
      return (
        <group>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = i * 1.1 + v * 3, r = 0.2 + (i % 3) * 0.25;
            const col = ['#f472b6', '#facc15', '#a78bfa', '#fb7185', '#ffffff', '#60a5fa'][(i + Math.floor(v * 6)) % 6];
            return (
              <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
                <Shape kind="cyl" args={[0.02, 0.02, 0.4, 4]} color="#2f7d32" position={[0, 0.2, 0]} cast={false} />
                <Shape kind="sphere" args={[0.09]} color={col} position={[0, 0.42, 0]} cast={false} />
              </group>
            );
          })}
        </group>
      );
    case 'rock':
      return <Shape kind="dodeca" args={[0.7]} color={new THREE.Color('#7d7d7d').offsetHSL(0, 0, (v - 0.5) * 0.15).getStyle()} position={[0, 0.35, 0]} scale={[1.1, 0.75, 0.9]} rotation={[v, v * 3, 0]} />;
    case 'boulder':
      return (
        <group>
          <Shape kind="dodeca" args={[1.5]} color="#6f6a64" position={[0, 0.9, 0]} scale={[1.2, 0.85, 1]} rotation={[0.3, v * 3, 0.1]} />
          <Shape kind="dodeca" args={[0.7]} color="#85807a" position={[1.3, 0.4, 0.4]} rotation={[v, 0, 0]} />
        </group>
      );
    case 'cliff':
      return (
        <group>
          <Shape kind="box" args={[4.5, 4, 1.6]} color="#7a6f63" position={[0, 2, 0]} rotation={[0, 0, 0.03]} />
          <Shape kind="box" args={[3, 2.6, 1.8]} color="#8a7e70" position={[0.6, 1.3, 0.5]} rotation={[0, 0.2, 0]} />
          <Shape kind="box" args={[4.6, 0.3, 1.7]} color="#4f8a3a" position={[0, 4.1, 0]} />
        </group>
      );
    case 'crystal':
      return (
        <group>
          <Shape kind="cone" args={[0.35, 1.8, 5]} color="#9be7ff" emissive="#2fb5ff" position={[0, 0.9, 0]} />
          <Shape kind="cone" args={[0.25, 1.1, 5]} color="#c4f1ff" emissive="#2fb5ff" position={[0.4, 0.5, 0.1]} rotation={[0, 0, -0.4]} />
          <Shape kind="cone" args={[0.22, 0.9, 5]} color="#c4f1ff" emissive="#2fb5ff" position={[-0.35, 0.4, -0.1]} rotation={[0.2, 0, 0.45]} />
        </group>
      );
    case 'pond':
      return (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} receiveShadow>
            <circleGeometry args={[3, 28]} />
            <Mat color="#2b7fd6" transparent opacity={0.85} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <ringGeometry args={[2.9, 3.4, 28]} />
            <Mat color="#c9b27c" />
          </mesh>
        </group>
      );
    case 'path':
      return (
        <group>
          {[0, 1, 2, 3, 4].map((i) => (
            <Shape key={i} kind="box" args={[0.9, 0.12, 0.9]} color={i % 2 ? '#9a8b78' : '#a89884'} position={[(rand(seed, i) - 0.5) * 0.4, 0.06, i * 1.05 - 2.1]} rotation={[0, rand(seed, i + 9), 0]} cast={false} />
          ))}
        </group>
      );
    case 'bridge':
      return (
        <group>
          <Shape kind="box" args={[1.8, 0.2, 6]} color="#8b5a2b" position={[0, 0.6, 0]} />
          {[-1, 1].map((s) => <Shape key={s} kind="box" args={[0.12, 0.6, 6]} color="#6b4423" position={[s * 0.85, 1.0, 0]} />)}
          {[-2.6, 2.6].flatMap((z) => [-0.85, 0.85].map((x) => <Shape key={x + ':' + z} kind="cyl" args={[0.12, 0.12, 1.4]} color="#5d3b1e" position={[x, 0.3, z]} />))}
        </group>
      );
    case 'house':
      return (
        <group>
          <Shape kind="box" args={[3.4, 2.2, 3]} color="#b7794a" position={[0, 1.1, 0]} />
          <Shape kind="cone" args={[2.9, 1.6, 4]} color="#b23a3a" position={[0, 2.95, 0]} rotation={[0, Math.PI / 4, 0]} />
          <Shape kind="box" args={[0.8, 1.3, 0.1]} color="#5d3b1e" position={[0, 0.65, 1.52]} />
          <Shape kind="box" args={[0.7, 0.6, 0.1]} color="#fde68a" emissive="#f59e0b" position={[-1, 1.4, 1.52]} />
          <Shape kind="box" args={[0.4, 1.2, 0.4]} color="#7a7a7a" position={[1, 3.3, -0.6]} />
        </group>
      );
    case 'tower':
      return (
        <group>
          <Shape kind="cyl" args={[1.1, 1.3, 5, 8]} color="#9a9a9a" position={[0, 2.5, 0]} />
          <Shape kind="cyl" args={[1.4, 1.4, 0.4, 8]} color="#7d7d7d" position={[0, 5.2, 0]} />
          <Shape kind="cone" args={[1.5, 1.8, 8]} color="#3b5bb2" position={[0, 6.3, 0]} />
        </group>
      );
    case 'fence':
      return (
        <group>
          {[-1.2, 0, 1.2].map((x) => <Shape key={x} kind="box" args={[0.15, 1, 0.15]} color="#8b5a2b" position={[x, 0.5, 0]} />)}
          {[0.35, 0.75].map((y) => <Shape key={y} kind="box" args={[2.6, 0.12, 0.08]} color="#a0703f" position={[0, y, 0]} />)}
        </group>
      );
    case 'lamp':
      return (
        <group>
          <Shape kind="cyl" args={[0.07, 0.1, 3]} color="#2b2b2b" position={[0, 1.5, 0]} />
          <Shape kind="sphere" args={[0.25]} color="#fff7cc" emissive="#facc15" position={[0, 3.1, 0]} cast={false} />
        </group>
      );
    case 'crate':
      return <Shape kind="box" args={[1, 1, 1]} color="#b07a43" position={[0, 0.5, 0]} rotation={[0, v, 0]} />;
    case 'spawn':
      return (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
            <ringGeometry args={[0.7, 0.95, 24]} />
            <meshBasicMaterial color="#22d3ee" />
          </mesh>
          <PenguinModel />
        </group>
      );
    case 'coin':
      return (
        <group position={[0, 1, 0]} rotation={[0, spin, 0]}>
          <Shape kind="cyl" args={[0.4, 0.4, 0.1, 16]} color="#facc15" emissive="#b45309" rotation={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case 'flag':
      return (
        <group>
          <Shape kind="cyl" args={[0.06, 0.06, 3]} color="#e5e7eb" position={[0, 1.5, 0]} />
          <Shape kind="box" args={[1.2, 0.75, 0.05]} color="#ef4444" emissive="#7f1d1d" position={[0.62, 2.6, 0]} rotation={[0, 0, Math.sin(spin * 3) * 0.05]} />
        </group>
      );
    default:
      return <Shape kind="box" args={[1, 1, 1]} color="#ff00ff" position={[0, 0.5, 0]} />;
  }
}

/** The player: a penguin made of simple shapes. */
export function PenguinModel({ waddle = 0 }: { waddle?: number }) {
  return (
    <group rotation={[0, 0, Math.sin(waddle) * 0.12]}>
      <Shape kind="sphere" args={[0.5]} color="#1f2a36" position={[0, 0.65, 0]} scale={[1, 1.25, 0.95]} />
      <Shape kind="sphere" args={[0.36]} color="#ffffff" position={[0, 0.6, 0.2]} scale={[1, 1.25, 0.8]} cast={false} />
      <Shape kind="sphere" args={[0.32]} color="#1f2a36" position={[0, 1.35, 0]} />
      <Shape kind="sphere" args={[0.07]} color="#ffffff" position={[0.12, 1.42, 0.27]} cast={false} />
      <Shape kind="sphere" args={[0.07]} color="#ffffff" position={[-0.12, 1.42, 0.27]} cast={false} />
      <Shape kind="cone" args={[0.1, 0.3, 6]} color="#f7a21b" position={[0, 1.32, 0.38]} rotation={[Math.PI / 2, 0, 0]} />
      <Shape kind="box" args={[0.22, 0.06, 0.32]} color="#f7a21b" position={[0.16, 0.04, 0.08]} />
      <Shape kind="box" args={[0.22, 0.06, 0.32]} color="#f7a21b" position={[-0.16, 0.04, 0.08]} />
      <Shape kind="box" args={[0.1, 0.55, 0.3]} color="#1f2a36" position={[0.5, 0.7, 0]} rotation={[0, 0, 0.3 + Math.sin(waddle) * 0.2]} />
      <Shape kind="box" args={[0.1, 0.55, 0.3]} color="#1f2a36" position={[-0.5, 0.7, 0]} rotation={[0, 0, -0.3 - Math.sin(waddle) * 0.2]} />
    </group>
  );
}
