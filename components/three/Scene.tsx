"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  ContactShadows,
  Float,
  Lightformer,
} from "@react-three/drei";
import type { MotionValue } from "motion/react";
import { AirPod } from "./AirPod";
import { AirPodsCase } from "./AirPodsCase";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------ */
/*  Camera: ONE continuous move driven by overall page progress        */
/*  z is the "dolly". Every beat is a stop on a single dolly path.     */
/* ------------------------------------------------------------------ */

type Stop = { at: number; pos: [number, number, number]; look: [number, number, number] };

const STOPS: Stop[] = [
  // 0.00 — wide, case open, product small
  { at: 0.0, pos: [0, 0.35, 5.4], look: [0, 0.05, 0] },
  // 0.12 — push in toward the buds
  { at: 0.14, pos: [0.15, 0.55, 3.5], look: [0, 0.3, 0] },
  // 0.24 — close on the pair, slight orbit
  { at: 0.26, pos: [1.15, 0.75, 2.5], look: [0.1, 0.35, 0] },
  // 0.36 — move to the exploded view, side-on
  { at: 0.38, pos: [0.2, 0.6, 3.9], look: [0.35, 0.1, 0] },
  // 0.50 — hold through the explode, drift right
  { at: 0.52, pos: [1.0, 0.3, 3.4], look: [0.4, 0.0, 0] },
  // 0.62 — pull back for ANC ring shot
  { at: 0.64, pos: [-0.6, 0.5, 4.2], look: [0, 0.15, 0] },
  // 0.74 — orbit around for spatial audio
  { at: 0.76, pos: [1.4, 0.9, 3.0], look: [0, 0.3, 0] },
  // 0.86 — low hero angle, case closed
  { at: 0.88, pos: [-1.1, 0.15, 3.2], look: [0, 0.1, 0] },
  // 1.00 — settle back to center, finale
  { at: 1.0, pos: [0, 0.3, 4.4], look: [0, 0.15, 0] },
];

function cameraAt(p: number) {
  let i = 0;
  while (i < STOPS.length - 2 && p > STOPS[i + 1].at) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const raw = clamp01((p - a.at) / Math.max(1e-5, b.at - a.at));
  const t = smooth(raw);
  return {
    pos: [
      lerp(a.pos[0], b.pos[0], t),
      lerp(a.pos[1], b.pos[1], t),
      lerp(a.pos[2], b.pos[2], t),
    ] as [number, number, number],
    look: [
      lerp(a.look[0], b.look[0], t),
      lerp(a.look[1], b.look[1], t),
      lerp(a.look[2], b.look[2], t),
    ] as [number, number, number],
  };
}

function Rig({ progress }: { progress: MotionValue<number> }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));
  const desired = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const p = progress.get();
    const { pos, look: lk } = cameraAt(p);

    desired.current.set(pos[0], pos[1], pos[2]);
    look.current.set(lk[0], lk[1], lk[2]);

    const k = 1 - Math.pow(0.0016, dt); // frame-rate independent damping
    camera.position.lerp(desired.current, k);
    target.current.lerp(look.current, k);
    camera.lookAt(target.current);
  });

  return null;
}

/* ------------------------------------------------------------------ */
/*  Sound rings for the ANC beat                                       */
/* ------------------------------------------------------------------ */

function SoundRings({ progress }: { progress: MotionValue<number> }) {
  const group = useRef<THREE.Group>(null);
  const rings = useMemo(() => [0, 0.9, 1.8, 2.7, 3.6], []);

  useFrame(({ clock }) => {
    const p = progress.get();
    const on = seg(p, 0.55, 0.63) * (1 - seg(p, 0.7, 0.78));
    if (!group.current) return;
    group.current.visible = on > 0.01;
    const t = clock.getElapsedTime();
    group.current.children.forEach((c, i) => {
      const phase = (t * 0.55 + rings[i]) % 1;
      const s = 0.35 + phase * 1.9;
      c.scale.setScalar(s);
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = on * (1 - phase) * 0.55;
    });
  });

  return (
    <group ref={group} position={[0, 0.25, -0.3]} rotation={[Math.PI / 2.2, 0, 0]}>
      {rings.map((r) => (
        <mesh key={r}>
          <ringGeometry args={[0.62, 0.635, 128]} />
          <meshBasicMaterial
            color="#7dd3fc"
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene content                                                      */
/* ------------------------------------------------------------------ */

function Content({ progress }: { progress: MotionValue<number> }) {
  const buds = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!buds.current) return;
    const p = progress.get();
    // buds lift out of the case at the start and return at the end
    const out = smooth(seg(p, 0.04, 0.16)) * (1 - smooth(seg(p, 0.9, 1.0)));
    buds.current.position.y = lerp(-0.55, 0.55, out);
    buds.current.rotation.y = lerp(0, 0.35, out);
    const sc = lerp(0.75, 1, out);
    buds.current.scale.setScalar(sc);
    buds.current.visible = out > 0.02;
  });

  return (
    <>
      <Rig progress={progress} />

      {/* lighting rig — studio softboxes baked into an env map */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          intensity={4}
          position={[0, 4, -6]}
          scale={[14, 6, 1]}
          color="#ffffff"
        />
        <Lightformer
          intensity={2.4}
          position={[-6, 1, 2]}
          rotation-y={Math.PI / 2}
          scale={[10, 6, 1]}
          color="#bcd8ff"
        />
        <Lightformer
          intensity={2.0}
          position={[6, 0, 2]}
          rotation-y={-Math.PI / 2}
          scale={[10, 6, 1]}
          color="#ffd9b0"
        />
        <Lightformer
          intensity={1.2}
          position={[0, -4, 1]}
          scale={[12, 4, 1]}
          color="#8899ff"
        />
      </Environment>

      <ambientLight intensity={0.25} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-4, 2, -3]} intensity={0.7} color="#9fc4ff" />

      {/* the case, always present */}
      <AirPodsCase progress={progress} position={[0, -0.05, 0]} rotation={[0, 0, 0]} />

      {/* the buds — group lifts out */}
      <group ref={buds} position={[0, 0.55, 0]}>
        <Float speed={1.1} rotationIntensity={0.22} floatIntensity={0.32}>
          <AirPod
            progress={progress}
            position={[-0.17, 0.02, 0.05]}
            rotation={[0.12, -0.35, 0.14]}
            explode={[0.4, 0.56]}
          />
        </Float>
        <Float speed={0.9} rotationIntensity={0.18} floatIntensity={0.28}>
          <AirPod
            progress={progress}
            position={[0.19, 0.06, -0.02]}
            rotation={[0.1, 0.5, -0.12]}
            scale={0.98}
            explode={[0.4, 0.56]}
          />
        </Float>
      </group>

      <SoundRings progress={progress} />

      <ContactShadows
        position={[0, -0.42, 0]}
        opacity={0.55}
        scale={12}
        blur={2.6}
        far={4}
        resolution={512}
        color="#000000"
      />
    </>
  );
}

export default function Scene({ progress }: { progress: MotionValue<number> }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.35, 5.4], fov: 38, near: 0.1, far: 60 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
      }}
    >
      <Content progress={progress} />
    </Canvas>
  );
}
