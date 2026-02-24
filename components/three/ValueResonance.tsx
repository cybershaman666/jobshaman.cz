import React from 'react';
import { CultureResonanceFrame } from '../../types';

interface Props {
  frame: CultureResonanceFrame | null;
}

const ValueResonance: React.FC<Props> = ({ frame }) => {
  const match = frame?.match ?? 0;
  const hue = Math.round((match / 100) * 120);
  const scale = 1 + (match / 100) * 0.25;
  const color = `hsl(${hue}, 80%, 55%)`;

  return (
    <group scale={[scale, scale, scale]}>
      <mesh rotation={[0.6, 0.4, 0.2]}>
        <icosahedronGeometry args={[1.4, 0]} />
        <meshStandardMaterial color={color} roughness={0.15} metalness={0.4} />
      </mesh>
      <mesh rotation={[-0.2, 0.8, 0]}>
        <torusGeometry args={[2.1, 0.06, 12, 80]} />
        <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
};

export default ValueResonance;

