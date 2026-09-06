import { describe, expect, it, vi } from 'vitest';
import { createNoticeQueue } from './notice-queue';

describe('createNoticeQueue', () => {
  it('rejects empty or whitespace messages', () => {
    const q = createNoticeQueue();
    expect(q.post('success', '')).toBe(false);
    expect(q.post('error', '   ')).toBe(false);
    expect(q.get()).toBeNull();
  });

  it('replaces any current notice with a newer post of any kind', () => {
    const q = createNoticeQueue({ schedule: () => () => undefined });
    expect(q.post('success', 'Saved')).toBe(true);
    expect(q.get()?.message).toBe('Saved');
    expect(q.post('success', 'Saved again')).toBe(true);
    expect(q.get()?.message).toBe('Saved again');
    expect(q.post('error', 'Failed')).toBe(true);
    expect(q.get()?.kind).toBe('error');
    expect(q.get()?.dismissible).toBe(true);
    expect(q.post('success', 'Recovered')).toBe(true);
    expect(q.get()?.kind).toBe('success');
    expect(q.get()?.dismissible).toBe(false);
  });

  it('expires success after 4000 ms and keeps error/miss until dismiss', () => {
    vi.useFakeTimers();
    const q = createNoticeQueue();
    q.post('success', 'Saved');
    expect(q.get()?.kind).toBe('success');
    vi.advanceTimersByTime(3999);
    expect(q.get()?.message).toBe('Saved');
    vi.advanceTimersByTime(1);
    expect(q.get()).toBeNull();

    q.post('error', 'Offline');
    vi.advanceTimersByTime(10_000);
    expect(q.get()?.kind).toBe('error');
    q.dismiss();
    expect(q.get()).toBeNull();

    q.post('miss', 'Drop missed a bed');
    vi.advanceTimersByTime(10_000);
    expect(q.get()?.kind).toBe('miss');
    q.dismiss();
    expect(q.get()).toBeNull();
    vi.useRealTimers();
  });

  it('clear removes the current notice without waiting to expire', () => {
    const q = createNoticeQueue({ schedule: () => () => undefined });
    q.post('success', 'Saved');
    q.clear();
    expect(q.get()).toBeNull();
  });
});
