import React from 'react';

interface Props {
  alignmentScore: number;
  individualVsTeam: number;
  chaosVsStructure: number;
}

const CulturalNorthstarCompass: React.FC<Props> = ({
  alignmentScore,
  individualVsTeam,
  chaosVsStructure,
}) => {
  const angle = (((individualVsTeam + chaosVsStructure) / 2) / 100) * Math.PI * 2;
  const needleColor = alignmentScore >= 75 ? '#22c55e' : alignmentScore >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.9, 48]} />
        <meshStandardMaterial color="#0ea5e9" opacity={0.75} transparent />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 48]} />
        <meshStandardMaterial color="#0f172a" opacity={0.85} transparent />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, -angle]}>
        <coneGeometry args={[0.08, 1.25, 12]} />
        <meshStandardMaterial color={needleColor} emissive={needleColor} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
    </group>
  );
};

export default CulturalNorthstarCompass;

