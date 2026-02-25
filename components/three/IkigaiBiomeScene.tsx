import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  progress: number;
  coreScore: number;
  consistency: number;
  loveScore: number;
  strengthScore: number;
  needScore: number;
  rewardScore: number;
  activeLobe?: LobeKey | null;
  onSelectLobe?: (lobe: LobeKey) => void;
}

type LobeKey = 'love' | 'strength' | 'need' | 'reward';

const normalizeScore = (value: number): number => Math.max(0, Math.min(100, value || 0));

const IkigaiBiomeScene: React.FC<Props> = ({
  progress,
  coreScore,
  consistency,
  loveScore,
  strengthScore,
  needScore,
  rewardScore,
  activeLobe = null,
  onSelectLobe,
}) => {
  const lobeRefs = useRef<Record<LobeKey, THREE.Mesh | null>>({
    love: null,
    strength: null,
    need: null,
    reward: null,
  });
  const coreRef = useRef<THREE.Mesh>(null);
  const hoveredRef = useRef<LobeKey | null>(null);

  const lobes = useMemo(() => {
    return [
      { key: 'love' as const, score: normalizeScore(loveScore), color: '#f2de5f', position: [0, 1.15, 0] as [number, number, number] },
      { key: 'strength' as const, score: normalizeScore(strengthScore), color: '#9fcb67', position: [-1.2, 0, 0] as [number, number, number] },
      { key: 'need' as const, score: normalizeScore(needScore), color: '#f08b8d', position: [1.2, 0, 0] as [number, number, number] },
      { key: 'reward' as const, score: normalizeScore(rewardScore), color: '#69c4bf', position: [0, -1.15, 0] as [number, number, number] },
    ];
  }, [loveScore, strengthScore, needScore, rewardScore]);

  const centerColor = coreScore >= 75 ? '#d97706' : coreScore >= 55 ? '#b45309' : '#92400e';
  const centerOpacity = 0.34 + normalizeScore(coreScore) / 260;

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') document.body.style.cursor = 'default';
    };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    lobes.forEach((lobe, idx) => {
      const mesh = lobeRefs.current[lobe.key];
      if (!mesh) return;
      const drift = 1 + Math.sin(t * (0.8 + idx * 0.11)) * 0.02;
      const scoreFactor = 0.9 + lobe.score / 560;
      const hoverBoost = hoveredRef.current === lobe.key ? 0.12 : 0;
      const activeBoost = activeLobe === lobe.key ? 0.08 : 0;
      mesh.scale.setScalar(drift * scoreFactor + hoverBoost + activeBoost);
    });

    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 1.4) * 0.04 + progress * 0.0008 + consistency * 0.0005;
      coreRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      {lobes.map((lobe) => (
        <group key={lobe.key} position={lobe.position}>
          <mesh
            ref={(node) => { lobeRefs.current[lobe.key] = node; }}
            onPointerOver={(event) => {
              event.stopPropagation();
              hoveredRef.current = lobe.key;
              if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
            }}
            onPointerOut={(event) => {
              event.stopPropagation();
              hoveredRef.current = null;
              if (typeof document !== 'undefined') document.body.style.cursor = 'default';
            }}
            onClick={(event) => {
              event.stopPropagation();
              onSelectLobe?.(lobe.key);
            }}
          >
            <circleGeometry args={[1.46, 64]} />
            <meshStandardMaterial
              color={lobe.color}
              emissive={lobe.color}
              emissiveIntensity={0.2 + lobe.score / 650 + (hoveredRef.current === lobe.key ? 0.2 : 0) + (activeLobe === lobe.key ? 0.12 : 0)}
              transparent
              opacity={0.32 + lobe.score / 420}
            />
          </mesh>
          <mesh>
            <ringGeometry args={[1.42, 1.46, 64]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
          </mesh>
        </group>
      ))}

      <mesh ref={coreRef} position={[0, 0, 0.12]}>
        <circleGeometry args={[0.82, 64]} />
        <meshStandardMaterial color={centerColor} emissive={centerColor} emissiveIntensity={0.36} transparent opacity={centerOpacity} />
      </mesh>

      <mesh position={[0, 0, 0.2]}>
        <ringGeometry args={[0.28, 0.32, 48]} />
        <meshBasicMaterial color="#fff7ed" transparent opacity={0.7} />
      </mesh>

      {lobes.map((lobe) => (
        <line key={`guide-${lobe.key}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([0, 0, 0.04, lobe.position[0] * 0.72, lobe.position[1] * 0.72, 0.04])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#f8fafc" transparent opacity={0.2 + progress / 520} />
        </line>
      ))}
    </group>
  );
};

export default IkigaiBiomeScene;
