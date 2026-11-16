"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { MotionValue } from "motion/react";

/* ------------------------------------------------------------------ */
/*  AirPod Pro — modelled in local space:                              */
/*    +X = into the ear (nozzle + tip)                                 */
/*    -Y = down the stem                                               */
/*  Head radius 0.22 so two buds roughly fill a 1.05-wide case.        */
/* ------------------------------------------------------------------ */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const win = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export type Finish = { body: string; metal: string; roughness: number };

export const FINISHES: Finish[] = [
  { body: "#f2f2f0", metal: "#cfd0d2", roughness: 0.26 },
  { body: "#1b1b20", metal: "#2a2a30", roughness: 0.3 },
  { body: "#8d8e93", metal: "#6c6d72", roughness: 0.34 },
  { body: "#d8c8b2", metal: "#b39a7c", roughness: 0.3 },
];

export function AirPod({
  progress,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  explode = [0.4, 0.56],
  finish = 0,
}: {
  progress: MotionValue<number>;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  explode?: [number, number];
  finish?: number;
}) {
  const root = useRef<THREE.Group>(null);

  // separable parts
  const tipRef = useRef<THREE.Group>(null);
  const nozzleRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const chipRef = useRef<THREE.Group>(null);
  const stemRef = useRef<THREE.Group>(null);
  const batteryRef = useRef<THREE.Group>(null);

  const materials = useMemo(() => {
    const shell = new THREE.MeshPhysicalMaterial({
      color: "#f2f2f0",
      roughness: 0.26,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.07,
      envMapIntensity: 1.2,
    });
    const tip = new THREE.MeshStandardMaterial({
      color: "#d9dadd",
      roughness: 0.78,
      metalness: 0,
    });
    const mesh = new THREE.MeshStandardMaterial({
      color: "#55565c",
      roughness: 0.85,
      metalness: 0.3,
    });
    const chrome = new THREE.MeshStandardMaterial({
      color: "#b9bcc2",
      roughness: 0.18,
      metalness: 1,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: "#1d1d21",
      roughness: 0.6,
      metalness: 0.2,
    });
    return { shell, tip, mesh, chrome, dark };
  }, []);

  useFrame(({ clock }) => {
    const p = progress.get();
    const t = clock.getElapsedTime();

    // explode out, then snap back together
    const out = ease(win(p, explode[0], explode[0] + (explode[1] - explode[0]) * 0.6));
    const back = ease(win(p, explode[1] - 0.03, explode[1]));
    const s = out * (1 - back);

    if (nozzleRef.current) nozzleRef.current.position.x = lerp(0.15, 0.62, s);
    if (tipRef.current) {
      tipRef.current.position.x = lerp(0.28, 1.18, s);
      tipRef.current.rotation.z = lerp(0, 0.55, s);
    }
    if (headRef.current) headRef.current.position.x = lerp(0, -0.3, s);
    if (chipRef.current) {
      chipRef.current.position.y = lerp(-0.02, 0.42, s);
      chipRef.current.position.x = lerp(0, 0.2, s);
      chipRef.current.rotation.z = lerp(0, -0.7, s);
    }
    if (stemRef.current) {
      stemRef.current.position.y = lerp(-0.46, -1.02, s);
      stemRef.current.position.z = lerp(0, 0.1, s);
    }
    if (batteryRef.current) {
      batteryRef.current.position.y = lerp(-0.46, -0.56, s);
      batteryRef.current.position.z = lerp(0, -0.46, s);
    }

    // gentle life
    if (root.current) {
      const calm = 1 - s * 0.7;
      root.current.rotation.y =
        rotation[1] * (1 - s) +
        -0.28 * s +
        Math.sin(t * 0.34) * 0.11 * calm;
      root.current.position.y =
        position[1] + Math.sin(t * 0.6) * 0.026 * calm;
    }

    // finish crossfade
    const f = FINISHES[Math.max(0, Math.min(FINISHES.length - 1, Math.round(finish)))];
    materials.shell.color.lerp(new THREE.Color(f.body), 0.08);
    materials.chrome.color.lerp(new THREE.Color(f.metal), 0.08);
    materials.shell.roughness = lerp(materials.shell.roughness, f.roughness, 0.08);
  });

  return (
    <group ref={root} position={position} rotation={rotation} scale={scale}>
      {/* ---------------- acoustic head ---------------- */}
      <group ref={headRef}>
        <mesh scale={[1, 0.94, 0.9]} castShadow>
          <sphereGeometry args={[0.195, 64, 64]} />
          <primitive object={materials.shell} attach="material" />
        </mesh>

        {/* mic vent */}
        <mesh position={[-0.13, 0.06, 0.16]} rotation={[0.35, -0.4, 0]}>
          <capsuleGeometry args={[0.018, 0.05, 4, 10]} />
          <primitive object={materials.dark} attach="material" />
        </mesh>

        {/* in-ear sensor */}
        <mesh position={[-0.05, -0.09, 0.18]}>
          <circleGeometry args={[0.024, 20]} />
          <primitive object={materials.dark} attach="material" />
        </mesh>

        {/* speaker mesh where nozzle meets head */}
        <mesh position={[0.19, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <circleGeometry args={[0.105, 40]} />
          <primitive object={materials.mesh} attach="material" />
        </mesh>
      </group>

      {/* ---------------- nozzle ---------------- */}
      <group ref={nozzleRef} position={[0.16, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.098, 0.115, 0.14, 48]} />
          <primitive object={materials.shell} attach="material" />
        </mesh>
      </group>

      {/* ---------------- silicone tip ---------------- */}
      <group ref={tipRef} position={[0.3, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <latheGeometry
            args={[
              [
                new THREE.Vector2(0.0, 0),
                new THREE.Vector2(0.07, 0),
                new THREE.Vector2(0.115, 0.02),
                new THREE.Vector2(0.135, 0.055),
                new THREE.Vector2(0.132, 0.09),
                new THREE.Vector2(0.112, 0.115),
                new THREE.Vector2(0.085, 0.13),
                new THREE.Vector2(0.072, 0.132),
              ],
              48,
            ]}
          />
          <primitive object={materials.tip} attach="material" />
        </mesh>
        {/* ear canal opening */}
        <mesh position={[0.134, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <circleGeometry args={[0.055, 32]} />
          <primitive object={materials.dark} attach="material" />
        </mesh>
      </group>

      {/* ---------------- H3 chip ---------------- */}
      <group ref={chipRef} position={[0, -0.02, 0]}>
        <RoundedBox args={[0.13, 0.13, 0.018]} radius={0.006} smoothness={3}>
          <meshStandardMaterial color="#1b2a20" roughness={0.55} metalness={0.5} />
        </RoundedBox>
        <RoundedBox
          args={[0.062, 0.062, 0.012]}
          radius={0.003}
          smoothness={2}
          position={[0, 0, 0.016]}
        >
          <meshStandardMaterial color="#2c2c31" roughness={0.3} metalness={0.9} />
        </RoundedBox>
        <RoundedBox
          args={[0.1, 0.1, 0.008]}
          radius={0.002}
          smoothness={2}
          position={[0, 0, -0.014]}
        >
          <meshStandardMaterial color="#b08432" roughness={0.35} metalness={0.95} />
        </RoundedBox>
      </group>

      {/* ---------------- stem ---------------- */}
      <group ref={stemRef} position={[0, -0.42, 0]}>
        <RoundedBox
          args={[0.105, 0.46, 0.094]}
          radius={0.048}
          smoothness={5}
          castShadow
        >
          <primitive object={materials.shell} attach="material" />
        </RoundedBox>

        {/* force sensor touch pad */}
        <mesh position={[0.057, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.022, 0.07, 4, 12]} />
          <meshStandardMaterial color="#dcdde0" roughness={0.5} />
        </mesh>

        {/* bottom antenna / mic cap */}
        <mesh position={[0, -0.212, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.03, 24]} />
          <primitive object={materials.chrome} attach="material" />
        </mesh>
        <mesh position={[0, -0.19, 0.042]}>
          <circleGeometry args={[0.014, 20]} />
          <primitive object={materials.dark} attach="material" />
        </mesh>
      </group>

      {/* ---------------- battery ---------------- */}
      <group ref={batteryRef} position={[0, -0.42, 0]}>
        <mesh>
          <cylinderGeometry args={[0.042, 0.042, 0.19, 28]} />
          <meshStandardMaterial color="#9ba1a8" metalness={0.95} roughness={0.22} />
        </mesh>
      </group>
    </group>
  );
}
