/** Shared by batch analysis and manual regeneration in this browser. Not a project-wide quota guarantee. */
export const ANALYSIS_START_GAP_MS = 13_000; // Google free tier allows 5 requests/minute for this model

export function createAnalysisQueue(
  gap = ANALYSIS_START_GAP_MS,
  now = () => Date.now(),
  wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
) {
  let tail: Promise<unknown> = Promise.resolve();
  let lastStart: number | null = null;
  return function enqueue<T>(run: () => Promise<T>): Promise<T> {
    const result = tail.then(async () => {
      if (lastStart !== null) await wait(Math.max(0, lastStart + gap - now()));
      lastStart = now();
      return run();
    });
    tail = result.catch(() => undefined);
    return result;
  };
}

export const queueAnalysis = createAnalysisQueue();