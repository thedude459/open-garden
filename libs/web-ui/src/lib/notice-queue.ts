export type NoticeKind = 'success' | 'error' | 'miss';

export type Notice = {
  id: string;
  kind: NoticeKind;
  message: string;
  dismissible: boolean;
  expiresAt: number | null;
};

const SUCCESS_MS = 4000;

export type NoticeQueue = {
  post(kind: NoticeKind, message: string): boolean;
  dismiss(): void;
  clear(): void;
  get(): Notice | null;
  subscribe(listener: (notice: Notice | null) => void): () => void;
};

export function createNoticeQueue(opts?: {
  now?: () => number;
  id?: () => string;
  schedule?: (fn: () => void, ms: number) => () => void;
}): NoticeQueue {
  const now = opts?.now ?? (() => Date.now());
  let seq = 0;
  const nextId = opts?.id ?? (() => `n-${++seq}`);
  const schedule =
    opts?.schedule ??
    ((fn, ms) => {
      const handle = setTimeout(fn, ms);
      return () => clearTimeout(handle);
    });

  let current: Notice | null = null;
  let cancelExpire: (() => void) | null = null;
  const listeners = new Set<(notice: Notice | null) => void>();

  function emit() {
    for (const listener of listeners) listener(current);
  }

  function stopExpire() {
    cancelExpire?.();
    cancelExpire = null;
  }

  function post(kind: NoticeKind, message: string): boolean {
    const text = message.trim();
    if (!text) return false;
    stopExpire();
    const success = kind === 'success';
    const postedAt = now();
    current = {
      id: nextId(),
      kind,
      message: text,
      dismissible: !success,
      expiresAt: success ? postedAt + SUCCESS_MS : null,
    };
    if (success) {
      const expectedId = current.id;
      cancelExpire = schedule(() => {
        if (current?.id === expectedId) {
          current = null;
          emit();
        }
      }, SUCCESS_MS);
    }
    emit();
    return true;
  }

  function dismiss() {
    if (!current) return;
    stopExpire();
    current = null;
    emit();
  }

  function clear() {
    stopExpire();
    if (!current) return;
    current = null;
    emit();
  }

  return {
    post,
    dismiss,
    clear,
    get: () => current,
    subscribe(listener) {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
  };
}
