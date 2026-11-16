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

/**
 * A stop is where the camera stands and where it looks.
 * Framing trick: the product stays at world origin, so its screen position is
 * driven by (lookX - productX). A NEGATIVE lookX pushes the product to the
 * right of frame (room for left-hand copy) and vice versa.
 */
const S = (
  at: number,
  cam: [number, number, number],
  look: [number, number, number]
): Stop => ({ at, pos: cam, look });

const STOPS: Stop[] = [
  // hero — product right, headline left
  S(0.0, [0, 0.5, 4.8], [-0.52, 0.22, 0]),
  S(0.14, [0, 0.52, 4.4], [-0.56, 0.36, 0]),
  // anatomy — copy on the right, so product goes left
  S(0.26, [0, 0.62, 4.15], [0.56, 0.42, 0]),
  // "look closer" — dead centre
  S(0.36, [0, 0.46, 4.0], [0, 0.3, 0]),
  // explode — pull back + aim higher so the fans of parts have room
  S(0.46, [0.1, 0.62, 5.85], [-0.4, 0.46, 0]),
  S(0.56, [0.15, 0.6, 5.75], [-0.42, 0.44, 0]),
  // ANC — copy left, rings around the product right of centre
  S(0.66, [-0.05, 0.52, 4.7], [-0.5, 0.26, 0]),
  // transparency — copy right
  S(0.76, [0.05, 0.5, 4.4], [0.55, 0.3, 0]),
  // spatial — centred
  S(0.86, [0, 0.4, 4.3], [0, 0.26, 0]),
  // finale — centred, settled
  S(1.0, [0, 0.42, 4.8], [0, 0.24, 0]),
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
  const budA = useRef<THREE.Group>(null);
  const budB = useRef<THREE.Group>(null);
  const caseGroup = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!buds.current) return;
    const p = progress.get();
    // buds lift out of the case at the start and return at the end
    const out = smooth(seg(p, 0.03, 0.15)) * (1 - smooth(seg(p, 0.9, 0.99)));
    buds.current.position.y = lerp(-0.18, 1.0, out);
    buds.current.position.z = lerp(0, 0.16, out);
    buds.current.rotation.y = lerp(0, 0.26, out);
    buds.current.scale.setScalar(lerp(0.72, 0.95, out));
    buds.current.visible = out > 0.015;

    // During the anatomy beat the shot becomes a SINGLE bud: the second bud
    // fades out of the way and the survivor scales up so the parts read.
    const anatomy = smooth(seg(p, 0.395, 0.435)) * (1 - smooth(seg(p, 0.545, 0.585)));
    if (budB.current) {
      budB.current.visible = anatomy < 0.35;
      budB.current.scale.setScalar(1 - anatomy * 0.9);
    }
    if (budA.current) {
      budA.current.position.x = lerp(-0.2, -0.02, anatomy);
      budA.current.scale.setScalar(lerp(1, 1.55, anatomy));
    }
    // drop the case away so it doesn't crowd the anatomy shot
    if (caseGroup.current) {
      caseGroup.current.position.y = lerp(-0.05, -1.5, anatomy);
      caseGroup.current.scale.setScalar(lerp(1, 0.85, anatomy));
    }
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

      <ambientLight intensity={0.22} />
      <directionalLight
        position={[3, 7, 5]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <directionalLight position={[-5, 3, -4]} intensity={0.85} color="#9fc4ff" />
      <pointLight position={[0, -2, 3]} intensity={6} color="#7dd3fc" distance={9} />

      {/* the case, always present */}
      <group ref={caseGroup}>
        <AirPodsCase progress={progress} position={[0, -0.05, 0]} rotation={[0, 0, 0]} />
      </group>

      {/* the buds — group lifts out */}
      <group ref={buds} position={[0, 0.55, 0]}>
        <group ref={budA}>
        <Float speed={1.1} rotationIntensity={0.22} floatIntensity={0.32}>
          <AirPod
            progress={progress}
            position={[-0.2, 0.0, 0.04]}
            rotation={[0.1, -0.62, 0.12]}
            explode={[0.4, 0.56]}
            finish={0}
          />
        </Float>
        </group>
        <group ref={budB}>
        <Float speed={0.9} rotationIntensity={0.18} floatIntensity={0.28}>
          <AirPod
            progress={progress}
            position={[0.22, 0.05, -0.02]}
            rotation={[0.08, 0.72, -0.1]}
            scale={0.97}
            explode={[0.4, 0.56]}
            finish={0}
          />
        </Float>
        </group>
      </group>

      <SoundRings progress={progress} />

      <ContactShadows
        position={[0, -0.56, 0]}
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
      camera={{ position: [0, 0.5, 4.8], fov: 34, near: 0.1, far: 80 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
      }}
    >
      <Content progress={progress} />
    </Canvas>
  );
}
