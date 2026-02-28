import React, { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Points } from 'three';

interface Props {
  qualityTier?: 'low' | 'medium' | 'high';
  interactive?: boolean;
  dimensionId?: string;
}

const PALETTES: Record<string, number[][]> = {
  default: [[0.31, 0.27, 0.90], [0.39, 0.40, 0.95], [0.51, 0.55, 0.97]], // Indigo
  d1_cognitive: [[0.06, 0.72, 0.50], [0.10, 0.85, 0.60], [0.20, 0.90, 0.70]], // Emerald
  d2_social: [[0.85, 0.35, 0.60], [0.95, 0.45, 0.70], [0.98, 0.55, 0.80]], // Rose/Pink
  d3_motivational: [[0.95, 0.75, 0.10], [0.98, 0.85, 0.20], [1.00, 0.95, 0.40]], // Amber/Gold
  d4_energy: [[1.00, 0.40, 0.10], [1.00, 0.50, 0.20], [1.00, 0.65, 0.40]], // Orange/Tomato
  d5_values: [[0.55, 0.25, 0.90], [0.65, 0.35, 0.95], [0.75, 0.45, 0.98]], // Purple/Violet
  d6_ai_readiness: [[0.10, 0.65, 0.90], [0.20, 0.75, 0.95], [0.40, 0.85, 1.00]], // Sky/Cyan
  deep_dive: [[0.10, 0.10, 0.25], [0.15, 0.15, 0.40], [0.20, 0.20, 0.60]], // Deep Blue/Navy
};

const JcfpmElegantParticles: React.FC<Props> = ({ qualityTier = 'medium', interactive = true, dimensionId }) => {
  const pointsRef = useRef<Points>(null);
  useThree();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Determine particle count based on quality
  const count = qualityTier === 'high' ? 480 : qualityTier === 'medium' ? 320 : 180;

  const { positions, speeds, colors } = useMemo(() => {
    const positionsData = new Float32Array(count * 3);
    const speedsData = new Float32Array(count);
    const colorsData = new Float32Array(count * 3);

    const palette = PALETTES[dimensionId || 'default'] || PALETTES.default;

    for (let i = 0; i < count; i += 1) {
      const idx = i * 3;
      const colorIdx = i % palette.length;

      // Create particles in a wider/deeper range for more ambient feel
      positionsData[idx] = (Math.random() - 0.5) * 14;
      positionsData[idx + 1] = (Math.random() - 0.5) * 10;
      positionsData[idx + 2] = (Math.random() - 0.5) * 6;

      // Vary speeds more for interesting motion
      speedsData[i] = 0.02 + Math.random() * 0.12;

      // Assign colors from palette
      colorsData[idx] = palette[colorIdx][0];
      colorsData[idx + 1] = palette[colorIdx][1];
      colorsData[idx + 2] = palette[colorIdx][2];
    }

    return { positions: positionsData, speeds: speedsData, colors: colorsData };
  }, [count, dimensionId]);

  // Update mouse position for interactivity
  React.useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (event: MouseEvent) => {
      setMousePos({
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [interactive]);

  useFrame(({ clock }, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    const attr = points.geometry.attributes.position;
    const arr = attr.array as Float32Array;
    const t = clock.getElapsedTime();

    for (let i = 0; i < count; i += 1) {
      const idx = i * 3;

      // Upward movement
      arr[idx + 1] += speeds[i] * delta;

      // Horizontal drift with multiple sine waves for organic motion
      arr[idx] += Math.sin(t * 0.12 + i * 0.4) * 0.0012;
      arr[idx + 2] += Math.cos(t * 0.15 + i * 0.35) * 0.0008;

      // Mouse attraction if interactive (optional soft pull)
      if (interactive && mousePos.x !== 0 && mousePos.y !== 0) {
        const distX = mousePos.x - (arr[idx] / 8);
        const distY = mousePos.y - (arr[idx + 1] / 6);
        const distance = Math.sqrt(distX * distX + distY * distY);

        if (distance < 3) {
          arr[idx] += distX * 0.0002;
          arr[idx + 1] += distY * 0.0002;
        }
      }

      // Wrap around at top and bottom
      if (arr[idx + 1] > 5) {
        arr[idx + 1] = -5;
        arr[idx] = (Math.random() - 0.5) * 14;
        arr[idx + 2] = (Math.random() - 0.5) * 6;
      }
    }

    attr.needsUpdate = true;

    // Gentle overall rotation
    points.rotation.z = Math.sin(t * 0.06) * 0.02;
    points.rotation.x = Math.cos(t * 0.08) * 0.01;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={qualityTier === 'low' ? 0.025 : qualityTier === 'high' ? 0.045 : 0.035}
        sizeAttenuation
        transparent
        opacity={qualityTier === 'low' ? 0.35 : qualityTier === 'high' ? 0.48 : 0.42}
        depthWrite={false}
        vertexColors
        fog={false}
      />
    </points>
  );
};

export default JcfpmElegantParticles;
