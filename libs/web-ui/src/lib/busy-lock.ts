export type BusyLock = {
  tryBegin(key: string): boolean;
  end(key: string): void;
  has(key: string): boolean;
};

export function createBusyLock(): BusyLock {
  const keys = new Set<string>();
  return {
    tryBegin(key: string): boolean {
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    },
    end(key: string): void {
      keys.delete(key);
    },
    has(key: string): boolean {
      return keys.has(key);
    },
  };
}
