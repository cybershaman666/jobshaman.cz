import React from 'react';
import { HappinessAuditOutput } from '../../types';

interface Props {
  output: HappinessAuditOutput | null;
}

const CareerAnchorDrift: React.FC<Props> = ({ output }) => {
  const drift = output?.drift_score ?? 50;
  const waveHeight = Math.max(0.05, Math.min(0.35, drift / 250));
  const shipY = drift > 65 ? -0.1 : 0.12;

  return (
    <group>
      <mesh position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 3, 20, 20]} />
        <meshStandardMaterial color={drift > 65 ? '#1e3a8a' : '#0ea5e9'} wireframe />
      </mesh>
      <mesh position={[0, shipY + waveHeight, 0]}>
        <coneGeometry args={[0.35, 0.8, 8]} />
        <meshStandardMaterial color={drift > 65 ? '#f97316' : '#14b8a6'} />
      </mesh>
    </group>
  );
};

export default CareerAnchorDrift;
