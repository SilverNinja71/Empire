import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { StudioObject, World3D } from '../lib/types';
import { ASSET, PenguinModel } from './assets';
import { heightAt } from './terrain';

/**
 * Test Play: a penguin you walk around with WASD. Drag to look around, Space to jump,
 * Shift to run, V to switch between third-person and first-person.
 */
export function Player({ world, objects, collected, onCollect, onGoal, firstPerson }: {
  world: World3D;
  objects: StudioObject[];
  collected: Set<string>;
  onCollect: (id: string) => void;
  onGoal: () => void;
  firstPerson: boolean;
}) {
  const { camera, gl } = useThree();
  const body = useRef<THREE.Group>(null);
  const waddle = useRef<THREE.Group>(null);
  const spawn = objects.find((o) => o.type === 'spawn');
  const start = new THREE.Vector3(spawn?.position[0] ?? 0, 0, spawn?.position[2] ?? 0);
  const s = useRef({
    pos: start.clone().setY(heightAt(world.heights, world.segments, world.size, start.x, start.z) + 0.1),
    vy: 0,
    yaw: spawn ? spawn.rotation[1] : 0,
    camYaw: spawn ? spawn.rotation[1] + Math.PI : Math.PI,
    pitch: 0.35,
    ground: true,
    walk: 0,
    keys: new Set<string>(),
    goalHit: false,
  });

  useEffect(() => {
    const st = s.current;
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea')) return;
      st.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => st.keys.delete(e.code);
    const blur = () => st.keys.clear();
    let drag: { x: number; y: number } | null = null;
    const el = gl.domElement;
    const pd = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); };
    const pm = (e: PointerEvent) => {
      if (!drag) return;
      st.camYaw -= (e.clientX - drag.x) * 0.006;
      st.pitch = Math.min(1.2, Math.max(-0.5, st.pitch + (e.clientY - drag.y) * 0.004));
      drag = { x: e.clientX, y: e.clientY };
    };
    const pu = () => { drag = null; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    el.addEventListener('pointerdown', pd);
    el.addEventListener('pointermove', pm);
    el.addEventListener('pointerup', pu);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      el.removeEventListener('pointerdown', pd);
      el.removeEventListener('pointermove', pm);
      el.removeEventListener('pointerup', pu);
    };
  }, [gl]);

  const solids = objects.filter((o) => ASSET[o.type]?.radius > 0);
  const tmp = new THREE.Vector3();

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const st = s.current;
    const k = st.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    if (k.has('KeyQ')) st.camYaw += dt * 2;
    if (k.has('KeyE')) st.camYaw -= dt * 2;
    const ground = heightAt(world.heights, world.segments, world.size, st.pos.x, st.pos.z);
    const swimming = world.water != null && st.pos.y < world.water - 0.4;
    const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? 11 : 6) * (swimming ? 0.5 : 1);
    // Move relative to where the camera looks
    const fwd = new THREE.Vector3(-Math.sin(st.camYaw), 0, -Math.cos(st.camYaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = fwd.multiplyScalar(f).add(right.multiplyScalar(r));
    if (move.lengthSq() > 0) {
      move.normalize();
      st.pos.addScaledVector(move, speed * dt);
      st.yaw = Math.atan2(move.x, move.z);
      st.walk += dt * speed * 1.6;
    }
    // Bump into trees, rocks and buildings
    for (const o of solids) {
      const rad = ASSET[o.type].radius * Math.max(o.scale[0], o.scale[2]) + 0.35;
      tmp.set(st.pos.x - o.position[0], 0, st.pos.z - o.position[2]);
      const d = tmp.length();
      if (d < rad && st.pos.y < o.position[1] + 3 * o.scale[1]) {
        if (d < 1e-4) tmp.set(1, 0, 0);
        st.pos.x = o.position[0] + (tmp.x / (d || 1)) * rad;
        st.pos.z = o.position[2] + (tmp.z / (d || 1)) * rad;
      }
    }
    const lim = world.size / 2 - 0.5;
    st.pos.x = Math.max(-lim, Math.min(lim, st.pos.x));
    st.pos.z = Math.max(-lim, Math.min(lim, st.pos.z));
    // Gravity and jumping (swimming floats you up gently)
    const g2 = heightAt(world.heights, world.segments, world.size, st.pos.x, st.pos.z);
    if (swimming) {
      st.vy = k.has('Space') ? 3 : Math.max(st.vy - 6 * dt, -2);
    } else {
      if (st.ground && k.has('Space')) { st.vy = 9; st.ground = false; }
      st.vy -= 25 * dt;
    }
    st.pos.y += st.vy * dt;
    if (st.pos.y <= g2) {
      // Step up gentle slopes, stop at steep ones
      if (g2 - ground > 1.2 && st.ground) {
        st.pos.x -= move.x * speed * dt;
        st.pos.z -= move.z * speed * dt;
      }
      st.pos.y = Math.max(st.pos.y, heightAt(world.heights, world.segments, world.size, st.pos.x, st.pos.z));
      st.vy = 0;
      st.ground = true;
    }
    if (st.pos.y < -30) { st.pos.copy(start).setY(heightAt(world.heights, world.segments, world.size, start.x, start.z) + 2); st.vy = 0; }

    // Coins and the goal flag
    for (const o of objects) {
      if (o.type === 'coin' && !collected.has(o.id) && Math.hypot(o.position[0] - st.pos.x, o.position[2] - st.pos.z) < 1.3 && Math.abs(o.position[1] + 1 - st.pos.y) < 2.5) onCollect(o.id);
      if (o.type === 'flag' && !st.goalHit && Math.hypot(o.position[0] - st.pos.x, o.position[2] - st.pos.z) < 1.6) { st.goalHit = true; onGoal(); }
      if (o.type === 'flag' && st.goalHit && Math.hypot(o.position[0] - st.pos.x, o.position[2] - st.pos.z) > 3) st.goalHit = false;
    }

    if (body.current) {
      body.current.position.copy(st.pos);
      body.current.rotation.y = st.yaw;
      body.current.visible = !firstPerson;
    }
    if (waddle.current) waddle.current.rotation.z = move.lengthSq() > 0 && st.ground ? Math.sin(st.walk) * 0.14 : waddle.current.rotation.z * 0.8;
    // Camera
    const head = st.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
    if (firstPerson) {
      camera.position.copy(head);
      const look = new THREE.Vector3(-Math.sin(st.camYaw) * Math.cos(st.pitch - 0.35), -Math.sin(st.pitch - 0.35), -Math.cos(st.camYaw) * Math.cos(st.pitch - 0.35));
      camera.lookAt(head.clone().add(look));
    } else {
      const dist = 7;
      const want = head.clone().add(new THREE.Vector3(Math.sin(st.camYaw) * Math.cos(st.pitch) * dist, Math.sin(st.pitch) * dist, Math.cos(st.camYaw) * Math.cos(st.pitch) * dist));
      const floor = heightAt(world.heights, world.segments, world.size, want.x, want.z) + 0.8;
      if (want.y < floor) want.y = floor;
      camera.position.lerp(want, 1 - Math.pow(0.0005, dt));
      camera.lookAt(head);
    }
  });

  return (
    <group ref={body}>
      <group ref={waddle}>
        <PenguinModel />
      </group>
    </group>
  );
}
