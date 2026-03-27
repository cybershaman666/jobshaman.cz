const PERF_DEBUG =
  String(import.meta.env.VITE_PERF_DEBUG || '').trim().toLowerCase() === 'true';

const canUsePerformanceApi = (): boolean =>
  typeof window !== 'undefined' && typeof window.performance !== 'undefined';

export const isPerfDebugEnabled = (): boolean => PERF_DEBUG && canUsePerformanceApi();

export const markPerf = (markName: string): void => {
  if (!isPerfDebugEnabled()) return;
  try {
    window.performance.mark(markName);
  } catch {
    // Ignore missing performance implementations.
  }
};

export const measurePerf = (measureName: string, startMark: string, endMark: string): void => {
  if (!isPerfDebugEnabled()) return;
  try {
    window.performance.measure(measureName, startMark, endMark);
    const entries = window.performance.getEntriesByName(measureName);
    const latest = entries[entries.length - 1];
    if (latest) {
      console.info(`[perf] ${measureName}: ${latest.duration.toFixed(1)}ms`);
    }
    window.performance.clearMarks(startMark);
    window.performance.clearMarks(endMark);
    window.performance.clearMeasures(measureName);
  } catch {
    // Ignore invalid or missing mark pairs.
  }
};

export const measureSyncPerf = <T>(label: string, task: () => T): T => {
  if (!isPerfDebugEnabled()) {
    return task();
  }
  const start = window.performance.now();
  const result = task();
  const duration = window.performance.now() - start;
  console.info(`[perf] ${label}: ${duration.toFixed(1)}ms`);
  return result;
};
