import { AUDIO_PREF_KEY, readAudioPreference, writeAudioPreference } from './AudioToggle';

describe('AudioToggle storage helpers', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.defineProperty(global, 'window', {
      value: {
        sessionStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => {
            store.set(key, value);
          },
        },
      },
      configurable: true,
    });
  });

  afterEach(() => {
    // @ts-expect-error test cleanup
    delete global.window;
  });

  it('is disabled by default', () => {
    expect(readAudioPreference()).toBe(false);
  });

  it('persists enabled preference', () => {
    writeAudioPreference(true);
    expect(store.get(AUDIO_PREF_KEY)).toBe('true');
    expect(readAudioPreference()).toBe(true);
  });
});
