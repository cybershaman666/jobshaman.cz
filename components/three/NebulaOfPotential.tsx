import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AssessmentSignalFrame } from '../../types';

interface Props {
  frame: AssessmentSignalFrame | null;
}

const NebulaOfPotential: React.FC<Props> = ({ frame }) => {
  const stars = useMemo(() => {
    const count = Math.max(12, (frame?.unlocked_skills.length || 0) * 6);
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 6,
      y: (Math.random() - 0.5) * 4,
      z: (Math.random() - 0.5) * 3,
      size: 0.03 + Math.random() * 0.05,
    }));
  }, [frame?.unlocked_skills.length]);

  useFrame((state) => {
    state.camera.position.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.2;
  });

  return (
    <group>
      {stars.map((star) => (
        <mesh key={star.id} position={[star.x, star.y, star.z]}>
          <sphereGeometry args={[star.size, 8, 8]} />
          <meshStandardMaterial color="#22d3ee" emissive="#0e7490" emissiveIntensity={0.6} />
        </mesh>
      ))}
      <mesh>
        <torusGeometry args={[2.3, 0.08, 10, 64]} />
        <meshStandardMaterial color="#06b6d4" wireframe opacity={0.5} transparent />
      </mesh>
    </group>
  );
};

export default NebulaOfPotential;

