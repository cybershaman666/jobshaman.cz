import React, { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Points } from 'three';

interface Props {
  qualityTier?: 'low' | 'medium' | 'high';
  interactive?: boolean;
}

const JcfpmElegantParticles: React.FC<Props> = ({ qualityTier = 'medium', interactive = true }) => {
  const pointsRef = useRef<Points>(null);
  useThree();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Determine particle count based on quality
  const count = qualityTier === 'high' ? 480 : qualityTier === 'medium' ? 320 : 180;

  const { positions, speeds, colors } = useMemo(() => {
    const positionsData = new Float32Array(count * 3);
    const speedsData = new Float32Array(count);
    const colorsData = new Float32Array(count * 3);

    // Indigo color palette: #4f46e5, #6366f1, #818cf8
    const colors_palette = [
      [0.31, 0.27, 0.90], // #4f46e5
      [0.39, 0.40, 0.95], // #6366f1
      [0.51, 0.55, 0.97], // #818cf8
    ];

    for (let i = 0; i < count; i += 1) {
      const idx = i * 3;
      const colorIdx = i % colors_palette.length;
      
      // Create particles in a wider/deeper range for more ambient feel
      positionsData[idx] = (Math.random() - 0.5) * 14;
      positionsData[idx + 1] = (Math.random() - 0.5) * 10;
      positionsData[idx + 2] = (Math.random() - 0.5) * 6;
      
      // Vary speeds more for interesting motion
      speedsData[i] = 0.02 + Math.random() * 0.12;
      
      // Assign colors from palette
      colorsData[idx] = colors_palette[colorIdx][0];
      colorsData[idx + 1] = colors_palette[colorIdx][1];
      colorsData[idx + 2] = colors_palette[colorIdx][2];
    }

    return { positions: positionsData, speeds: speedsData, colors: colorsData };
  }, [count]);

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
