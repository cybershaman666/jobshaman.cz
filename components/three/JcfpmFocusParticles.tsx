import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Points } from 'three';

interface Props {
  qualityTier?: 'low' | 'medium' | 'high';
}

const JcfpmFocusParticles: React.FC<Props> = ({ qualityTier = 'medium' }) => {
  const pointsRef = useRef<Points>(null);
  const count = qualityTier === 'high' ? 360 : qualityTier === 'medium' ? 240 : 150;

  const { positions, speeds } = useMemo(() => {
    const positionsData = new Float32Array(count * 3);
    const speedsData = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const idx = i * 3;
      positionsData[idx] = (Math.random() - 0.5) * 12;
      positionsData[idx + 1] = (Math.random() - 0.5) * 8;
      positionsData[idx + 2] = (Math.random() - 0.5) * 5;
      speedsData[i] = 0.03 + Math.random() * 0.08;
    }

    return { positions: positionsData, speeds: speedsData };
  }, [count]);

  useFrame(({ clock }, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    const attr = points.geometry.attributes.position;
    const arr = attr.array as Float32Array;
    const t = clock.getElapsedTime();

    for (let i = 0; i < count; i += 1) {
      const idx = i * 3;
      arr[idx + 1] += speeds[i] * delta;
      arr[idx] += Math.sin(t * 0.18 + i * 0.31) * 0.0008;
      if (arr[idx + 1] > 4.2) {
        arr[idx + 1] = -4.2;
      }
    }

    attr.needsUpdate = true;
    points.rotation.z = Math.sin(t * 0.08) * 0.03;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color="#67e8f9"
        size={qualityTier === 'low' ? 0.03 : 0.04}
        sizeAttenuation
        transparent
        opacity={0.42}
        depthWrite={false}
      />
    </points>
  );
};

export default JcfpmFocusParticles;
