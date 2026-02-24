import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, Vector3 } from 'three';
import { AssessmentGalaxyNode, AssessmentSignalFrame } from '../../types';

interface Props {
  frame?: AssessmentSignalFrame | null;
  mode?: 'assessment' | 'welcome';
  skin?: 'cosmos' | 'garden' | 'inner' | 'skycity' | 'healing' | 'finance' | 'tech';
  nodes?: AssessmentGalaxyNode[];
  edges?: Array<{ from: string; to: string }>;
  activeNodeId?: string | null;
  centerUnlocked?: boolean;
  onSelectNode?: (nodeId: string) => void;
  onSelectCenter?: () => void;
}

interface DisplayNode {
  id: string;
  label: string;
  color: string;
  position: [number, number, number];
  score: number;
}

interface MovingLaneProps {
  x: number;
  y: number;
  zBase: number;
  span: number;
  speed: number;
  scale: [number, number, number];
  color: string;
  emissive: string;
  opacity?: number;
}

const MovingLane: React.FC<MovingLaneProps> = ({
  x,
  y,
  zBase,
  span,
  speed,
  scale,
  color,
  emissive,
  opacity = 0.85,
}) => {
  const ref = useRef<Mesh | null>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * speed;
    const wrappedZ = ((zBase + t + span) % span) - span / 2;
    ref.current.position.set(x, y, wrappedZ);
  });
  return (
    <mesh ref={ref} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.25} transparent opacity={opacity} />
    </mesh>
  );
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const colorByState = (state: AssessmentGalaxyNode['state']): string => {
  if (state === 'completed_good') return '#22c55e';
  if (state === 'completed_weak') return '#f59e0b';
  if (state === 'skipped') return '#ef4444';
  if (state === 'active') return '#06b6d4';
  if (state === 'available') return '#38bdf8';
  return '#475569';
};

const skinPalette = (skin: 'cosmos' | 'garden' | 'inner' | 'skycity' | 'healing' | 'finance' | 'tech') => {
  if (skin === 'healing') {
    return {
      bgColor: '#bae6fd',
      bgEmissive: '#67e8f9',
      centerColor: '#e0f2fe',
      centerEmissive: '#38bdf8',
      routeColor: '#93c5fd',
      ringColor: '#7dd3fc',
      accent: '#0ea5e9',
    };
  }
  if (skin === 'finance') {
    return {
      bgColor: '#ddd6fe',
      bgEmissive: '#c4b5fd',
      centerColor: '#ede9fe',
      centerEmissive: '#a78bfa',
      routeColor: '#c4b5fd',
      ringColor: '#8b5cf6',
      accent: '#a78bfa',
    };
  }
  if (skin === 'tech') {
    return {
      bgColor: '#bfdbfe',
      bgEmissive: '#60a5fa',
      centerColor: '#dbeafe',
      centerEmissive: '#3b82f6',
      routeColor: '#60a5fa',
      ringColor: '#2563eb',
      accent: '#3b82f6',
    };
  }
  if (skin === 'garden') {
    return {
      bgColor: '#86efac',
      bgEmissive: '#fef08a',
      centerColor: '#fef3c7',
      centerEmissive: '#f59e0b',
      routeColor: '#fef08a',
      ringColor: '#fb7185',
      accent: '#34d399',
    };
  }
  if (skin === 'inner') {
    return {
      bgColor: '#a5f3fc',
      bgEmissive: '#67e8f9',
      centerColor: '#e0f2fe',
      centerEmissive: '#22d3ee',
      routeColor: '#38bdf8',
      ringColor: '#2dd4bf',
      accent: '#22d3ee',
    };
  }
  if (skin === 'skycity') {
    return {
      bgColor: '#cbd5e1',
      bgEmissive: '#93c5fd',
      centerColor: '#e2e8f0',
      centerEmissive: '#60a5fa',
      routeColor: '#93c5fd',
      ringColor: '#cbd5e1',
      accent: '#60a5fa',
    };
  }
  return {
    bgColor: '#94a3b8',
    bgEmissive: '#93c5fd',
    centerColor: '#e2e8f0',
    centerEmissive: '#a5b4fc',
    routeColor: '#64748b',
    ringColor: '#94a3b8',
    accent: '#22d3ee',
  };
};

const NebulaQuestScene: React.FC<Props> = ({
  frame = null,
  mode = 'assessment',
  skin = 'cosmos',
  nodes,
  edges = [],
  activeNodeId,
  centerUnlocked = false,
  onSelectNode,
  onSelectCenter,
}) => {
  const [activeLegacy, setActiveLegacy] = useState<string>('skills');
  const nebulaRef = useRef<Group | null>(null);
  const shipRef = useRef<Group | null>(null);
  const targetVec = useRef(new Vector3(0, 0, 0));

  useFrame((_, delta) => {
    if (!nebulaRef.current) return;
    nebulaRef.current.rotation.z += delta * 0.05;
    nebulaRef.current.rotation.y -= delta * 0.03;
    if (shipRef.current) {
      shipRef.current.position.lerp(targetVec.current, Math.min(1, delta * 1.8));
    }
  });

  const displayNodes = useMemo<DisplayNode[]>(() => {
    if (nodes && nodes.length > 0) {
      return nodes.map((n, idx) => ({
        id: n.id,
        label: `${idx + 1}`,
        color: colorByState(n.state),
        position: n.position3d,
        score: clamp(Math.round(((n.points - n.penaltyApplied) / Math.max(n.maxPoints, 1)) * 100), 5, 100),
      }));
    }

    const unlockedCount = frame?.unlocked_skills.length || 0;
    const confidence = frame?.confidence || 40;
    const integrity = frame?.narrative_integrity || 50;
    const base = [
      { id: 'balance', label: 'Work-Life', color: '#22d3ee', position: [-2.6, 1.2, 0] as [number, number, number], seed: 0.65 },
      { id: 'experience', label: 'Experience', color: '#38bdf8', position: [-1.2, -0.8, 0.3] as [number, number, number], seed: 0.7 },
      { id: 'skills', label: 'Skills', color: '#14b8a6', position: [0.2, 1.5, -0.2] as [number, number, number], seed: 0.78 },
      { id: 'dreams', label: 'Dreams', color: '#a78bfa', position: [1.4, -0.4, -0.3] as [number, number, number], seed: 0.55 },
      { id: 'values', label: 'Values', color: '#f59e0b', position: [2.7, 1.0, 0.1] as [number, number, number], seed: 0.72 },
    ];
    return base.map((item, idx) => {
      const dynamic = mode === 'assessment'
        ? (unlockedCount * 4 + confidence * 0.3 + integrity * 0.2) / 100
        : (60 + idx * 6) / 100;
      return {
        ...item,
        score: clamp(Math.round((item.seed + dynamic) * 50), 18, 100),
      };
    });
  }, [nodes, frame, mode]);

  const activeId = activeNodeId || activeLegacy;
  const activeNode = displayNodes.find((n) => n.id === activeId) || displayNodes[0];
  const palette = skinPalette(skin);
  const completionRatio = useMemo(() => {
    if (nodes && nodes.length > 0) {
      const completed = nodes.filter((n) => n.state === 'completed_good' || n.state === 'completed_weak' || n.state === 'skipped').length;
      return clamp(completed / Math.max(1, nodes.length), 0, 1);
    }
    return clamp((frame?.unlocked_skills.length || 0) / 5, 0, 1);
  }, [nodes, frame]);
  const travelSpeed = 0.55 + completionRatio * 0.95;
  const edgePairs = edges.length > 0 ? edges : displayNodes.slice(1).map((n, idx) => ({ from: displayNodes[idx].id, to: n.id }));

  const getNode = (id: string) => displayNodes.find((n) => n.id === id);
  const activePosition = activeNode?.position || [0, 0, 0];
  targetVec.current.set(activePosition[0], activePosition[1], activePosition[2]);
  const starPositions = useMemo(() => {
    if (skin === 'healing') {
      return Array.from({ length: 110 }).map((_, idx) => {
        const x = ((idx % 11) - 5) * 0.54;
        const y = Math.sin(idx * 0.35) * 1.15 + (((idx / 11) | 0) - 4) * 0.4;
        const z = Math.cos(idx * 0.23) * 0.18;
        return [x, y, z] as [number, number, number];
      });
    }
    if (skin === 'finance') {
      return Array.from({ length: 120 }).map((_, idx) => {
        const lane = idx % 10;
        const row = (idx / 10) | 0;
        const x = -2.7 + lane * 0.6;
        const y = -2 + row * 0.36;
        const z = Math.sin(idx * 0.4) * 0.12;
        return [x, y, z] as [number, number, number];
      });
    }
    if (skin === 'tech') {
      return Array.from({ length: 124 }).map((_, idx) => {
        const angle = (idx / 124) * Math.PI * 4;
        const radius = 1.2 + (idx % 8) * 0.26;
        const x = Math.cos(angle) * radius * 0.72;
        const y = Math.sin(angle) * radius * 0.5;
        const z = Math.cos(angle * 1.4) * 0.2;
        return [x, y, z] as [number, number, number];
      });
    }
    if (skin === 'garden') {
      return Array.from({ length: 120 }).map((_, idx) => {
        const x = ((idx % 20) - 10) * 0.42;
        const y = Math.sin(idx * 0.5) * 1.2 + (((idx / 20) | 0) - 3) * 0.55;
        const z = Math.cos(idx * 0.3) * 0.25;
        return [x, y, z] as [number, number, number];
      });
    }
    if (skin === 'inner') {
      return Array.from({ length: 72 }).map((_, idx) => {
        const angle = (idx / 72) * Math.PI * 6;
        const radius = 0.8 + idx * 0.045;
        return [Math.cos(angle) * radius * 0.2, Math.sin(angle) * radius * 0.2, Math.sin(angle * 0.9) * 0.28] as [number, number, number];
      });
    }
    if (skin === 'skycity') {
      return Array.from({ length: 120 }).map((_, idx) => {
        const lane = idx % 12;
        const row = (idx / 12) | 0;
        return [(-2.8 + lane * 0.5), (-2.0 + row * 0.45), ((idx % 5) - 2) * 0.06] as [number, number, number];
      });
    }
    return Array.from({ length: 120 }).map((_, idx) => {
      const angle = (idx / 120) * Math.PI * 2;
      const radius = 3.8 + (idx % 9) * 0.16;
      const z = ((idx % 11) - 5) * 0.17;
      return [Math.cos(angle) * radius, Math.sin(angle * 1.3) * radius * 0.65, z] as [number, number, number];
    });
  }, [skin]);
  const laneSeeds = useMemo(() => Array.from({ length: 16 }).map((_, i) => i), []);

  return (
    <group ref={nebulaRef}>
      {skin === 'cosmos' && laneSeeds.map((i) => (
        <React.Fragment key={`rack_${i}`}>
          <MovingLane
            x={-3.8}
            y={-1.3 + (i % 4) * 0.9}
            zBase={-22 + i * 2.4}
            span={44}
            speed={travelSpeed}
            scale={[0.45, 0.55, 1.25]}
            color="#1e293b"
            emissive="#38bdf8"
            opacity={0.44}
          />
          <MovingLane
            x={3.8}
            y={-1.3 + (i % 4) * 0.9}
            zBase={-23 + i * 2.4}
            span={44}
            speed={travelSpeed}
            scale={[0.45, 0.55, 1.25]}
            color="#1e293b"
            emissive="#22d3ee"
            opacity={0.44}
          />
        </React.Fragment>
      ))}

      {skin === 'inner' && laneSeeds.map((i) => (
        <React.Fragment key={`clinic_${i}`}>
          <MovingLane
            x={-3.2}
            y={-0.3 + (i % 3) * 1.1}
            zBase={-18 + i * 2.5}
            span={40}
            speed={travelSpeed * 0.75}
            scale={[0.22, 0.12, 2.6]}
            color="#e0f2fe"
            emissive="#67e8f9"
            opacity={0.5}
          />
          <MovingLane
            x={3.2}
            y={-0.3 + (i % 3) * 1.1}
            zBase={-19 + i * 2.5}
            span={40}
            speed={travelSpeed * 0.75}
            scale={[0.22, 0.12, 2.6]}
            color="#e0f2fe"
            emissive="#22d3ee"
            opacity={0.5}
          />
        </React.Fragment>
      ))}

      {skin === 'healing' && laneSeeds.map((i) => (
        <React.Fragment key={`healing_${i}`}>
          <MovingLane
            x={-3.4 + (i % 4) * 2.2}
            y={-1.0 + ((i / 4) | 0) * 0.7}
            zBase={-18 + i * 2.3}
            span={40}
            speed={travelSpeed * 0.68}
            scale={[0.2, 0.16, 2.0]}
            color="#e0f2fe"
            emissive="#38bdf8"
            opacity={0.42}
          />
        </React.Fragment>
      ))}

      {skin === 'finance' && laneSeeds.map((i) => (
        <React.Fragment key={`finance_${i}`}>
          <MovingLane
            x={-3.8 + (i % 8) * 1.05}
            y={-1.7 + ((i / 8) | 0) * 2.6}
            zBase={-22 + i * 1.9}
            span={44}
            speed={travelSpeed * 1.05}
            scale={[0.18, 0.95 + (i % 3) * 0.22, 0.18]}
            color="#312e81"
            emissive="#a78bfa"
            opacity={0.44}
          />
        </React.Fragment>
      ))}

      {skin === 'tech' && laneSeeds.map((i) => (
        <React.Fragment key={`tech_${i}`}>
          <MovingLane
            x={-3.6 + (i % 4) * 2.4}
            y={-1.4 + ((i / 4) | 0) * 1.05}
            zBase={-24 + i * 2.2}
            span={46}
            speed={travelSpeed * 1.2}
            scale={[0.34, 0.18, 2.5]}
            color="#0f172a"
            emissive="#3b82f6"
            opacity={0.45}
          />
        </React.Fragment>
      ))}

      {skin === 'skycity' && laneSeeds.map((i) => (
        <React.Fragment key={`tower_${i}`}>
          <MovingLane
            x={-4 + (i % 4) * 0.6}
            y={-1.5}
            zBase={-24 + i * 2.1}
            span={46}
            speed={travelSpeed * 1.15}
            scale={[0.35, 1.4 + (i % 3) * 0.35, 0.35]}
            color="#334155"
            emissive="#60a5fa"
            opacity={0.42}
          />
          <MovingLane
            x={4 - (i % 4) * 0.6}
            y={-1.5}
            zBase={-25 + i * 2.1}
            span={46}
            speed={travelSpeed * 1.15}
            scale={[0.35, 1.4 + (i % 3) * 0.35, 0.35]}
            color="#334155"
            emissive="#93c5fd"
            opacity={0.42}
          />
        </React.Fragment>
      ))}

      {skin === 'garden' && laneSeeds.map((i) => (
        <React.Fragment key={`beacon_${i}`}>
          <MovingLane
            x={-3.5 + (i % 5) * 1.4}
            y={-1.55}
            zBase={-20 + i * 2.6}
            span={44}
            speed={travelSpeed * 0.85}
            scale={[0.14, 0.7 + (i % 2) * 0.35, 0.14]}
            color="#166534"
            emissive="#fef08a"
            opacity={0.46}
          />
        </React.Fragment>
      ))}

      {starPositions.map((position, idx) => (
        <mesh key={`bg_star_${idx}`} position={position}>
          <sphereGeometry args={[
            skin === 'inner'
              ? (0.03 + (idx % 3) * 0.004)
              : (0.015 + (idx % 4) * 0.004),
            8,
            8
          ]} />
          <meshStandardMaterial color={palette.bgColor} emissive={palette.bgEmissive} emissiveIntensity={0.06} transparent opacity={0.28} />
        </mesh>
      ))}

      <mesh>
        <sphereGeometry args={[0.21, 14, 14]} />
        <meshStandardMaterial color={centerUnlocked ? palette.centerColor : '#94a3b8'} emissive={centerUnlocked ? palette.centerEmissive : '#475569'} emissiveIntensity={0.24} />
      </mesh>
      <mesh position={[activePosition[0] / 2, activePosition[1] / 2, activePosition[2] / 2]}>
        <cylinderGeometry args={[0.01, 0.01, Math.hypot(activePosition[0], activePosition[1], activePosition[2]), 8]} />
        <meshStandardMaterial color={palette.routeColor} transparent opacity={0.16} />
      </mesh>

      {edgePairs.map((edge) => {
        const from = getNode(edge.from);
        const to = getNode(edge.to);
        if (!from || !to) return null;
        const mx = (from.position[0] + to.position[0]) / 2;
        const my = (from.position[1] + to.position[1]) / 2;
        const mz = (from.position[2] + to.position[2]) / 2;
        return (
          <mesh key={`${edge.from}-${edge.to}`} position={[mx, my, mz]}>
            <cylinderGeometry args={[0.01, 0.01, Math.hypot(from.position[0] - to.position[0], from.position[1] - to.position[1], from.position[2] - to.position[2]), 8]} />
            <meshStandardMaterial color="#334155" opacity={0.25} transparent />
          </mesh>
        );
      })}

      {displayNodes.map((node) => {
        const isActive = node.id === activeId;
        const radius = 0.16 + (node.score / 100) * 0.16 + (isActive ? 0.04 : 0);
        return (
          <mesh
            key={node.id}
            position={node.position}
            onClick={() => {
              setActiveLegacy(node.id);
              onSelectNode?.(node.id);
            }}
            onPointerOver={(event) => {
              if (event?.stopPropagation) event.stopPropagation();
              if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              if (typeof document !== 'undefined') document.body.style.cursor = 'auto';
            }}
          >
            <sphereGeometry args={[radius, 18, 18]} />
            <meshStandardMaterial
              color={node.color}
              emissive={node.color}
              emissiveIntensity={isActive ? 0.35 : 0.16}
              opacity={0.82}
              transparent
            />
          </mesh>
        );
      })}

      <group ref={shipRef} position={[0, 0, 0]}>
        <mesh>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color={palette.centerColor} emissive={palette.accent} emissiveIntensity={0.15} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.01, 8, 48]} />
          <meshStandardMaterial color={palette.ringColor} emissive={palette.bgEmissive} emissiveIntensity={0.1} transparent opacity={0.58} />
        </mesh>
      </group>

      <mesh rotation={[0, 0.35, 0]} onClick={() => centerUnlocked && onSelectCenter?.()}>
        <torusGeometry args={[3.2, 0.05, 12, 120]} />
        <meshStandardMaterial color={activeNode?.color || '#22d3ee'} emissive={activeNode?.color || '#22d3ee'} emissiveIntensity={0.16} opacity={0.8} transparent />
      </mesh>
    </group>
  );
};

export default NebulaQuestScene;
