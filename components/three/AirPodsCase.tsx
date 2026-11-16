"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { MotionValue } from "motion/react";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const win = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* Case is 1.05 wide × 0.92 tall × 0.4 deep.
   Hinge sits on the BACK top edge so the lid rotates up and over. */

export function AirPodsCase({
  progress,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  finish = 0,
}: {
  progress: MotionValue<number>;
  position?: [number, number, number];
  rotation?: [number, number, number];
  finish?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);

  const mats = useMemo(() => {
    const shell = new THREE.MeshPhysicalMaterial({
      color: "#f4f4f2",
      roughness: 0.24,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.25,
    });
    const inner = new THREE.MeshStandardMaterial({
      color: "#e9e9e7",
      roughness: 0.62,
    });
    const well = new THREE.MeshStandardMaterial({
      color: "#c9cacb",
      roughness: 0.75,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: "#2a2a2e",
      roughness: 0.7,
    });
    return { shell, inner, well, dark };
  }, []);

  useFrame(({ clock }) => {
    const p = progress.get();
    const t = clock.getElapsedTime();

    // opens on the opening beat, closes again for the finale
    const open = ease(win(p, 0.0, 0.07)) * (1 - ease(win(p, 0.9, 0.99)));

    if (lid.current) {
      lid.current.rotation.x = -open * 1.35;
    }

    const f = finish;
    const body =
      f < 0.5 ? "#f4f4f2" : f < 1.5 ? "#191920" : f < 2.5 ? "#8b8c91" : "#d5c4ad";
    mats.shell.color.lerp(new THREE.Color(body), 0.08);

    if (group.current) {
      group.current.rotation.y = rotation[1] + Math.sin(t * 0.28) * 0.05;
      group.current.position.y = position[1] + Math.sin(t * 0.5) * 0.018;
    }
  });

  return (
    <group ref={group} position={position} rotation={rotation}>
      {/* -------- bottom shell -------- */}
      <RoundedBox
        args={[1.05, 0.74, 0.4]}
        radius={0.17}
        smoothness={6}
        position={[0, -0.08, 0]}
        castShadow
        receiveShadow
      >
        <primitive object={mats.shell} attach="material" />
      </RoundedBox>

      {/* cavity where the buds sit */}
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[0.88, 0.3, 0.26]} />
        <primitive object={mats.inner} attach="material" />
      </mesh>
      {[-0.215, 0.215].map((x) => (
        <group key={x} position={[x, 0.16, 0]}>
          <mesh>
            <cylinderGeometry args={[0.115, 0.105, 0.28, 32, 1, true]} />
            <primitive object={mats.well} attach="material" />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.13, 0]}>
            <circleGeometry args={[0.105, 32]} />
            <primitive object={mats.well} attach="material" />
          </mesh>
          {/* charging pin */}
          <mesh position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.02, 12]} />
            <meshStandardMaterial color="#b08d4a" metalness={1} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* hinge barrel, sits on the back edge */}
      <mesh position={[0, 0.29, -0.18]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.014, 0.014, 0.96, 20]} />
        <meshStandardMaterial color="#d2d3d5" metalness={0.85} roughness={0.32} />
      </mesh>

      {/* status LED */}
      <mesh position={[0, -0.02, 0.2]}>
        <circleGeometry args={[0.012, 18]} />
        <meshStandardMaterial
          color="#4ade80"
          emissive="#4ade80"
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>

      {/* -------- lid (hinged at back-top edge) -------- */}
      <group ref={lid} position={[0, 0.29, -0.18]}>
        <RoundedBox
          args={[1.05, 0.3, 0.4]}
          radius={0.135}
          smoothness={6}
          position={[0, 0.15, 0.18]}
          castShadow
        >
          <primitive object={mats.shell} attach="material" />
        </RoundedBox>
        {/* inner lid lining */}
        <mesh position={[0, 0.03, 0.18]}>
          <boxGeometry args={[0.86, 0.015, 0.26]} />
          <primitive object={mats.inner} attach="material" />
        </mesh>
        {/* tiny seam shadow under the lid */}
        <mesh position={[0, 0.005, 0.18]}>
          <boxGeometry args={[1.02, 0.004, 0.38]} />
          <primitive object={mats.dark} attach="material" />
        </mesh>
      </group>
    </group>
  );
}
