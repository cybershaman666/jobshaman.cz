import React from 'react';

interface GalaxyWorkspaceViewportProps {
  className?: string;
  background?: React.ReactNode;
  stage: React.ReactNode;
  overlays?: React.ReactNode;
}

const GalaxyWorkspaceViewport: React.FC<GalaxyWorkspaceViewportProps> = ({
  className,
  background,
  stage,
  overlays,
}) => (
  <div className={className}>
    {background}
    <div className="absolute inset-0">{stage}</div>
    {overlays}
  </div>
);

export default GalaxyWorkspaceViewport;
