import { describe, expect, it } from 'vitest';
import { createPreviewOperationWindow } from '../../playwright/support/preview-operation-window';

describe('bounded monotonic admission, without sleeps', () => {
  it.each([0, -1, Infinity, NaN])('rejects invalid budget %#', (budget) => {
    expect(() => createPreviewOperationWindow(budget)).toThrow(/finite positive/);
  });
  it('allows earlier operations and latches expiry at the deadline', () => {
    let now = 100;
    const gate = createPreviewOperationWindow(10, () => now);
    now = 109;
    expect(gate.assertActive).not.toThrow();
    now = 110;
    expect(gate.assertActive).toThrow(/window ended/);
    now = 100;
    expect(gate.assertActive).toThrow(/window ended/);
  });
  it('page close/finally can revoke admission before the deadline', () => {
    const gate = createPreviewOperationWindow(10, () => 0);
    gate.close();
    expect(gate.assertActive).toThrow(/window ended/);
  });
});
