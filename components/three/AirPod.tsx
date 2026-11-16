"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { MotionValue } from "motion/react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** progress → 0..1 window */
const win = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export const BUD_FINISHES = [
  { name: "Pearl", color: "#f4f4f2", stem: "#ececeb", tip: "#c9cbcd" },
  { name: "Midnight", color: "#1a1a1f", stem: "#15151a", tip: "#2b2b31" },
  { name: "Titanium", color: "#8f9095", stem: "#84858a", tip: "#5f6065" },
  { name: "Sand", color: "#d9c9b4", stem: "#cbbb a7".replace(" ", ""), tip: "#b09a80" },
];

/* ------------------------------------------------------------------ */
/*  One AirPod — every part is its own group so it can explode         */
/* ------------------------------------------------------------------ */

type BudProps = {
  progress: MotionValue<number>;
  side?: "L" | "R";
  /** world position of the whole bud */
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  /** separate window for the explode animation (0..1 page progress) */
  explode?: [number, number];
  /** which finish is showing (0..3), driven by page progress */
  finishIndex?: MotionValue<number>;
  showLabels?: boolean;
};

export function AirPod({
  progress,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  explode = [0.38, 0.55],
  showLabels = false,
}: BudProps) {
  const root = useRef<THREE.Group>(null);

  // individual part refs
  const tip = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Group>(null);
  const chamber = useRef<THREE.Group>(null);
  const chip = useRef<THREE.Group>(null);
  const battery = useRef<THREE.Group>(null);
  const flex = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Group>(null);

  const bodyMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const stemMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const tipMat = useRef<THREE.MeshStandardMaterial>(null);

  // finish colours we lerp between
  const colors = useMemo(
    () => ({
      body: new THREE.Color("#f4f4f2"),
      stem: new THREE.Color("#ececeb"),
      tip: new THREE.Color("#c9cbcd"),
      targetBody: new THREE.Color("#f4f4f2"),
      targetStem: new THREE.Color("#ececeb"),
      targetTip: new THREE.Color("#c9cbcd"),
    }),
    []
  );

  useFrame(({ clock }) => {
    const p = progress.get();
    const t = clock.getElapsedTime();

    /* ---------------- explode ---------------- */
    const e = ease(win(p, explode[0], explode[0] + (explode[1] - explode[0]) * 0.62));
    const reassemble = ease(win(p, explode[1] - 0.035, explode[1]));
    const spread = e * (1 - reassemble);

    if (tip.current) {
      tip.current.position.x = lerp(0.63, 1.62, spread);
      tip.current.rotation.z = lerp(0, 0.45, spread);
    }
    if (mesh.current) mesh.current.position.x = lerp(0.46, 1.14, spread);
    if (chamber.current) chamber.current.position.x = lerp(0.3, 0.72, spread);
    if (chip.current) {
      chip.current.position.x = lerp(0.05, 0.3, spread);
      chip.current.position.y = lerp(-0.02, 0.16, spread);
      chip.current.rotation.z = lerp(0, -0.5, spread);
    }
    if (battery.current) {
      battery.current.position.y = lerp(-0.62, -0.98, spread);
      battery.current.position.z = lerp(0, 0.22, spread);
    }
    if (flex.current) {
      flex.current.position.y = lerp(-0.42, -0.2, spread);
      flex.current.position.z = lerp(0, -0.34, spread);
      flex.current.rotation.x = lerp(0, 0.7, spread);
    }
    if (shell.current) {
      shell.current.position.z = lerp(0, -0.9, spread);
      shell.current.rotation.x = lerp(0, -0.35, spread);
    }

    /* ---------------- idle float + rotate ---------------- */
    if (root.current) {
      const idle = 1 - spread * 0.65;
      root.current.position.y = position[1] + Math.sin(t * 0.55) * 0.045 * idle;
      root.current.rotation.y =
        rotation[1] + Math.sin(t * 0.32) * 0.1 * idle + spread * 0.25;
      root.current.rotation.z = rotation[2] + Math.sin(t * 0.41) * 0.02 * idle;
    }

    /* ---------------- finish morph ---------------- */
    const fi = clamp01(progress.get() * 0);
    void fi;
    if (bodyMat.current || stemMat.current) {
      colors.body.lerp(colors.targetBody, 0.06);
      colors.stem.lerp(colors.targetStem, 0.06);
      colors.tip.lerp(colors.targetTip, 0.06);
      if (bodyMat.current) bodyMat.current.color.copy(colors.body);
      if (stemMat.current) stemMat.current.color.copy(colors.stem);
      if (tipMat.current) tipMat.current.color.copy(colors.tip);
    }
  });

  const shellM = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#f4f4f2",
        roughness: 0.28,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.15,
      }),
    []
  );

  return (
    <group ref={root} position={position} rotation={rotation} scale={scale}>
      {/* ============ main acoustic housing ============ */}
      <group ref={chamber}>
        <mesh castShadow>
          <sphereGeometry args={[0.5, 96, 96]} />
          <primitive object={shellM} ref={bodyMat} attach="material" />
        </mesh>
        {/* seam line where the shell joins */}
        <mesh position={[0.16, 0.12, 0]} rotation={[0, 0, 0.5]}>
          <torusGeometry args={[0.36, 0.004, 8, 72, Math.PI * 1.1]} />
          <meshStandardMaterial color="#d3d3d5" roughness={0.6} />
        </mesh>
        {/* mic vent on the body */}
        <mesh position={[-0.34, 0.16, 0.33]} rotation={[0.3, -0.5, 0]}>
          <capsuleGeometry args={[0.035, 0.075, 6, 14]} />
          <meshStandardMaterial color="#3a3a3e" roughness={0.85} />
        </mesh>
        {/* infrared sensor */}
        <mesh position={[-0.1, -0.18, 0.42]}>
          <circleGeometry args={[0.045, 24]} />
          <meshStandardMaterial color="#16161a" roughness={0.35} metalness={0.4} />
        </mesh>
      </group>

      {/* ============ speaker mesh dome ============ */}
      <group ref={mesh} position={[0.46, 0, 0]}>
        <mesh rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.235, 0.255, 0.1, 64]} />
          <meshPhysicalMaterial
            color="#e8e8ea"
            roughness={0.45}
            clearcoat={0.6}
          />
        </mesh>
        <mesh position={[0.056, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <circleGeometry args={[0.2, 48]} />
          <meshStandardMaterial
            color="#4a4a50"
            roughness={0.95}
            metalness={0.25}
          />
        </mesh>
      </group>

      {/* ============ silicone ear tip ============ */}
      <group ref={tip} position={[0.63, 0, 0]}>
        <mesh rotation={[0, 0, -Math.PI / 2]}>
          <latheGeometry
            args={[
              [
                new THREE.Vector2(0.15, 0),
                new THREE.Vector2(0.26, 0.03),
                new THREE.Vector2(0.3, 0.1),
                new THREE.Vector2(0.29, 0.19),
                new THREE.Vector2(0.24, 0.26),
                new THREE.Vector2(0.19, 0.3),
                new THREE.Vector2(0.17, 0.31),
              ],
              48,
            ]}
          />
          <meshStandardMaterial ref={tipMat} color="#c9cbcd" roughness={0.72} />
        </mesh>
        {/* opening */}
        <mesh position={[0.31, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <circleGeometry args={[0.13, 40]} />
          <meshStandardMaterial color="#2a2a2e" roughness={1} />
        </mesh>
      </group>

      {/* ============ H3 chip ============ */}
      <group ref={chip} position={[0.05, -0.02, 0]}>
        <RoundedBox args={[0.16, 0.16, 0.025]} radius={0.008} smoothness={3}>
          <meshStandardMaterial color="#1c2a1f" roughness={0.5} metalness={0.5} />
        </RoundedBox>
        <RoundedBox
          args={[0.075, 0.075, 0.014]}
          radius={0.004}
          smoothness={2}
          position={[0, 0, 0.02]}
        >
          <meshStandardMaterial
            color="#2b2b30"
            roughness={0.35}
            metalness={0.85}
          />
        </RoundedBox>
      </group>

      {/* ============ stem ============ */}
      <group ref={shell} position={[0, -0.62, 0]}>
        <RoundedBox
          args={[0.175, 0.68, 0.15]}
          radius={0.072}
          smoothness={5}
          castShadow
        >
          <primitive object={shellM} ref={stemMat} attach="material" />
        </RoundedBox>
        {/* force sensor indent */}
        <mesh position={[0.089, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.03, 0.1, 6, 16]} />
          <meshStandardMaterial color="#dedee0" roughness={0.55} />
        </mesh>
        {/* bottom mic */}
        <mesh position={[0, -0.335, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.045, 24]} />
          <meshStandardMaterial color="#232327" roughness={0.8} />
        </mesh>
        {/* charging contacts */}
        <mesh position={[0, -0.3, 0.062]}>
          <circleGeometry args={[0.022, 20]} />
          <meshStandardMaterial color="#b08d4a" metalness={1} roughness={0.25} />
        </mesh>
      </group>

      {/* ============ battery ============ */}
      <group ref={battery} position={[0, -0.62, 0]}>
        <mesh>
          <cylinderGeometry args={[0.062, 0.062, 0.24, 32]} />
          <meshStandardMaterial
            color="#9aa0a6"
            metalness={0.95}
            roughness={0.25}
          />
        </mesh>
      </group>

      {/* ============ flex cable ============ */}
      <group ref={flex} position={[0, -0.42, 0]}>
        <mesh rotation={[0, 0, 0.1]}>
          <boxGeometry args={[0.028, 0.42, 0.006]} />
          <meshStandardMaterial color="#c9761f" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.21, 0]}>
          <boxGeometry args={[0.05, 0.05, 0.008]} />
          <meshStandardMaterial color="#d8b24a" metalness={0.8} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}
