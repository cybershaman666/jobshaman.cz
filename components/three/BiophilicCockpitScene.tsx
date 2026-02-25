import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, Color, Group, Points } from 'three';

interface Props {
  phase: 1 | 2 | 3 | 4 | 5;
  progress: number;
  streakCount: number;
  confidence: number;
  energy: number;
  culture: number;
  qualityTier?: 'low' | 'medium' | 'high';
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const BiophilicCockpitScene: React.FC<Props> = ({
  phase,
  progress,
  streakCount,
  confidence,
  energy,
  culture,
  qualityTier = 'high',
}) => {
  const rootRef = useRef<Group | null>(null);
  const fieldRef = useRef<Points | null>(null);
  const streamRef = useRef<Points | null>(null);

  const intensity = clamp((confidence + energy + culture) / 300, 0.25, 1);
  const fieldCount = qualityTier === 'high' ? 2200 : qualityTier === 'medium' ? 1400 : 800;
  const streamCount = qualityTier === 'high' ? 440 : qualityTier === 'medium' ? 280 : 180;

  const fieldSeeds = useMemo(
    () =>
      Array.from({ length: fieldCount }).map((_, idx) => ({
        x: -11 + (idx % 80) * 0.28,
        y: -6 + Math.floor(idx / 80) * 0.48,
        z: -3 + (idx % 16) * 0.34,
        drift: 0.018 + (idx % 10) * 0.004,
        wave: idx * 0.31,
      })),
    [fieldCount]
  );

  const fieldPositions = useMemo(() => {
    const arr = new Float32Array(fieldCount * 3);
    fieldSeeds.forEach((seed, idx) => {
      const i = idx * 3;
      arr[i] = seed.x;
      arr[i + 1] = seed.y;
      arr[i + 2] = seed.z;
    });
    return arr;
  }, [fieldCount, fieldSeeds]);

  const fieldColors = useMemo(() => {
    const arr = new Float32Array(fieldCount * 3);
    const deep = new Color('#0f766e');
    const bright = new Color('#99f6e4');
    for (let i = 0; i < fieldCount; i += 1) {
      const mix = (i % 13) / 12;
      const color = deep.clone().lerp(bright, mix * 0.85);
      const j = i * 3;
      arr[j] = color.r;
      arr[j + 1] = color.g;
      arr[j + 2] = color.b;
    }
    return arr;
  }, [fieldCount]);

  const streamPositions = useMemo(() => new Float32Array(streamCount * 3), [streamCount]);
  const streamColors = useMemo(() => {
    const arr = new Float32Array(streamCount * 3);
    const from = new Color('#67e8f9');
    const to = new Color('#bbf7d0');
    for (let i = 0; i < streamCount; i += 1) {
      const mix = (i % 19) / 18;
      const color = from.clone().lerp(to, mix);
      const j = i * 3;
      arr[j] = color.r;
      arr[j + 1] = color.g;
      arr[j + 2] = color.b;
    }
    return arr;
  }, [streamCount]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const motion = 0.18 + intensity * 0.45;
    const clampedProgress = clamp(progress, 0, 1);

    if (rootRef.current) {
      rootRef.current.rotation.y += delta * 0.015;
      rootRef.current.rotation.z = Math.sin(t * 0.09) * 0.02;
      rootRef.current.position.y = Math.sin(t * 0.16) * 0.08;
    }

    const fieldAttr = fieldRef.current?.geometry.getAttribute('position') as BufferAttribute | undefined;
    if (fieldAttr) {
      const arr = fieldAttr.array as Float32Array;
      for (let i = 0; i < fieldSeeds.length; i += 1) {
        const seed = fieldSeeds[i];
        const j = i * 3;
        arr[j] = ((((seed.x + Math.sin(t * seed.drift + seed.wave) * motion) + 12) % 24) + 24) % 24 - 12;
        arr[j + 1] = ((((seed.y + Math.cos(t * (seed.drift + 0.08) + seed.wave) * motion * 0.9) + 8) % 16) + 16) % 16 - 8;
        arr[j + 2] = seed.z + Math.sin(t * 0.23 + seed.wave) * 0.32;
      }
      fieldAttr.needsUpdate = true;
    }

    const streamAttr = streamRef.current?.geometry.getAttribute('position') as BufferAttribute | undefined;
    if (streamAttr) {
      const arr = streamAttr.array as Float32Array;
      for (let i = 0; i < streamCount; i += 1) {
        const p = i / streamCount;
        const phaseOffset = (phase - 1) * 0.13;
        const arc = (p + t * (0.035 + streakCount * 0.003) + phaseOffset) % 1;
        const sweep = arc * Math.PI * 2;
        const radius = 2.2 + Math.sin(p * 17 + t * 0.8) * 0.65 + clampedProgress * 2.1;
        const j = i * 3;
        arr[j] = Math.cos(sweep) * radius;
        arr[j + 1] = Math.sin(sweep * 0.7) * (1.5 + phase * 0.15);
        arr[j + 2] = -1.2 + p * 2.4 + Math.cos(sweep * 1.6 + t) * 0.35;
      }
      streamAttr.needsUpdate = true;
    }
  });

  return (
    <group ref={rootRef}>
      <fog attach="fog" args={['#02170f', 9, 24]} />

      <points ref={fieldRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fieldPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[fieldColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={qualityTier === 'low' ? 0.032 : 0.04}
          vertexColors
          transparent
          opacity={0.3 + intensity * 0.35}
          depthWrite={false}
        />
      </points>

      <points ref={streamRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[streamPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[streamColors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.085} vertexColors transparent opacity={0.72 + intensity * 0.15} depthWrite={false} />
      </points>

      <mesh position={[0, -0.55, -1.5]} scale={[11.5, 6.5, 1]} rotation={[-0.14, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#052e2b" emissive="#164e63" emissiveIntensity={0.28} transparent opacity={0.28} />
      </mesh>
    </group>
  );
};

export default BiophilicCockpitScene;
