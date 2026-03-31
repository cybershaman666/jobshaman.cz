import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Minus, Plus, Sparkles } from 'lucide-react';

import { cn } from '../ui/primitives';
import GalaxyWorkspaceViewport from '../galaxy/GalaxyWorkspaceViewport';
import { GalaxyClusterNode, GalaxyStageBackground, galaxyShellPanelClass, type GalaxyClusterNodeTone } from '../galaxy/GalaxyShellPrimitives';
import { GalaxyCanvasControls, GalaxyLayerSidebar } from '../galaxy/GalaxyWorkspaceChrome';
import CompanyGalaxyBackdrop from './CompanyGalaxyBackdrop';
import { companyMapText, resolveCompanyMapLocale } from './companyMapLocale';

export interface CompanyGalaxyMapLayer {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onClick?: () => void;
}

export interface CompanyGalaxyMapBreadcrumb {
  id: string;
  label: string;
  onClick?: () => void;
}

export interface CompanyGalaxyMapNode {
  id: string;
  label: string;
  narrative: string;
  count?: number;
  x: number;
  y: number;
  accent?: 'core' | 'accent' | 'muted';
  tone?: GalaxyClusterNodeTone;
  active?: boolean;
  secondaryLabel?: string;
  icon?: React.ReactNode;
  imageUrl?: string | null;
  onClick?: () => void;
}

interface CompanyGalaxyMapShellProps {
  mode?: 'workspace' | 'public' | 'landing';
  locale?: string;
  kicker?: string;
  title?: string;
  subtitle?: string;
  center: {
    name: string;
    motto: string;
    tone?: string;
    logoUrl?: string | null;
    statusLine?: string;
    values?: string[];
  };
  layers?: CompanyGalaxyMapLayer[];
  nodes: CompanyGalaxyMapNode[];
  detailPanel?: React.ReactNode;
  lowerContent?: React.ReactNode;
  topActions?: React.ReactNode;
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  workspaceBreadcrumbs?: CompanyGalaxyMapBreadcrumb[];
}

const panelClass = galaxyShellPanelClass;
const stageRadiusX = 620;
const stageRadiusY = 360;
const toneLineColor: Record<GalaxyClusterNodeTone, string> = {
  emerald: '#10b981',
  orange: '#f59e0b',
  blue: '#60a5fa',
  slate: '#94a3b8',
};

const centerInitials = (value: string): string => {
  const parts = String(value || 'JS').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'JS';
};

const toStageCoordinates = (node: CompanyGalaxyMapNode) => ({
  x: ((node.x - 50) / 50) * stageRadiusX,
  y: ((node.y - 50) / 50) * stageRadiusY,
});

const CompanyGalaxyMapShell: React.FC<CompanyGalaxyMapShellProps> = ({
  mode = 'workspace',
  locale: localeInput,
  kicker,
  title,
  subtitle,
  center,
  layers = [],
  nodes,
  detailPanel,
  lowerContent,
  topActions,
  zoom = 1,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  workspaceBreadcrumbs = [],
}) => {
  const locale = resolveCompanyMapLocale(localeInput);
  const text = (variants: Parameters<typeof companyMapText>[1]) => companyMapText(locale, variants);
  const layerCount = layers.length;
  const hasToolbar = Boolean(onZoomIn || onZoomOut || layerCount > 0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (mode !== 'workspace' || (!onZoomIn && !onZoomOut)) return;
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect) {
      const nextX = ((event.clientX - rect.left) / rect.width) * 100;
      const nextY = ((event.clientY - rect.top) / rect.height) * 100;
      setZoomOrigin({
        x: Math.max(0, Math.min(100, nextX)),
        y: Math.max(0, Math.min(100, nextY)),
      });
    }
    if (event.deltaY < 0) {
      onZoomIn?.();
    } else {
      onZoomOut?.();
    }
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'workspace') return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, [data-map-control="true"]')) {
      return;
    }
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: canvasOffset.x,
      originY: canvasOffset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    setCanvasOffset({
      x: dragState.originX + (event.clientX - dragState.startX),
      y: dragState.originY + (event.clientY - dragState.startY),
    });
  };

  const handleCanvasPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const hasContentLayer = Boolean(lowerContent);
  useEffect(() => {
    if (mode !== 'workspace') return;
    setSidebarCollapsed(hasContentLayer);
  }, [hasContentLayer, mode]);

  const workspaceCanvasInsetClass = 'absolute inset-0';
  const workspaceLeadOffsetClass = sidebarCollapsed ? 'lg:left-[8.5rem]' : 'lg:left-[20.5rem]';
  const workspaceContentInsetClass = cn(
    'absolute bottom-6 top-24 z-[68] hidden overflow-hidden lg:block',
    sidebarCollapsed ? 'left-[8.5rem]' : 'left-[20.5rem]',
    'right-6',
  );
  const stageNodes = useMemo(
    () => nodes.map((node, index) => {
      const position = toStageCoordinates(node);
      const orbitDistance = Math.max(164, Math.hypot(position.x, position.y));
      const gravityPull = node.active ? 0.98 : node.accent === 'core' ? 0.88 : node.accent === 'accent' ? 0.76 : 0.62;

      return {
        ...node,
        stageX: position.x,
        stageY: position.y,
        orbitDistance,
        gravityPull,
        floatX: (index % 2 === 0 ? 1 : -1) * (3.5 + gravityPull * 3.2),
        floatY: (index % 3 === 0 ? -1 : 1) * (2.8 + gravityPull * 2.4),
      };
    }),
    [nodes],
  );
  const orbitGuides = useMemo(
    () =>
      stageNodes
        .map((node) => ({
          id: node.id,
          orbitDistance: Math.round(node.orbitDistance / 18) * 18,
          gravityPull: node.gravityPull,
          active: Boolean(node.active),
        }))
        .sort((left, right) => left.orbitDistance - right.orbitDistance),
    [stageNodes],
  );
  const layerSidebarItems = layers.map((layer) => ({
    id: layer.id,
    label: layer.label,
    icon: layer.icon,
    active: layer.active,
    onClick: layer.onClick,
  }));

  const mapCanvas = (
    <div
      ref={stageRef}
      className={cn(
        'relative overflow-hidden',
        mode === 'workspace'
          ? 'h-full w-full cursor-grab overscroll-none active:cursor-grabbing'
          : 'rounded-[30px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(247,251,255,0.94),rgba(238,246,251,0.94))] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.95),rgba(15,23,42,0.94))]',
      )}
      onWheel={handleCanvasWheel}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerEnd}
      onPointerCancel={handleCanvasPointerEnd}
    >
      <div className={cn('relative overflow-hidden', mode === 'workspace' ? 'h-full min-h-0' : 'min-h-[620px] sm:min-h-[700px]')}>
        <div
          className="absolute inset-0 transition-transform duration-300"
          style={{
            transform: mode === 'workspace'
              ? `translate3d(${canvasOffset.x}px, ${canvasOffset.y}px, 0) scale(${zoom})`
              : `scale(${zoom})`,
            transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="-900 -560 1800 1120">
              <defs>
                <filter id="company-path-line-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            {orbitGuides.map((orbit, index) => (
              <circle
                key={`orbit-${orbit.id}`}
                cx="0"
                cy="0"
                r={orbit.orbitDistance}
                fill="none"
                stroke={orbit.active ? 'rgba(34,211,238,0.32)' : 'rgba(148,163,184,0.16)'}
                strokeWidth={orbit.active ? '1.3' : '0.9'}
                strokeDasharray={orbit.active ? '5 10' : '4 12'}
                opacity={Math.max(0.18, 0.42 - index * 0.05 + orbit.gravityPull * 0.08)}
              />
            ))}
            {stageNodes.map((node) => {
              const active = Boolean(node.active);
              const distance = Math.hypot(node.stageX, node.stageY) || 1;
              const dx = node.stageX / distance;
              const dy = node.stageY / distance;
              const resolvedTone: GalaxyClusterNodeTone = node.tone || (node.accent === 'core' ? 'emerald' : node.accent === 'accent' ? 'blue' : 'slate');
              const lineColor = toneLineColor[resolvedTone];
              const lineOpacity = Math.min(0.36, 0.12 + node.gravityPull * 0.14);
              const pulseOpacity = Math.min(0.92, 0.34 + node.gravityPull * 0.44);
              const baseStrokeWidth = 1 + node.gravityPull * 0.55;
              const pulseStrokeWidth = 1.6 + node.gravityPull * 1.15;

              return (
                <g key={`guide-${node.id}`}>
                  <line
                    x1={dx * 88}
                    y1={dy * 88}
                    x2={dx * (distance - 56)}
                    y2={dy * (distance - 56)}
                    stroke={lineColor}
                    strokeWidth={active ? baseStrokeWidth + 0.3 : baseStrokeWidth}
                    opacity={active ? lineOpacity + 0.08 : lineOpacity}
                  />
                  <circle
                    cx={node.stageX}
                    cy={node.stageY}
                    r={active ? '18' : '11'}
                    fill={active ? 'rgba(56,189,248,0.14)' : 'rgba(255,255,255,0.14)'}
                    style={active ? { animation: 'careeros-route-pulse 1.6s ease-in-out infinite' } : undefined}
                  />
                  <line
                    x1={dx * 88}
                    y1={dy * 88}
                    x2={dx * (distance - 56)}
                    y2={dy * (distance - 56)}
                    stroke={lineColor}
                    strokeWidth={active ? pulseStrokeWidth + 0.35 : pulseStrokeWidth}
                    strokeDasharray="8 8"
                    filter="url(#company-path-line-glow)"
                    opacity={active ? Math.min(0.98, pulseOpacity + 0.08) : pulseOpacity}
                    style={{ animation: 'careeros-dash-flow 4s linear infinite' }}
                  />
                  <circle
                    cx={node.stageX}
                    cy={node.stageY}
                    r={active ? '8' : '5.5'}
                    fill={active ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.82)'}
                    style={active ? { animation: 'careeros-route-pulse 1.6s ease-in-out infinite' } : undefined}
                  />
                </g>
              );
            })}
            </svg>

            <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
              <div className="flex flex-col items-center">
                <div className="pointer-events-none absolute inset-[-110px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.2),rgba(34,211,238,0.08),transparent_74%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(255,255,255,0.04),rgba(34,211,238,0.08),transparent_74%)]" />
                <div className="pointer-events-none absolute inset-[-52px] rounded-full border border-cyan-200/20 dark:border-cyan-400/15" />
                <div className="relative flex h-[132px] w-[132px] items-center justify-center rounded-full border border-cyan-500/30 bg-white shadow-[inset_0_0_22px_rgba(8,145,178,0.12),0_10px_40px_rgba(8,145,178,0.18)] backdrop-blur-xl dark:border-cyan-500/30 dark:bg-slate-950/90 dark:shadow-[inset_0_0_22px_rgba(8,145,178,0.18),0_10px_40px_rgba(8,145,178,0.16)]">
                  <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-cyan-500/10 to-emerald-500/10 blur-md" />
                  <div className="relative z-10 h-[106px] w-[106px] overflow-hidden rounded-full border-2 border-white shadow-md dark:border-slate-800">
                    {center.logoUrl ? (
                      <img src={center.logoUrl} alt={center.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-cyan-50 text-3xl font-semibold tracking-[0.18em] text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-100">
                        {centerInitials(center.name)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 w-[min(24rem,88vw)] rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-center shadow-lg backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/88 dark:shadow-[0_24px_64px_rgba(2,6,23,0.45)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                    {text({
                      cs: 'Jádro firmy',
                      sk: 'Jadro firmy',
                      en: 'Company Core',
                      de: 'Unternehmenskern',
                      pl: 'Rdzeń firmy',
                    })}
                  </div>
                  <div className="mt-2 text-[22px] font-bold tracking-[-0.04em] text-slate-900 dark:text-slate-100">
                    {center.name}
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-slate-600 dark:text-slate-300">
                    {center.motto}
                  </p>
                  {center.statusLine ? (
                    <div className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {center.statusLine}
                    </div>
                  ) : null}
                  {(center.values?.length || center.tone) ? (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {(center.values || []).slice(0, 3).map((value) => (
                        <span
                          key={value}
                          className="rounded-full border border-cyan-100/80 bg-cyan-50/90 px-3 py-1 text-[11px] font-semibold text-cyan-900 dark:border-cyan-900/50 dark:bg-cyan-950/50 dark:text-cyan-200"
                        >
                          {value}
                        </span>
                      ))}
                      {center.tone ? (
                        <span className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/78 dark:text-slate-300">
                          {center.tone}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {stageNodes.map((node, index) => {
              const active = Boolean(node.active);
              const restingScale = active ? 1.02 : 0.92 + node.gravityPull * 0.06;
              const elevatedScale = active ? 1.08 : restingScale;
              const driftStyle = {
                '--careeros-float-x': `${node.floatX * 0.6}px`,
                '--careeros-float-y': `${node.floatY * 0.55}px`,
                animation: `careeros-node-float ${15 + index * 0.55}s ease-in-out ${-(index % 5) * 0.6}s infinite`,
                willChange: 'transform',
              } as React.CSSProperties & Record<'--careeros-float-x' | '--careeros-float-y', string>;

              return (
                <div key={node.id} className="absolute left-1/2 top-1/2 z-20" style={{ transform: 'translate(-50%, -50%)' }}>
                  <div
                    className="relative flex flex-col items-center transform-gpu"
                    style={{
                      transform: `translate3d(${node.stageX}px, ${node.stageY}px, 0) scale(${elevatedScale})`,
                      opacity: active ? 1 : 0.9,
                      transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease-out',
                      willChange: 'transform, opacity',
                    }}
                  >
                    <div className="relative flex flex-col items-center" style={driftStyle}>
                      <GalaxyClusterNode
                        title={node.label}
                        eyebrow={node.secondaryLabel || text({
                          cs: 'Cluster výzvy',
                          sk: 'Cluster výzvy',
                          en: 'Challenge cluster',
                          de: 'Challenge-Cluster',
                          pl: 'Klaster wyzwania',
                        })}
                        description={node.narrative}
                        count={node.count}
                        active={active}
                        elevated={active}
                        tone={node.tone || (node.accent === 'core' ? 'emerald' : node.accent === 'accent' ? 'blue' : 'slate')}
                        onClick={node.onClick}
                        dataMapControl
                        media={
                          node.imageUrl ? (
                            <img src={node.imageUrl} alt={node.label} className="h-full w-full object-cover" />
                          ) : node.icon ? (
                            <div className="text-slate-800 dark:text-slate-100">
                              {node.icon}
                            </div>
                          ) : (
                            <span className="text-lg font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100">
                              {centerInitials(node.label)}
                            </span>
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  if (mode === 'workspace') {
    const stageNode = (
      <div className="relative h-full w-full">
        <div className="relative h-full overflow-hidden">
          <div className={workspaceCanvasInsetClass}>
            {mapCanvas}
          </div>
        </div>
      </div>
    );

    const overlayNodes = (
      <>
        {workspaceBreadcrumbs.length > 0 ? (
          <div className={cn('absolute top-7 z-[80] hidden items-center gap-2 xl:flex', workspaceLeadOffsetClass)}>
            <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/82 dark:text-slate-300">
              {workspaceBreadcrumbs.map((item, index) => (
                <React.Fragment key={item.id}>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={cn('transition hover:text-cyan-700 dark:hover:text-cyan-300', index === workspaceBreadcrumbs.length - 1 ? 'text-slate-900 dark:text-slate-100' : '')}
                  >
                    {item.label}
                  </button>
                  {index < workspaceBreadcrumbs.length - 1 ? <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> : null}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : null}

        <div className="absolute left-6 right-6 top-6 z-[82] flex flex-wrap items-center gap-2 lg:hidden">
          {workspaceBreadcrumbs.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/70 bg-white/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/82 dark:text-slate-300">
              {workspaceBreadcrumbs.map((item, index) => (
                <React.Fragment key={item.id}>
                  <button type="button" onClick={item.onClick} className={cn('transition hover:text-cyan-700 dark:hover:text-cyan-300', index === workspaceBreadcrumbs.length - 1 ? 'text-slate-900 dark:text-slate-100' : '')}>
                    {item.label}
                  </button>
                  {index < workspaceBreadcrumbs.length - 1 ? <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> : null}
                </React.Fragment>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {layers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={layer.onClick}
                className={cn(
                  'rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur-md transition',
                  layer.active
                    ? 'border-cyan-300/70 bg-cyan-50/95 text-cyan-900 dark:border-cyan-500/50 dark:bg-cyan-950/60 dark:text-cyan-200'
                    : 'border-white/70 bg-white/88 text-slate-600 hover:border-cyan-200/70 hover:text-cyan-800 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-slate-300 dark:hover:border-cyan-500/50 dark:hover:text-cyan-200',
                )}
              >
                {layer.label}
              </button>
            ))}
          </div>
          {topActions ? (
            <div className="flex flex-wrap items-center gap-2">
              {topActions}
            </div>
          ) : null}
        </div>

        <div className="absolute left-6 top-6 z-[82] hidden lg:flex lg:flex-col lg:gap-4">
          <GalaxyLayerSidebar
            title={text({
              cs: 'Firemní mapa',
              sk: 'Firemná mapa',
              en: 'Company Map',
              de: 'Unternehmenskarte',
              pl: 'Mapa firmy',
            })}
            subtitle={kicker || text({
              cs: 'Vrstvy workspace',
              sk: 'Vrstvy workspace',
              en: 'Workspace layers',
              de: 'Workspace-Ebenen',
              pl: 'Warstwy workspace',
            })}
            collapsed={sidebarCollapsed}
            setCollapsed={setSidebarCollapsed}
            items={layerSidebarItems}
          />

          {topActions && !sidebarCollapsed ? (
            <div className={cn(panelClass, 'w-72 rounded-[26px] p-3')}>
              <div className="flex flex-col gap-2">
                {topActions}
              </div>
            </div>
          ) : null}
        </div>

        {(onZoomIn || onZoomOut) ? (
          <GalaxyCanvasControls
            zoom={zoom}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onReset={onZoomReset}
            className="absolute bottom-6 left-6 z-[32] w-auto"
          />
        ) : null}

        {detailPanel ? (
          <div className="pointer-events-none absolute right-6 top-6 z-[32] hidden min-w-[240px] max-w-[290px] lg:block">
            <div className="pointer-events-auto rounded-[18px] border border-white/70 bg-white/92 px-4 py-3 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/90 dark:shadow-[0_30px_90px_-40px_rgba(2,6,23,0.82)]">
              {detailPanel}
            </div>
          </div>
        ) : null}

        {hasContentLayer ? (
          <section className={workspaceContentInsetClass}>
            <div className={cn(panelClass, 'flex h-full flex-col overflow-hidden rounded-[30px]')}>
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-6 py-4 dark:border-slate-800/80">
                <div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {workspaceBreadcrumbs[workspaceBreadcrumbs.length - 1]?.label || kicker || text({
                      cs: 'Firemní mapa',
                      sk: 'Firemná mapa',
                      en: 'Company map',
                      de: 'Unternehmenskarte',
                      pl: 'Mapa firmy',
                    })}
                  </div>
                </div>
                {workspaceBreadcrumbs.length > 1 ? (
                  <button
                    type="button"
                    onClick={workspaceBreadcrumbs[workspaceBreadcrumbs.length - 2]?.onClick}
                    className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200"
                  >
                    {workspaceBreadcrumbs[workspaceBreadcrumbs.length - 2]?.label}
                  </button>
                ) : null}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                {lowerContent}
              </div>
            </div>
          </section>
        ) : null}

        {detailPanel || hasContentLayer ? (
          <div className="mt-5 space-y-5 px-4 pb-4 lg:hidden">
            {detailPanel ? (
              <section className={cn(panelClass, 'rounded-[28px] p-5')}>
                {detailPanel}
              </section>
            ) : null}
            {hasContentLayer ? (
              <section className={cn(panelClass, 'rounded-[28px] p-5')}>
                {lowerContent}
              </section>
            ) : null}
          </div>
        ) : null}
      </>
    );

    return (
      <GalaxyWorkspaceViewport
        className="relative h-full min-h-0 overflow-hidden"
        background={<GalaxyStageBackground accent="blue" />}
        stage={stageNode}
        overlays={overlayNodes}
      />
    );
  }

  return (
    <div className="relative min-h-full overflow-hidden px-4 pb-8 pt-4 sm:px-5 lg:px-6">
      <CompanyGalaxyBackdrop variant={mode === 'landing' ? 'landing' : 'workspace'} />

      <div className="relative mx-auto flex w-full max-w-[1760px] flex-col gap-5">
        <section className={cn(panelClass, 'overflow-hidden rounded-[34px] p-5 sm:p-6')}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              {kicker ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/84 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                  <Sparkles size={12} />
                  {kicker}
                </div>
              ) : null}
              {title ? (
                <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)] sm:text-[3.2rem]">
                  {title}
                </h1>
              ) : null}
              {subtitle ? (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {topActions ? <div className="flex flex-wrap items-center gap-2">{topActions}</div> : null}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_380px]">
          <section className={cn(panelClass, 'rounded-[34px] p-4 sm:p-5')}>
            {hasToolbar ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {layers.map((layer) => (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={layer.onClick}
                      className={cn(
                        'rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition',
                        layer.active
                          ? 'border-cyan-300/70 bg-cyan-50 text-cyan-900'
                          : 'border-white/70 bg-white/82 text-slate-600 hover:border-cyan-200/70 hover:text-cyan-800',
                      )}
                    >
                      {layer.label}
                    </button>
                  ))}
                </div>
                {(onZoomIn || onZoomOut) ? (
                  <div className="flex items-center gap-2">
                    {onZoomOut ? (
                      <button
                        type="button"
                        onClick={onZoomOut}
                        className="rounded-full border border-white/70 bg-white/88 p-2 text-slate-600 transition hover:text-slate-950"
                        aria-label={text({ cs: 'Oddálit', sk: 'Oddialiť', en: 'Zoom out', de: 'Herauszoomen', pl: 'Pomniejsz' })}
                      >
                        <Minus size={16} />
                      </button>
                    ) : null}
                    <div className="rounded-full border border-white/65 bg-white/84 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                      {Math.round(zoom * 100)}%
                    </div>
                    {onZoomIn ? (
                      <button
                        type="button"
                        onClick={onZoomIn}
                        className="rounded-full border border-white/70 bg-white/88 p-2 text-slate-600 transition hover:text-slate-950"
                        aria-label={text({ cs: 'Přiblížit', sk: 'Priblížiť', en: 'Zoom in', de: 'Hineinzoomen', pl: 'Powiększ' })}
                      >
                        <Plus size={16} />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {mapCanvas}
          </section>

          <aside className="space-y-5">
            <section className={cn(panelClass, 'rounded-[30px] p-5')}>
              {detailPanel}
            </section>
          </aside>
        </div>

        {lowerContent ? (
          <section className={cn(panelClass, 'rounded-[34px] p-4 sm:p-5')}>
            {lowerContent}
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default CompanyGalaxyMapShell;
