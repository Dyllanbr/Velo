import { performance } from 'node:perf_hooks';

// Cooperative admission control, not cancellation of work already sent to a driver.
export function createPreviewOperationWindow(budgetMs: number, now = () => performance.now()) {
  if (!Number.isFinite(budgetMs) || budgetMs <= 0) throw new Error('Preview requires a finite positive operation window.');
  const deadline = now() + budgetMs;
  let active = true;
  return {
    close() { active = false; },
    assertActive() {
      if (!active || now() >= deadline) {
        active = false;
        throw new Error('Preview operation window ended; no new operation allowed.');
      }
    },
  };
}
