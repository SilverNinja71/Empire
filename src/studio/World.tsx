import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import type { RenderStyle, StudioObject, World3D } from '../lib/types';
import { AssetModel, Mat, StyleContext } from './assets';
import { colorFor } from './terrain';

export const SCENE_LOOK: Record<RenderStyle, { bg: string; fog: [string, number, number] | null; label: string; desc: string }> = {
  realistic: { bg: '#a7d3f5', fog: ['#c9e3f7', 70, 260], label: 'Realistic', desc: 'Sunlight, soft shadows, sky' },
  ps1: { bg: '#2a1e3b', fog: ['#2a1e3b', 14, 60], label: 'Retro PS1', desc: 'Low-res pixels, wobbly vertices, dithering' },
  cel: { bg: '#8fd3ff', fog: null, label: 'Cel-shaded', desc: 'Flat toon colors with outlines' },
  voxel: { bg: '#070b16', fog: ['#070b16', 50, 180], label: 'Voxel', desc: 'Blocky ground, glowing edges' },
};

function Lights({ style, size }: { style: RenderStyle; size: number }) {
  const half = size / 2 + 8;
  if (style === 'realistic')
    return (
      <>
        <Sky sunPosition={[80, 50, 40]} turbidity={5} rayleigh={1.1} mieCoefficient={0.004} />
        <hemisphereLight args={['#dbeeff', '#4b5a2a', 0.65]} />
        <directionalLight
          position={[40, 60, 30]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-half}
          shadow-camera-right={half}
          shadow-camera-top={half}
          shadow-camera-bottom={-half}
          shadow-camera-far={220}
          shadow-bias={-0.0004}
          shadow-normalBias={0.04}
        />
      </>
    );
  if (style === 'ps1')
    return (
      <>
        <ambientLight intensity={0.8} color="#c4b5ff" />
        <directionalLight position={[30, 50, 10]} intensity={1.4} color="#ffd9a8" />
      </>
    );
  if (style === 'cel')
    return (
      <>
        <ambientLight intensity={0.7} />
        <directionalLight position={[30, 60, 40]} intensity={2.4} />
      </>
    );
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[30, 60, 20]} intensity={1.5} color="#cfe8ff" />
      <pointLight position={[0, 25, 0]} intensity={300} distance={120} color="#7c5cff" />
    </>
  );
}

/** Voxel look: one block per grid point, stacked up to the ground height. */
function Voxels({ world, version, onPointer }: { world: World3D; version: number; onPointer?: TerrainHandlers }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const step = world.segments > 96 ? 2 : 1;
  const n = world.segments + 1;
  const count = Math.ceil(n / step) ** 2;
  const cs = (world.size / world.segments) * step;
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    let k = 0;
    for (let z = 0; z < n; z += step) for (let x = 0; x < n; x += step) {
      const h = Math.round(world.heights[z * n + x] / 0.5) * 0.5;
      const bottom = -3;
      o.position.set(-world.size / 2 + x * (world.size / world.segments), (h + bottom) / 2, -world.size / 2 + z * (world.size / world.segments));
      o.scale.set(1, h - bottom, 1);
      o.updateMatrix();
      m.setMatrixAt(k, o.matrix);
      m.setColorAt(k, colorFor('voxel', h, 0, world.water, ((x * 7 + z * 13) % 10) / 10));
      k++;
    }
    m.count = k;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [world, version, n, step]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow {...onPointer}>
      <boxGeometry args={[cs * 0.98, 1, cs * 0.98]} />
      <meshStandardMaterial roughness={0.7} flatShading />
    </instancedMesh>
  );
}

export interface TerrainHandlers {
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerLeave?: (e: ThreeEvent<PointerEvent>) => void;
}

function Spinner({ type, children }: { type: string; children: (spin: number) => React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (g.current && (type === 'coin' || type === 'flag')) g.current.rotation.y = type === 'coin' ? s.clock.elapsedTime * 2 : 0;
  });
  return <group ref={g}>{children(0)}</group>;
}

export function WorldScene({
  world, geometry, version, terrain, objects, hidden, onObjectClick, objectRefs, showGrid = false, children,
}: {
  world: World3D;
  geometry: THREE.BufferGeometry;
  version: number;
  terrain?: TerrainHandlers;
  objects: StudioObject[];
  hidden?: Set<string>;
  onObjectClick?: (id: string, e: ThreeEvent<MouseEvent>) => void;
  objectRefs?: MutableRefObject<Map<string, THREE.Group>>;
  showGrid?: boolean;
  children?: React.ReactNode;
}) {
  const look = SCENE_LOOK[world.style];
  // PS1 fog closes in, but scaled to the map so the whole world stays readable
  const fog: [string, number, number] | null = world.style === 'ps1' ? [look.bg, world.size * 0.6, world.size * 2] : look.fog;
  const waterSize = world.size * 3;
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(world.size, world.segments / 2, world.style === 'voxel' ? '#7c5cff' : '#ffffff', world.style === 'voxel' ? '#22d3ee' : '#ffffff');
    (g.material as THREE.Material).transparent = true;
    (g.material as THREE.Material).opacity = world.style === 'voxel' ? 0.35 : 0.12;
    return g;
  }, [world.size, world.segments, world.style]);

  return (
    <StyleContext.Provider value={world.style}>
      <color attach="background" args={[look.bg]} />
      {fog && <fog attach="fog" args={fog} />}
      <Lights style={world.style} size={world.size} />
      {world.style === 'voxel' ? (
        <Voxels world={world} version={version} onPointer={terrain} />
      ) : (
        <mesh geometry={geometry} receiveShadow castShadow={world.style === 'realistic'} {...terrain}>
          <Mat vertexColors />
        </mesh>
      )}
      {/* Skirt under the map edge so it doesn't float in the sky */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.05, 0]}>
        <planeGeometry args={[world.size * 4, world.size * 4]} />
        <meshBasicMaterial color={world.style === 'voxel' ? '#0b1020' : world.style === 'ps1' ? '#1d1529' : '#5b6b3a'} />
      </mesh>
      {world.water != null && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, world.water, 0]} receiveShadow>
          <planeGeometry args={[waterSize, waterSize]} />
          <Mat color={world.style === 'voxel' ? '#1d4ed8' : '#2a7fd4'} transparent opacity={world.style === 'cel' ? 0.9 : 0.72} />
        </mesh>
      )}
      {showGrid && <primitive object={grid} position={[0, 0.02, 0]} />}
      {objects.map((o) =>
        hidden?.has(o.id) || (hidden && o.type === 'spawn') ? null : (
          <group
            key={o.id}
            ref={(g) => {
              if (!objectRefs) return;
              if (g) objectRefs.current.set(o.id, g);
              else objectRefs.current.delete(o.id);
            }}
            position={o.position}
            rotation={o.rotation}
            scale={o.scale}
            onClick={onObjectClick ? (e) => onObjectClick(o.id, e) : undefined}
          >
            <Spinner type={o.type}>{(spin) => <AssetModel type={o.type} seed={o.id} spin={spin} />}</Spinner>
          </group>
        ),
      )}
      {children}
    </StyleContext.Provider>
  );
}
