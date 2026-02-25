import React from 'react';
import { ThreeSceneCapability } from '../../types';
import SceneShell from '../three/SceneShell';
import BiophilicCockpitScene from '../three/BiophilicCockpitScene';
import AudioToggle from './AudioToggle';

interface Props {
  embedded: boolean;
  title: string;
  roleLabel: string;
  progressLabel: string;
  topRight?: React.ReactNode;
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  sceneCapability: ThreeSceneCapability;
  showScene: boolean;
  sceneEnabled: boolean;
  onToggleScene: () => void;
  phase: 1 | 2 | 3 | 4 | 5;
  progress: number;
  streakCount: number;
  confidence: number;
  energy: number;
  culture: number;
}

const AssessmentCockpitLayout: React.FC<Props> = ({
  embedded,
  title,
  roleLabel,
  progressLabel,
  topRight,
  leftPanel,
  centerPanel,
  rightPanel,
  sceneCapability,
  showScene,
  sceneEnabled,
  onToggleScene,
  phase,
  progress,
  streakCount,
  confidence,
  energy,
  culture,
}) => {
  return (
    <div className={`${embedded ? 'min-h-full h-full' : 'min-h-[100dvh]'} cockpit-root text-slate-50 overflow-x-hidden overflow-y-auto isolate`}>
      <div className="relative min-h-[100dvh] px-2 md:px-4 py-3 md:py-4">
        <div className="absolute inset-0 pointer-events-none">
          <div className="cockpit-mist cockpit-mist--a" />
          <div className="cockpit-mist cockpit-mist--b" />
          <div className="cockpit-grid-glow" />
        </div>

        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {showScene && sceneEnabled ? (
            <SceneShell
              capability={sceneCapability}
              className="absolute inset-0"
              glide
              glideIntensity={0.2}
              performanceMode={sceneCapability.qualityTier}
              fallback={<div className="absolute inset-0 cockpit-scene-fallback" />}
            >
              <BiophilicCockpitScene
                phase={phase}
                progress={progress}
                streakCount={streakCount}
                confidence={confidence}
                energy={energy}
                culture={culture}
                qualityTier={sceneCapability.qualityTier}
              />
            </SceneShell>
          ) : (
            <div className="absolute inset-0 cockpit-scene-fallback" />
          )}
          <div className="absolute inset-0 cockpit-vignette" />
        </div>

        <div className="relative z-20 max-w-[1700px] mx-auto">
          <div className="cockpit-panel cockpit-topbar px-3 md:px-5 py-3 mb-3 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg md:text-2xl font-semibold tracking-tight">{title}</h1>
              <div className="text-xs md:text-sm text-cyan-100/85">{roleLabel}</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="cockpit-pill">{progressLabel}</span>
              <AudioToggle />
              <button
                type="button"
                onClick={onToggleScene}
                className="cockpit-pill"
                aria-pressed={showScene}
              >
                {showScene ? '3D: ON' : '3D: OFF'}
              </button>
              {topRight}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[290px_minmax(0,1fr)_320px] gap-3 md:gap-4 items-start">
            <aside className="cockpit-panel p-3 md:p-4 cockpit-panel-enter order-2 xl:order-1">{leftPanel}</aside>
            <main className="order-1 xl:order-2 min-h-[58vh] flex flex-col justify-center">{centerPanel}</main>
            <aside className="cockpit-panel p-3 md:p-4 cockpit-panel-enter order-3">{rightPanel}</aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentCockpitLayout;
