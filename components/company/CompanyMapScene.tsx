import React from 'react';

import CompanyGalaxyMapShell, {
  type CompanyGalaxyMapBreadcrumb,
  type CompanyGalaxyMapLayer,
  type CompanyGalaxyMapNode,
} from './CompanyGalaxyMapShell';

interface CompanyMapSceneProps {
  locale?: string;
  kicker: string;
  title: string;
  subtitle: string;
  center: {
    eyebrow?: string;
    name: string;
    motto: string;
    tone?: string;
    logoUrl?: string | null;
    statusLine?: string;
    values?: string[];
    promptLabel?: string;
    promptPlaceholder?: string;
    promptValue?: string;
    promptActionLabel?: string;
    onPromptAction?: () => void;
  };
  layers: CompanyGalaxyMapLayer[];
  nodes: CompanyGalaxyMapNode[];
  workspaceBreadcrumbs?: CompanyGalaxyMapBreadcrumb[];
  detailPanel?: React.ReactNode;
  lowerContent?: React.ReactNode;
  topActions?: React.ReactNode;
  zoom: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
}

const CompanyMapScene: React.FC<CompanyMapSceneProps> = ({
  locale,
  kicker,
  title,
  subtitle,
  center,
  layers,
  nodes,
  workspaceBreadcrumbs = [],
  detailPanel,
  lowerContent,
  topActions,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}) => (
  <CompanyGalaxyMapShell
    mode="workspace"
    locale={locale}
    kicker={kicker}
    title={title}
    subtitle={subtitle}
    center={center}
    layers={layers}
    nodes={nodes}
    workspaceBreadcrumbs={workspaceBreadcrumbs}
    detailPanel={detailPanel}
    lowerContent={lowerContent}
    zoom={zoom}
    onZoomIn={onZoomIn}
    onZoomOut={onZoomOut}
    onZoomReset={onZoomReset}
    topActions={topActions}
  />
);

export type {
  CompanyGalaxyMapBreadcrumb,
  CompanyGalaxyMapLayer,
  CompanyGalaxyMapNode,
};

export default CompanyMapScene;
