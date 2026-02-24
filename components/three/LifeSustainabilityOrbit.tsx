import React from 'react';
import { HappinessAuditOutput } from '../../types';

interface Props {
  output: HappinessAuditOutput | null;
}

const LifeSustainabilityOrbit: React.FC<Props> = ({ output }) => {
  const timeRing = output?.time_ring ?? 0;
  const energyRing = output?.energy_ring ?? 0;
  const stress = Math.max(timeRing, energyRing);

  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color={stress > 70 ? '#f97316' : '#22d3ee'} roughness={0.35} />
      </mesh>
      <mesh rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[1.65, 0.06, 12, 90]} />
        <meshStandardMaterial color={timeRing > 70 ? '#ef4444' : '#f59e0b'} />
      </mesh>
      <mesh rotation={[Math.PI / 5, 0.7, 0]}>
        <torusGeometry args={[2.05, 0.08, 12, 90]} />
        <meshStandardMaterial color={energyRing > 70 ? '#ef4444' : '#22c55e'} />
      </mesh>
    </group>
  );
};

export default LifeSustainabilityOrbit;

