import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ThreeSceneCapability } from '../../types';

interface SceneShellProps {
  capability: ThreeSceneCapability;
  fallback: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  enableControls?: boolean;
  glide?: boolean;
  glideIntensity?: number;
}

const CameraGlide: React.FC<{ intensity: number }> = ({ intensity }) => {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    const tx = Math.sin(t * 0.22) * intensity;
    const ty = Math.cos(t * 0.17) * intensity * 0.55;
    camera.position.x += (tx - camera.position.x) * 0.015;
    camera.position.y += (ty - camera.position.y) * 0.015;
    camera.lookAt(0, 0, 0);
  });
  return null;
};

const SceneShell: React.FC<SceneShellProps> = ({
  capability,
  fallback,
  children,
  className,
  enableControls = false,
  glide = false,
  glideIntensity = 0.24,
}) => {
  const [contextLost, setContextLost] = useState(false);
  const [hasSize, setHasSize] = useState(true);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = shellRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setHasSize(rect.width > 8 && rect.height > 8);
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const canRenderScene = capability.webgl && !capability.reducedMotion && !contextLost && hasSize;

  return (
    <div ref={shellRef} className={className || 'h-52 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800'}>
      {!canRenderScene ? (
        <>{fallback}</>
      ) : (
        <Canvas
          camera={{ position: [0, 0, 12], fov: 58 }}
          dpr={capability.qualityTier === 'high' ? [1.5, 2] : [1.25, 1.75]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          style={{ width: '100%', height: '100%' }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement;
            const onLost = (event: Event) => {
              event.preventDefault();
              setContextLost(true);
            };
            canvas.addEventListener('webglcontextlost', onLost, { once: true });
          }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 2, 3]} intensity={0.9} />
          {glide && <CameraGlide intensity={glideIntensity} />}
          {children}
          {enableControls && (
            <OrbitControls
              enablePan={false}
              enableZoom={false}
              autoRotate
              autoRotateSpeed={0.6}
            />
          )}
        </Canvas>
      )}
    </div>
  );
};

export default SceneShell;
