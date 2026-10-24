import { Injectable, computed, signal } from '@angular/core';
import {
  createBusyLock,
  createNoticeQueue,
  type Notice,
  type NoticeKind,
} from '@open-garden/web-ui';

@Injectable({ providedIn: 'root' })
export class NoticeService {
  private readonly queue = createNoticeQueue();
  private readonly lock = createBusyLock();
  private readonly keys = signal(new Set<string>());
  readonly current = signal<Notice | null>(null);
  readonly undo = signal<(() => void) | null>(null);
  readonly busyMap = computed(() => this.keys());

  constructor() {
    this.queue.subscribe((notice) => {
      this.current.set(notice);
      if (!notice) this.undo.set(null);
    });
  }

  post(kind: NoticeKind, message: string): boolean {
    this.undo.set(null);
    return this.queue.post(kind, message);
  }

  success(message: string, onUndo?: () => void): boolean {
    this.undo.set(onUndo ?? null);
    const posted = this.queue.post('success', message, onUndo ? { persist: true } : undefined);
    if (!posted) this.undo.set(null);
    return posted;
  }

  runUndo(): void {
    const action = this.undo();
    this.undo.set(null);
    this.dismiss();
    action?.();
  }

  error(message: string): boolean {
    return this.post('error', message);
  }

  miss(message: string): boolean {
    return this.post('miss', message);
  }

  dismiss(): void {
    this.queue.dismiss();
  }

  clear(): void {
    this.queue.clear();
  }

  busy(key: string): boolean {
    return this.keys().has(key);
  }

  tryBegin(key: string): boolean {
    const ok = this.lock.tryBegin(key);
    if (ok) {
      this.keys.update((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }
    return ok;
  }

  end(key: string): void {
    this.lock.end(key);
    this.keys.update((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async run(key: string, work: () => Promise<void>): Promise<boolean> {
    if (!this.tryBegin(key)) return false;
    try {
      await work();
      return true;
    } finally {
      this.end(key);
    }
  }
}
