import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useIsMobile } from "@/hooks/use-mobile";

const GOLD = "#f6b73c";
const AMBER = "#ff8a1f";
const PALE_GOLD = "#ffe0a0";
const DEEP_AMBER = "#9b3d0b";

type AiCoreProps = {
  reducedMotion: boolean;
};

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function useSpherePoints(count: number, minRadius: number, maxRadius: number, seed: number) {
  return useMemo(() => {
    const random = seededRandom(seed);
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const radius = minRadius + random() * (maxRadius - minRadius);
      const offset = index * 3;
      values[offset] = radius * Math.sin(phi) * Math.cos(theta);
      values[offset + 1] = radius * Math.cos(phi);
      values[offset + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    return values;
  }, [count, maxRadius, minRadius, seed]);
}

function NeuralNetwork({ mobile, reducedMotion }: { mobile: boolean; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const nodeCount = mobile ? 34 : 58;
  const nodes = useSpherePoints(nodeCount, 2.35, 2.75, 4711);
  const linePositions = useMemo(() => {
    const connections: number[] = [];
    const maxDistance = mobile ? 1.55 : 1.28;
    for (let i = 0; i < nodeCount; i += 1) {
      const ax = nodes[i * 3] ?? 0;
      const ay = nodes[i * 3 + 1] ?? 0;
      const az = nodes[i * 3 + 2] ?? 0;
      let linked = 0;
      for (let j = i + 1; j < nodeCount && linked < 3; j += 1) {
        const bx = nodes[j * 3] ?? 0;
        const by = nodes[j * 3 + 1] ?? 0;
        const bz = nodes[j * 3 + 2] ?? 0;
        if (Math.hypot(ax - bx, ay - by, az - bz) < maxDistance) {
          connections.push(ax, ay, az, bx, by, bz);
          linked += 1;
        }
      }
    }
    return new Float32Array(connections);
  }, [mobile, nodeCount, nodes]);

  useFrame((_, rawDelta) => {
    if (!group.current || reducedMotion) return;
    const delta = Math.min(rawDelta, 0.05);
    group.current.rotation.y += delta * 0.045;
    group.current.rotation.x -= delta * 0.018;
  });

  return (
    <group ref={group}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={GOLD} transparent opacity={0.19} depthWrite={false} />
      </lineSegments>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nodes, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={PALE_GOLD}
          size={mobile ? 0.055 : 0.045}
          sizeAttenuation
          transparent
          opacity={0.88}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function ParticleField({ mobile, reducedMotion }: { mobile: boolean; reducedMotion: boolean }) {
  const near = useRef<THREE.Points>(null);
  const far = useRef<THREE.Points>(null);
  const nearPoints = useSpherePoints(mobile ? 420 : 900, 2.8, 5.4, 90210);
  const farPoints = useSpherePoints(mobile ? 260 : 620, 5.2, 8.4, 31803);

  useFrame((_, rawDelta) => {
    if (reducedMotion) return;
    const delta = Math.min(rawDelta, 0.05);
    if (near.current) near.current.rotation.y += delta * 0.025;
    if (far.current) {
      far.current.rotation.y -= delta * 0.009;
      far.current.rotation.z += delta * 0.006;
    }
  });

  return (
    <>
      <points ref={near}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nearPoints, 3]} />
        </bufferGeometry>
        <pointsMaterial color={GOLD} size={0.025} transparent opacity={0.62} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points ref={far}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[farPoints, 3]} />
        </bufferGeometry>
        <pointsMaterial color={AMBER} size={0.018} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </>
  );
}

function CoreAssembly({ mobile, reducedMotion }: { mobile: boolean; reducedMotion: boolean }) {
  const assembly = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const coreMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const pointer = useRef({ x: 0, y: 0, hover: false });
  const { gl } = useThree();

  useEffect(() => {
    const element = gl.domElement;
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      pointer.current.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.current.y = -((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onEnter = () => { pointer.current.hover = true; };
    const onLeave = () => {
      pointer.current.hover = false;
      pointer.current.x = 0;
      pointer.current.y = 0;
    };
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerenter", onEnter);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerenter", onEnter);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, [gl]);

  useFrame(({ clock }, rawDelta) => {
    if (!assembly.current || !core.current || !coreMaterial.current) return;
    const delta = Math.min(rawDelta, 0.05);
    const targetX = reducedMotion ? 0 : pointer.current.y * 0.07;
    const targetY = reducedMotion ? 0 : pointer.current.x * 0.12;
    assembly.current.rotation.x = THREE.MathUtils.damp(assembly.current.rotation.x, targetX, 3.2, delta);
    assembly.current.rotation.y = THREE.MathUtils.damp(assembly.current.rotation.y, targetY, 3.2, delta);
    if (!reducedMotion) assembly.current.rotation.y += delta * 0.025;

    const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 1.15) * 0.035;
    core.current.scale.setScalar(pulse);
    const targetGlow = pointer.current.hover ? 7.5 : 5.4;
    coreMaterial.current.emissiveIntensity = THREE.MathUtils.damp(
      coreMaterial.current.emissiveIntensity,
      targetGlow,
      4,
      delta,
    );
  });

  return (
    <group ref={assembly}>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.78, mobile ? 4 : 6]} />
        <meshStandardMaterial ref={coreMaterial} color={PALE_GOLD} emissive={AMBER} emissiveIntensity={5.4} roughness={0.12} metalness={0.18} />
      </mesh>

      <mesh scale={1.45}>
        <icosahedronGeometry args={[1, mobile ? 2 : 3]} />
        <meshBasicMaterial color={GOLD} wireframe transparent opacity={0.34} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh scale={2.18} rotation={[0.4, 0.2, 0.55]}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial color={AMBER} wireframe transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh scale={1.72}>
        <sphereGeometry args={[1, mobile ? 24 : 40, mobile ? 16 : 28]} />
        <meshPhysicalMaterial color={GOLD} emissive={DEEP_AMBER} emissiveIntensity={0.7} transparent opacity={0.055} roughness={0.05} metalness={0.15} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      <OrbitRing radius={2.42} tube={0.012} rotation={[1.05, 0.1, 0.35]} speed={0.1} reducedMotion={reducedMotion} />
      <OrbitRing radius={2.72} tube={0.009} rotation={[0.25, 0.75, 1.1]} speed={-0.065} reducedMotion={reducedMotion} />
      <OrbitRing radius={3.05} tube={0.008} rotation={[1.35, 0.45, 0.15]} speed={0.045} reducedMotion={reducedMotion} />
      <OrbitRing radius={3.38} tube={0.006} rotation={[0.65, 1.1, 0.7]} speed={-0.032} reducedMotion={reducedMotion} />

      <NeuralNetwork mobile={mobile} reducedMotion={reducedMotion} />
      <ParticleField mobile={mobile} reducedMotion={reducedMotion} />
      <pointLight color={AMBER} intensity={18} distance={13} decay={2} />
    </group>
  );
}

function OrbitRing({ radius, tube, rotation, speed, reducedMotion }: {
  radius: number;
  tube: number;
  rotation: [number, number, number];
  speed: number;
  reducedMotion: boolean;
}) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((_, rawDelta) => {
    if (!ring.current || reducedMotion) return;
    ring.current.rotation.z += Math.min(rawDelta, 0.05) * speed;
  });
  return (
    <mesh ref={ring} rotation={rotation}>
      <torusGeometry args={[radius, tube, 8, 128]} />
      <meshBasicMaterial color={GOLD} transparent opacity={0.72} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

export function AiCore({ reducedMotion }: AiCoreProps) {
  const mobile = useIsMobile();
  return (
    <Canvas
      dpr={mobile ? 1 : [1, 1.5]}
      camera={{ position: [0, 0, mobile ? 10.5 : 9], fov: mobile ? 52 : 46 }}
      gl={{ antialias: !mobile, alpha: true, powerPreference: "high-performance" }}
      frameloop={reducedMotion ? "demand" : "always"}
    >
      <color attach="background" args={["#090d14"]} />
      <ambientLight intensity={0.35} color={PALE_GOLD} />
      <CoreAssembly mobile={mobile} reducedMotion={reducedMotion} />
      <Environment resolution={64}>
        <Lightformer intensity={2.5} color={GOLD} position={[0, 3, 4]} scale={[5, 5, 1]} />
        <Lightformer intensity={1.2} color={AMBER} position={[-4, -1, 2]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
      </Environment>
      <EffectComposer multisampling={mobile ? 0 : 4}>
        <Bloom intensity={mobile ? 0.9 : 1.25} luminanceThreshold={0.18} luminanceSmoothing={0.45} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}

export function useAiCoreSupport() {
  const [state, setState] = useState<{ ready: boolean; supported: boolean; reducedMotion: boolean }>({
    ready: false,
    supported: true,
    reducedMotion: false,
  });

  const detect = useCallback(() => {
    const canvas = document.createElement("canvas");
    const supported = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setState({ ready: true, supported, reducedMotion });
  }, []);

  useEffect(() => {
    detect();
  }, [detect]);

  return state;
}