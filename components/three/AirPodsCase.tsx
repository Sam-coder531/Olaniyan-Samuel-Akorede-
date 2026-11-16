"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { MotionValue } from "motion/react";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const win = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function AirPodsCase({
  progress,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: {
  progress: MotionValue<number>;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);

  const shell = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#f6f6f4",
        roughness: 0.22,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.25,
      }),
    []
  );

  const interior = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e6e6e4",
        roughness: 0.55,
      }),
    []
  );

  useFrame(({ clock }) => {
    const p = progress.get();
    const t = clock.getElapsedTime();

    // lid opens as the film starts, closes for the finale
    const open = ease(win(p, 0.0, 0.09)) * (1 - ease(win(p, 0.9, 1.0)));
    if (lid.current) {
      lid.current.rotation.x = -open * 1.15;
      lid.current.position.y = 0.33 + open * 0.01;
    }

    if (group.current) {
      group.current.rotation.y =
        rotation[1] + Math.sin(t * 0.3) * 0.06 + (1 - open) * 0.35;
      group.current.position.y = position[1] + Math.sin(t * 0.45) * 0.03;
    }
  });

  return (
    <group ref={group} position={position} rotation={rotation}>
      {/* lower shell */}
      <RoundedBox
        args={[1.12, 0.66, 0.42]}
        radius={0.19}
        smoothness={6}
        position={[0, 0, 0]}
        castShadow
      >
        <primitive object={shell} attach="material" />
      </RoundedBox>

      {/* hollow well for the buds */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.94, 0.34, 0.3]} />
        <primitive object={interior} attach="material" />
      </mesh>
      <mesh position={[-0.24, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.16, 32]} />
        <meshStandardMaterial color="#cfcfcd" roughness={0.7} />
      </mesh>
      <mesh position={[0.24, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.16, 32]} />
        <meshStandardMaterial color="#cfcfcd" roughness={0.7} />
      </mesh>

      {/* hinge seam */}
      <mesh position={[0, 0.335, 0]}>
        <boxGeometry args={[1.1, 0.012, 0.4]} />
        <meshStandardMaterial color="#d8d8d6" roughness={0.6} />
      </mesh>

      {/* status LED */}
      <mesh position={[0, 0.04, 0.215]}>
        <circleGeometry args={[0.016, 20]} />
        <meshStandardMaterial
          color="#57d97a"
          emissive="#57d97a"
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>

      {/* lid */}
      <group ref={lid} position={[0, 0.33, -0.205]}>
        <RoundedBox
          args={[1.12, 0.28, 0.42]}
          radius={0.13}
          smoothness={6}
          position={[0, 0.13, 0.205]}
          castShadow
        >
          <primitive object={shell} attach="material" />
        </RoundedBox>
        {/* inner lid cushion */}
        <mesh position={[0, 0.03, 0.205]}>
          <boxGeometry args={[0.9, 0.02, 0.3]} />
          <primitive object={interior} attach="material" />
        </mesh>
      </group>
    </group>
  );
}
