export type JdlSurfaceVariant = 'quiet' | 'frost' | 'spotlight' | 'hero' | 'spatial' | 'dock' | 'danger';

export type JdlTone = 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'danger';

export type JdlMotionPreset = 'fast' | 'enter' | 'emphasis' | 'breathe';

type FramerEase = [number, number, number, number];

export interface JdlMotionTransition {
  duration: number;
  ease: FramerEase;
  repeat?: number;
  repeatType?: 'loop' | 'reverse' | 'mirror';
}

export const JDL_EASE: FramerEase = [0.22, 1, 0.36, 1];

export const JDL_MOTION: Record<JdlMotionPreset, JdlMotionTransition> = {
  fast: {
    duration: 0.16,
    ease: JDL_EASE,
  },
  enter: {
    duration: 0.28,
    ease: JDL_EASE,
  },
  emphasis: {
    duration: 0.42,
    ease: JDL_EASE,
  },
  breathe: {
    duration: 2.8,
    ease: JDL_EASE,
    repeat: Infinity,
    repeatType: 'mirror',
  },
};
