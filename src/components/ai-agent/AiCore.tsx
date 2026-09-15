import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useIsMobile } from "@/hooks/use-mobile";

const GOLD = "#f6b73c";
const AMBER = "#ff8a1f";
const PALE_GOLD = "#ffe0a0";
const WHITE_HOT = "#fff6e2";
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

/** Points that sit on a thin equatorial disc — reads as an accretion haze. */
function useDiscPoints(count: number, minRadius: number, maxRadius: number, seed: number) {
  return useMemo(() => {
    const random = seededRandom(seed);
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const theta = random() * Math.PI * 2;
      const radius = minRadius + Math.sqrt(random()) * (maxRadius - minRadius);
      const offset = index * 3;
      values[offset] = radius * Math.cos(theta);
      values[offset + 1] = (random() - 0.5) * 0.55;
      values[offset + 2] = radius * Math.sin(theta);
    }
    return values;
  }, [count, maxRadius, minRadius, seed]);
}

function NeuralNetwork({ mobile, reducedMotion }: { mobile: boolean; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const nodeCount = mobile ? 40 : 72;
  const nodes = useSpherePoints(nodeCount, 2.3, 2.78, 4711);
  const linePositions = useMemo(() => {
    const connections: number[] = [];
    const maxDistance = mobile ? 1.5 : 1.24;
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

  const material = useRef<THREE.PointsMaterial>(null);

  useFrame(({ clock }, rawDelta) => {
    if (!group.current || reducedMotion) return;
    const delta = Math.min(rawDelta, 0.05);
    group.current.rotation.y += delta * 0.045;
    group.current.rotation.x -= delta * 0.018;
    // Synapse-like twinkle across the node layer.
    if (material.current) {
      material.current.opacity = 0.72 + Math.sin(clock.elapsedTime * 1.7) * 0.16;
    }
  });

  return (
    <group ref={group}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={GOLD} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nodes, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={material}
          color={PALE_GOLD}
          size={mobile ? 0.055 : 0.046}
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
  const disc = useRef<THREE.Points>(null);
  const nearPoints = useSpherePoints(mobile ? 460 : 1100, 2.8, 5.4, 90210);
  const farPoints = useSpherePoints(mobile ? 280 : 760, 5.2, 9.2, 31803);
  const discPoints = useDiscPoints(mobile ? 220 : 620, 2.6, 6.2, 55117);

  useFrame(({ clock }, rawDelta) => {
    if (reducedMotion) return;
    const delta = Math.min(rawDelta, 0.05);
    if (near.current) {
      near.current.rotation.y += delta * 0.025;
      near.current.position.y = Math.sin(clock.elapsedTime * 0.28) * 0.09;
    }
    if (far.current) {
      far.current.rotation.y -= delta * 0.009;
      far.current.rotation.z += delta * 0.006;
    }
    if (disc.current) {
      disc.current.rotation.y += delta * 0.075;
    }
  });

  return (
    <>
      <points ref={near}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nearPoints, 3]} />
        </bufferGeometry>
        <pointsMaterial color={GOLD} size={0.026} transparent opacity={0.62} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points ref={far}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[farPoints, 3]} />
        </bufferGeometry>
        <pointsMaterial color={AMBER} size={0.018} transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points ref={disc} rotation={[0.22, 0, 0.12]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[discPoints, 3]} />
        </bufferGeometry>
        <pointsMaterial color={PALE_GOLD} size={0.022} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </>
  );
}

/** A thin partial torus — the sweeping holographic arcs of the reference look. */
function OrbitArc({
  radius,
  tube,
  arc,
  rotation,
  speed,
  opacity,
  color,
  reducedMotion,
}: {
  radius: number;
  tube: number;
  arc: number;
  rotation: [number, number, number];
  speed: number;
  opacity: number;
  color: string;
  reducedMotion: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((_, rawDelta) => {
    if (!mesh.current || reducedMotion) return;
    mesh.current.rotation.z += Math.min(rawDelta, 0.05) * speed;
  });
  return (
    <mesh ref={mesh} rotation={rotation}>
      <torusGeometry args={[radius, tube, 6, 96, arc]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

/** Electromagnetic pulse: a ring that rises through the core and fades out. */
function EnergyPulse({ reducedMotion }: { reducedMotion: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!mesh.current || !material.current) return;
    if (reducedMotion) {
      material.current.opacity = 0.1;
      return;
    }
    const cycle = (clock.elapsedTime % 6) / 6;
    const y = -2.6 + cycle * 5.2;
    mesh.current.position.y = y;
    const spread = Math.cos((y / 2.9) * (Math.PI / 2));
    const scale = Math.max(0.05, spread) * 2.5;
    mesh.current.scale.set(scale, scale, scale);
    material.current.opacity = Math.max(0, Math.sin(cycle * Math.PI)) * 0.32;
  });

  return (
    <mesh ref={mesh} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1, 0.006, 6, 96]} />
      <meshBasicMaterial ref={material} color={PALE_GOLD} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function CoreAssembly({ mobile, reducedMotion }: { mobile: boolean; reducedMotion: boolean }) {
  const assembly = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const innerShell = useRef<THREE.Mesh>(null);
  const glassGlobe = useRef<THREE.Mesh>(null);
  const coreMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const haloMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
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
    const targetX = reducedMotion ? 0 : pointer.current.y * 0.08;
    const targetY = reducedMotion ? 0 : pointer.current.x * 0.14;
    assembly.current.rotation.x = THREE.MathUtils.damp(assembly.current.rotation.x, targetX, 3.2, delta);
    assembly.current.rotation.y = THREE.MathUtils.damp(assembly.current.rotation.y, targetY, 3.2, delta);
    if (!reducedMotion) assembly.current.rotation.y += delta * 0.025;

    const breath = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 1.15) * 0.035;
    core.current.scale.setScalar(breath);
    if (innerShell.current && !reducedMotion) {
      innerShell.current.rotation.y -= delta * 0.22;
      innerShell.current.rotation.x += delta * 0.09;
    }
    if (glassGlobe.current && !reducedMotion) {
      glassGlobe.current.rotation.y += delta * 0.055;
    }

    const hovered = pointer.current.hover;
    coreMaterial.current.emissiveIntensity = THREE.MathUtils.damp(
      coreMaterial.current.emissiveIntensity,
      hovered ? 8.4 : 5.6,
      4,
      delta,
    );
    if (haloMaterial.current) {
      const flicker = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2.3) * 0.012;
      haloMaterial.current.opacity = THREE.MathUtils.damp(
        haloMaterial.current.opacity,
        (hovered ? 0.075 : 0.045) + flicker,
        3,
        delta,
      );
    }
    if (light.current) {
      light.current.intensity = THREE.MathUtils.damp(light.current.intensity, hovered ? 26 : 18, 4, delta);
    }
  });

  return (
    <group ref={assembly}>
      {/* Bright intelligent core */}
      <mesh ref={core}>
        <icosahedronGeometry args={[0.74, mobile ? 4 : 6]} />
        <meshStandardMaterial
          ref={coreMaterial}
          color={WHITE_HOT}
          emissive={AMBER}
          emissiveIntensity={5.6}
          roughness={0.12}
          metalness={0.18}
        />
      </mesh>

      {/* Counter-rotating faceted cage around the core */}
      <mesh ref={innerShell} scale={1.12}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={WHITE_HOT} wireframe transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh scale={1.48}>
        <icosahedronGeometry args={[1, mobile ? 2 : 3]} />
        <meshBasicMaterial color={GOLD} wireframe transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh scale={2.18} rotation={[0.4, 0.2, 0.55]}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial color={AMBER} wireframe transparent opacity={0.09} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Latitude/longitude glass globe */}
      <mesh ref={glassGlobe} scale={1.95}>
        <sphereGeometry args={[1, mobile ? 20 : 30, mobile ? 12 : 18]} />
        <meshBasicMaterial color={GOLD} wireframe transparent opacity={0.075} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Glass energy shell + soft outer halo */}
      <mesh scale={1.72}>
        <sphereGeometry args={[1, mobile ? 24 : 40, mobile ? 16 : 28]} />
        <meshPhysicalMaterial
          color={GOLD}
          emissive={DEEP_AMBER}
          emissiveIntensity={0.7}
          transparent
          opacity={0.055}
          roughness={0.05}
          metalness={0.15}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh scale={2.35}>
        <sphereGeometry args={[1, 32, 22]} />
        <meshBasicMaterial
          ref={haloMaterial}
          color={AMBER}
          transparent
          opacity={0.05}
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <OrbitRing radius={2.42} tube={0.012} rotation={[1.05, 0.1, 0.35]} speed={0.1} reducedMotion={reducedMotion} />
      <OrbitRing radius={2.72} tube={0.009} rotation={[0.25, 0.75, 1.1]} speed={-0.065} reducedMotion={reducedMotion} />
      <OrbitRing radius={3.05} tube={0.008} rotation={[1.35, 0.45, 0.15]} speed={0.045} reducedMotion={reducedMotion} />
      <OrbitRing radius={3.38} tube={0.006} rotation={[0.65, 1.1, 0.7]} speed={-0.032} reducedMotion={reducedMotion} />

      {/* Sweeping orbital arcs */}
      <OrbitArc radius={3.62} tube={0.011} arc={Math.PI * 0.62} rotation={[1.15, 0.3, 0.2]} speed={0.085} opacity={0.62} color={PALE_GOLD} reducedMotion={reducedMotion} />
      <OrbitArc radius={4.05} tube={0.009} arc={Math.PI * 0.4} rotation={[0.5, 0.95, 0.9]} speed={-0.055} opacity={0.45} color={GOLD} reducedMotion={reducedMotion} />
      {!mobile ? (
        <>
          <OrbitArc radius={4.48} tube={0.007} arc={Math.PI * 0.85} rotation={[1.45, 0.2, 0.6]} speed={0.038} opacity={0.3} color={AMBER} reducedMotion={reducedMotion} />
          <OrbitArc radius={4.95} tube={0.006} arc={Math.PI * 0.3} rotation={[0.9, 1.3, 0.25]} speed={-0.026} opacity={0.26} color={GOLD} reducedMotion={reducedMotion} />
        </>
      ) : null}

      <EnergyPulse reducedMotion={reducedMotion} />
      <NeuralNetwork mobile={mobile} reducedMotion={reducedMotion} />
      <ParticleField mobile={mobile} reducedMotion={reducedMotion} />

      <pointLight ref={light} color={AMBER} intensity={18} distance={14} decay={2} />
      <pointLight color={PALE_GOLD} intensity={6} distance={10} decay={2} position={[2.4, 1.8, 2.2]} />
      <pointLight color={DEEP_AMBER} intensity={9} distance={16} decay={2} position={[-3.2, -2.2, -3.4]} />
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
      camera={{ position: [0, 0.3, mobile ? 10.5 : 9], fov: mobile ? 52 : 46 }}
      gl={{ antialias: !mobile, alpha: true, powerPreference: "high-performance" }}
      frameloop={reducedMotion ? "demand" : "always"}
    >
      {/* No background colour: the canvas stays transparent so the page gradient shows through. */}
      <ambientLight intensity={0.3} color={PALE_GOLD} />
      <CoreAssembly mobile={mobile} reducedMotion={reducedMotion} />
      <Environment resolution={64}>
        <Lightformer intensity={2.5} color={GOLD} position={[0, 3, 4]} scale={[5, 5, 1]} />
        <Lightformer intensity={1.2} color={AMBER} position={[-4, -1, 2]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
      </Environment>
      <EffectComposer multisampling={mobile ? 0 : 4}>
        <Bloom intensity={mobile ? 0.95 : 1.3} luminanceThreshold={0.18} luminanceSmoothing={0.45} mipmapBlur />
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
