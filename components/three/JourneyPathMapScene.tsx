import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Group, Mesh, Vector3 } from 'three';

interface Props {
  total: number;
  activeIndex: number;
  trailColor?: string;
  nodeColor?: string;
  activeColor?: string;
}

const JourneyPathMapScene: React.FC<Props> = ({
  total,
  activeIndex,
  trailColor = '#6ee7b7',
  nodeColor = '#86efac',
  activeColor = '#22c55e',
}) => {
  const groupRef = useRef<Group | null>(null);
  const activeRef = useRef<Mesh | null>(null);

  const points = useMemo(() => {
    const count = Math.max(2, total);
    return Array.from({ length: count }).map((_, i) => {
      const x = -2.2 + (i / (count - 1)) * 4.4;
      const y = Math.sin(i * 0.9) * 0.38 + (i % 2 === 0 ? 0.15 : -0.08);
      return new Vector3(x, y, 0);
    });
  }, [total]);

  const curve = useMemo(() => new CatmullRomCurve3(points), [points]);
  const clampedActive = Math.max(0, Math.min(total - 1, activeIndex));
  const activePoint = points[clampedActive] || new Vector3(0, 0, 0);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z += delta * 0.03;
    }
    if (activeRef.current) {
      const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.12;
      activeRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <tubeGeometry args={[curve, 96, 0.045, 10, false]} />
        <meshStandardMaterial color={trailColor} emissive={activeColor} emissiveIntensity={0.25} transparent opacity={0.82} />
      </mesh>

      {points.map((p, i) => {
        const isActive = i === clampedActive;
        const isDone = i < clampedActive;
        return (
          <group key={`node_${i}`} position={p.toArray()}>
            <mesh ref={isActive ? activeRef : undefined}>
              <sphereGeometry args={[isActive ? 0.14 : 0.1, 24, 24]} />
              <meshStandardMaterial
                color={isActive ? trailColor : isDone ? nodeColor : '#c7d2fe'}
                emissive={isActive ? activeColor : nodeColor}
                emissiveIntensity={isActive ? 0.55 : 0.25}
                transparent
                opacity={isDone || isActive ? 0.95 : 0.65}
              />
            </mesh>
          </group>
        );
      })}

      <mesh position={[activePoint.x, activePoint.y, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.24, 42]} />
        <meshBasicMaterial color={trailColor} transparent opacity={0.45} />
      </mesh>
    </group>
  );
};

export default JourneyPathMapScene;
