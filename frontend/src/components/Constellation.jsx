import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Text, Line } from "@react-three/drei";
import * as THREE from "three";

const BIN_COLORS = ["#22C55E", "#EAB308", "#EF4444", "#A855F7"];
// Six representative token strings drawn from GLTR analysis — no essay text.
const TOKENS = [
  { t: "essay", bin: 0, pos: [-3.1, 1.6, 0] },
  { t: "voice", bin: 1, pos: [2.6, 2.1, -1.2] },
  { t: "syntax", bin: 2, pos: [-2.3, -1.7, 1.6] },
  { t: "signal", bin: 0, pos: [3.2, -1.3, 1.1] },
  { t: "cliché", bin: 2, pos: [0.4, 2.7, 1.4] },
  { t: "rank·07", bin: 1, pos: [-3.4, 0.1, -1.6] },
  { t: "ppl·41.3", bin: 3, pos: [3.4, 0.3, -1.9] },
  { t: "human", bin: 0, pos: [0.2, -2.6, -1.1] },
];

// Which token pairs get a spline connecting them (i.e. "evidence lines").
const EDGES = [
  [0, 1], [0, 2], [1, 4], [2, 5], [3, 6], [3, 4], [5, 7], [6, 4], [7, 2],
];

function FloatingToken({ label, color, position }) {
  return (
    <Float speed={1.4} rotationIntensity={0.35} floatIntensity={0.9}>
      <group position={position}>
        <mesh>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
        </mesh>
        <Text
          position={[0, 0.28, 0]}
          fontSize={0.28}
          color="#F8FAFC"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.005}
          outlineColor="#0A0A0A"
        >
          {label}
        </Text>
      </group>
    </Float>
  );
}

function EvidenceLine({ from, to, color }) {
  const ref = useRef();
  const midPoints = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.4, 0));
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    return curve.getPoints(28).map((p) => [p.x, p.y, p.z]);
  }, [from, to]);
  useFrame((state) => {
    if (ref.current) {
      ref.current.material.opacity = 0.35 + 0.25 * Math.sin(state.clock.elapsedTime * 0.7);
    }
  });
  return <Line ref={ref} points={midPoints} color={color} lineWidth={1.1} transparent opacity={0.5} />;
}

function Scene({ pointer }) {
  const groupRef = useRef();
  useFrame(() => {
    if (groupRef.current) {
      const targetX = pointer.current.y * 0.15;
      const targetY = pointer.current.x * 0.25;
      groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.05;
      groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.05;
    }
  });
  return (
    <group ref={groupRef}>
      {EDGES.map(([a, b], i) => (
        <EvidenceLine
          key={i}
          from={TOKENS[a].pos}
          to={TOKENS[b].pos}
          color={BIN_COLORS[(TOKENS[a].bin + TOKENS[b].bin) % 4]}
        />
      ))}
      {TOKENS.map((t, i) => (
        <FloatingToken key={i} label={t.t} color={BIN_COLORS[t.bin]} position={t.pos} />
      ))}
    </group>
  );
}

export default function Constellation() {
  const pointer = useRef({ x: 0, y: 0 });
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    pointer.current = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: ((e.clientY - rect.top) / rect.height) * 2 - 1,
    };
  };
  return (
    <div className="constellation-wrap" onMouseMove={onMove} data-testid="landing-3d-scene">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 45 }}
        dpr={[1, 1.6]}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.35} />
        <pointLight position={[6, 4, 6]} intensity={1.1} color="#8B5CF6" />
        <pointLight position={[-6, -4, -3]} intensity={0.7} color="#22D3EE" />
        <Scene pointer={pointer} />
      </Canvas>
    </div>
  );
}
