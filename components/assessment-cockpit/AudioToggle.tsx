import React, { useEffect, useRef, useState } from 'react';

export const AUDIO_PREF_KEY = 'jobshaman_assessment_audio_enabled';

export const readAudioPreference = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(AUDIO_PREF_KEY) === 'true';
  } catch {
    return false;
  }
};

export const writeAudioPreference = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AUDIO_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage failures
  }
};

interface Props {
  labelOn?: string;
  labelOff?: string;
  src?: string;
  className?: string;
}

const AudioToggle: React.FC<Props> = ({
  labelOn = 'Ambient: ON',
  labelOff = 'Ambient: OFF',
  src = '/audio/biophilic-ambient.mp3',
  className = '',
}) => {
  const [enabled, setEnabled] = useState<boolean>(() => readAudioPreference());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    writeAudioPreference(enabled);
  }, [enabled]);

  useEffect(() => {
    if (!src) return;
    const el = new Audio(src);
    el.loop = true;
    el.preload = 'none';
    audioRef.current = el;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      audioRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (!enabled) {
      el.pause();
      return;
    }

    void el.play().catch(() => {
      setEnabled(false);
    });
  }, [enabled]);

  return (
    <button
      type="button"
      onClick={() => setEnabled((prev) => !prev)}
      aria-pressed={enabled}
      className={`rounded-full border border-[var(--cockpit-glass-border)] bg-[var(--cockpit-glass-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--cockpit-accent-2)] backdrop-blur-md transition hover:bg-[color:var(--cockpit-glass-bg-strong)] ${className}`}
    >
      {enabled ? labelOn : labelOff}
    </button>
  );
};

export default AudioToggle;
