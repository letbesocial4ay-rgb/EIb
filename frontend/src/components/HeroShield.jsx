import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

/**
 * Verified-document centerpiece: a slowly rotating translucent hex-plate with a scan-line,
 * a glowing halo, GLTR-colored orbit rings, and mouse-parallax on the whole group.
 * Lazy-mounted from Landing.jsx and hidden on touch devices (see .hero-scene css).
 */
function ScanLine() {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = Math.sin(t * 0.9) * 1.35;
    ref.current.material.opacity = 0.35 + Math.abs(Math.sin(t * 0.9)) * 0.35;
  });
  return (
    <mesh ref={ref} rotation={[0, 0, 0]}>
      <planeGeometry args={[2.6, 0.02]} />
      <meshBasicMaterial color="#8B5CF6" transparent opacity={0.5} />
    </mesh>
  );
}

function Halo({ radius, color, opacity = 0.5, speed = 0.4 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * speed;
  });
  const points = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      arr.push(new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, 0));
    }
    return arr;
  }, [radius]);
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  return (
    <line ref={ref} geometry={geom}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  );
}

function Sparkle({ position, color }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.5;
  });
  return (
    <group ref={ref}>
      <mesh position={position}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

function Document() {
  const grp = useRef();
  useFrame(({ clock }) => {
    if (grp.current) grp.current.rotation.y = Math.sin(clock.elapsedTime * 0.35) * 0.32;
  });
  return (
    <group ref={grp}>
      {/* Hexagonal frame — the "document" */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.5, 0.02, 12, 6]} />
        <meshStandardMaterial color="#E8DFC6" emissive="#8B5CF6" emissiveIntensity={0.25} />
      </mesh>
      {/* Inner translucent plate */}
      <mesh>
        <cylinderGeometry args={[1.35, 1.35, 0.05, 6]} />
        <meshPhysicalMaterial
          color="#1a1230"
          transmission={0.6}
          thickness={0.4}
          roughness={0.15}
          transparent
          opacity={0.5}
          emissive="#3B0764"
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* Data lines that resemble sentences */}
      {[0.7, 0.35, 0.0, -0.35, -0.7].map((y, i) => (
        <mesh key={i} position={[0, y, 0.03]}>
          <planeGeometry args={[[2.0, 1.4, 1.8, 1.6, 1.1][i], 0.06]} />
          <meshBasicMaterial color={["#22C55E", "#EAB308", "#EF4444", "#EAB308", "#22C55E"][i]} transparent opacity={0.55} />
        </mesh>
      ))}
      <ScanLine />
      <Halo radius={2.4} color="#8B5CF6" opacity={0.35} speed={0.3} />
      <Halo radius={2.9} color="#22D3EE" opacity={0.22} speed={-0.2} />
      <Sparkle position={[2.4, 0.6, 0]} color="#22C55E" />
      <Sparkle position={[-2.2, -0.9, 0]} color="#A855F7" />
      <Sparkle position={[2.6, -1.1, 0]} color="#22D3EE" />
      <Sparkle position={[-2.5, 0.7, 0]} color="#EAB308" />
    </group>
  );
}

function Scene({ pointer }) {
  const grp = useRef();
  useFrame(() => {
    if (grp.current && pointer.current) {
      const tx = pointer.current.y * 0.15;
      const ty = pointer.current.x * 0.28;
      grp.current.rotation.x += (tx - grp.current.rotation.x) * 0.06;
      grp.current.rotation.y += (ty - grp.current.rotation.y) * 0.06;
    }
  });
  return (
    <group ref={grp}>
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.9}>
        <Document />
      </Float>
    </group>
  );
}

export default function HeroShield() {
  const pointer = useRef({ x: 0, y: 0 });
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    pointer.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
  };
  return (
    <div className="hero-shield" onMouseMove={onMove} data-testid="hero-shield-3d">
      <Canvas camera={{ position: [0, 0, 6.5], fov: 45 }} dpr={[1, 1.75]} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 4, 6]} intensity={1.6} color="#8B5CF6" />
        <pointLight position={[-5, -3, -2]} intensity={1.0} color="#22D3EE" />
        <pointLight position={[0, 6, 3]} intensity={0.6} color="#E8DFC6" />
        <Scene pointer={pointer} />
      </Canvas>
    </div>
  );
}
