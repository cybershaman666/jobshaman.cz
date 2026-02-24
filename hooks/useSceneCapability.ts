import { useMemo } from 'react';
import { ThreeSceneCapability } from '../types';

const supportsWebGL = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
};

export const useSceneCapability = (): ThreeSceneCapability => {
  return useMemo(() => {
    const reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
    const memory = typeof navigator !== 'undefined' ? ((navigator as any).deviceMemory || 4) : 4;
    const webgl = typeof window !== 'undefined' ? supportsWebGL() : false;

    let qualityTier: ThreeSceneCapability['qualityTier'] = 'high';
    if (reducedMotion || cores <= 4 || memory <= 4) {
      qualityTier = 'medium';
    }
    if (reducedMotion || cores <= 2 || memory <= 2) {
      qualityTier = 'low';
    }

    return { webgl, reducedMotion, qualityTier };
  }, []);
};
