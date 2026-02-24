import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, Color, Group, Mesh, Points } from 'three';

type JourneyMood = 'healing' | 'finance' | 'tech' | 'garden' | 'cosmos' | 'inner' | 'skycity';

interface Props {
  mode?: 'assessment' | 'welcome';
  mood?: JourneyMood;
  progress?: number;
}

const paletteForMood = (mood: JourneyMood) => {
  if (mood === 'finance') return { core: '#a78bfa', aura: '#7c3aed', spirit: '#f3e8ff' };
  if (mood === 'tech') return { core: '#38bdf8', aura: '#0284c7', spirit: '#e0f2fe' };
  if (mood === 'healing') return { core: '#2dd4bf', aura: '#0d9488', spirit: '#ccfbf1' };
  return { core: '#22d3ee', aura: '#0891b2', spirit: '#ecfeff' };
};

const JourneyBackdropScene: React.FC<Props> = ({ mode = 'assessment', mood = 'garden', progress = 0 }) => {
  const palette = paletteForMood(mood);
  const showProgressBar = mode === 'assessment';
  const showJourneyFlow = mode === 'assessment';

  const rootRef = useRef<Group | null>(null);
  const fieldRef = useRef<Points | null>(null);
  const streamRef = useRef<Points | null>(null);

  const progressFillRef = useRef<Mesh | null>(null);
  const spiritRef = useRef<Mesh | null>(null);
  const checkpointRefs = useRef<Array<Mesh | null>>([]);

  const clampedProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const totalCheckpoints = 7;

  const bar = useMemo(
    () => ({
      xMin: -6.8,
      xMax: 6.8,
      y: -3.2,
      z: 0.2,
    }),
    []
  );

  const checkpointXs = useMemo(
    () => Array.from({ length: totalCheckpoints }, (_, i) => bar.xMin + (i / (totalCheckpoints - 1)) * (bar.xMax - bar.xMin)),
    [bar, totalCheckpoints]
  );

  const fieldCount = mode === 'welcome' ? 2200 : 1260;
  const streamCount = 240;

  const fieldSeeds = useMemo(
    () =>
      Array.from({ length: fieldCount }, (_, idx) => ({
        x: -8.5 + (idx % 62) * 0.28,
        y: -5.6 + Math.floor(idx / 62) * 1.05,
        z: -1.0 + (idx % 10) * 0.2,
        phase: idx * 0.17,
        vx: 0.018 + (idx % 9) * 0.0038,
        vy: ((idx % 7) - 3) * 0.0042,
        vz: ((idx % 5) - 2) * 0.0022,
      })),
    []
  );

  const fieldPositions = useMemo(() => {
    const arr = new Float32Array(fieldCount * 3);
    fieldSeeds.forEach((s, idx) => {
      const i = idx * 3;
      arr[i] = s.x;
      arr[i + 1] = s.y;
      arr[i + 2] = s.z;
    });
    return arr;
  }, [fieldCount, fieldSeeds]);

  const fieldColors = useMemo(() => {
    const arr = new Float32Array(fieldCount * 3);
    const a = new Color(palette.aura);
    const c = new Color(palette.core);
    for (let i = 0; i < fieldCount; i += 1) {
      const mix = (i % 11) / 10;
      const col = a.clone().lerp(c, mix * 0.55);
      const j = i * 3;
      arr[j] = col.r;
      arr[j + 1] = col.g;
      arr[j + 2] = col.b;
    }
    return arr;
  }, [fieldCount, palette.aura, palette.core]);

  const streamPositions = useMemo(() => new Float32Array(streamCount * 3), [streamCount]);
  const streamColors = useMemo(() => {
    const arr = new Float32Array(streamCount * 3);
    const c = new Color(palette.core);
    const s = new Color(palette.spirit);
    for (let i = 0; i < streamCount; i += 1) {
      const mix = (i % 19) / 18;
      const col = c.clone().lerp(s, mix * 0.6);
      const j = i * 3;
      arr[j] = col.r;
      arr[j + 1] = col.g;
      arr[j + 2] = col.b;
    }
    return arr;
  }, [streamCount, palette.core, palette.spirit]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const travelProgress = mode === 'welcome' ? 0.14 + (Math.sin(t * 0.35) + 1) * 0.06 : clampedProgress;
    const traveler = Math.max(0.01, Math.min(0.999, travelProgress));

    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(t * 0.16) * 0.01;
    }

    const fieldAttr = fieldRef.current?.geometry.getAttribute('position') as BufferAttribute | undefined;
    if (fieldAttr) {
      const arr = fieldAttr.array as Float32Array;
      fieldSeeds.forEach((s, idx) => {
        const i = idx * 3;
        arr[i] = ((((s.x + t * s.vx + Math.sin(t * 0.35 + s.phase) * 0.34) + 9) % 18) + 18) % 18 - 9;
        arr[i + 1] = ((((s.y + t * s.vy + Math.cos(t * 0.28 + s.phase) * 0.3) + 6) % 12) + 12) % 12 - 6;
        arr[i + 2] = ((((s.z + t * s.vz + Math.sin(t * 0.22 + s.phase) * 0.18) + 1.2) % 2.4) + 2.4) % 2.4 - 1.2;
      });
      fieldAttr.needsUpdate = true;
    }

    const streamAttr = streamRef.current?.geometry.getAttribute('position') as BufferAttribute | undefined;
    if (streamAttr && showJourneyFlow) {
      const arr = streamAttr.array as Float32Array;
      const xSpan = bar.xMax - bar.xMin;
      for (let i = 0; i < streamCount; i += 1) {
        const seed = i / streamCount;
        const loop = (seed + t * 0.05) % 1;
        const u = mode === 'assessment' ? loop * traveler : loop;
        const j = i * 3;
        arr[j] = bar.xMin + xSpan * u + Math.sin(t * 1.7 + i) * 0.07;
        arr[j + 1] = bar.y + 0.02 + Math.cos(t * 2.3 + i) * 0.03;
        arr[j + 2] = bar.z + Math.sin(t * 1.3 + i) * 0.03;
      }
      streamAttr.needsUpdate = true;
    }

    if (progressFillRef.current && showJourneyFlow) {
      const xSpan = bar.xMax - bar.xMin;
      const filled = Math.max(0.02, traveler) * xSpan;
      progressFillRef.current.scale.x = filled;
      progressFillRef.current.position.x = bar.xMin + filled * 0.5;
    }

    if (spiritRef.current && showJourneyFlow) {
      spiritRef.current.position.x = bar.xMin + (bar.xMax - bar.xMin) * traveler;
      spiritRef.current.position.y = bar.y + 0.04 + Math.sin(t * 5) * 0.02;
      spiritRef.current.position.z = bar.z + 0.06;
      const s = 1.2 + Math.sin(t * 3) * 0.07;
      spiritRef.current.scale.setScalar(s);
    }

    checkpointRefs.current.forEach((node, idx) => {
      if (!node) return;
      if (!showJourneyFlow) {
        node.visible = false;
        return;
      }
      node.visible = true;
      const p = idx / (totalCheckpoints - 1);
      const completed = traveler >= p;
      const active = Math.abs(traveler - p) < 0.08;
      const pulse = active ? 1 + Math.sin(t * 6 + idx) * 0.14 : 1;
      const base = completed ? 1.15 : 0.9;
      node.scale.setScalar(base * pulse);
    });
  });

  return (
    <group ref={rootRef}>
      <points ref={fieldRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fieldPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[fieldColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={mode === 'welcome' ? 0.055 : 0.032}
          sizeAttenuation={mode !== 'welcome'}
          vertexColors
          transparent
          opacity={mode === 'welcome' ? 0.8 : 0.62}
          depthWrite={false}
        />
      </points>

      {showProgressBar && (
        <>
          <mesh position={[0, bar.y, bar.z]} scale={[bar.xMax - bar.xMin, 0.03, 0.03]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#2b3f56" emissive={palette.aura} emissiveIntensity={0.18} />
          </mesh>

          <mesh ref={progressFillRef} position={[bar.xMin + 0.1, bar.y, bar.z + 0.01]} scale={[0.2, 0.04, 0.04]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={palette.core} emissive={palette.aura} emissiveIntensity={0.72} />
          </mesh>

          {checkpointXs.map((x, idx) => (
            <mesh
              key={`checkpoint-${idx}`}
              ref={(el) => {
                checkpointRefs.current[idx] = el;
              }}
              position={[x, bar.y, bar.z + 0.04]}
            >
              <sphereGeometry args={[idx === checkpointXs.length - 1 ? 0.11 : 0.085, 16, 16]} />
              <meshStandardMaterial color={palette.core} emissive={palette.aura} emissiveIntensity={0.55} />
            </mesh>
          ))}
        </>
      )}

      {showJourneyFlow && (
        <>
          <points ref={streamRef}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[streamPositions, 3]} />
              <bufferAttribute attach="attributes-color" args={[streamColors, 3]} />
            </bufferGeometry>
            <pointsMaterial size={0.072} vertexColors transparent opacity={0.88} depthWrite={false} />
          </points>

          <mesh ref={spiritRef} position={[bar.xMin, bar.y + 0.05, bar.z + 0.06]}>
            <sphereGeometry args={[0.16, 20, 20]} />
            <meshStandardMaterial color={palette.spirit} emissive={palette.aura} emissiveIntensity={1.0} />
          </mesh>
        </>
      )}
    </group>
  );
};

export default JourneyBackdropScene;
