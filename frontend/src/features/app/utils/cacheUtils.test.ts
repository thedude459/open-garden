import {
  isCacheValid,
  getCachedData,
  setCachedData,
  createClearAllCaches,
  createInvalidateCaches,
} from "./cacheUtils";
import { describe, expect, it } from "vitest";

describe("Cache Utilities", () => {
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  describe("isCacheValid", () => {
    it("should return false for undefined entry", () => {
      expect(isCacheValid(undefined)).toBe(false);
    });

    it("should return true for recent entry", () => {
      const entry = {
        data: "test",
        timestamp: Date.now(),
      };
      expect(isCacheValid(entry)).toBe(true);
    });

    it("should return false for expired entry", () => {
      const entry = {
        data: "test",
        timestamp: Date.now() - CACHE_TTL_MS - 1000, // Older than TTL
      };
      expect(isCacheValid(entry)).toBe(false);
    });
  });

  describe("getCachedData", () => {
    it("should return data for valid cache entry", () => {
      const cache = new Map();
      const data = { garden: "Test Garden" };
      cache.set(1, { data, timestamp: Date.now() });

      const result = getCachedData(cache, 1);
      expect(result).toEqual(data);
    });

    it("should return undefined and remove expired entry", () => {
      const cache = new Map();
      const data = { garden: "Test Garden" };
      cache.set(1, { data, timestamp: Date.now() - CACHE_TTL_MS - 1000 });

      const result = getCachedData(cache, 1);
      expect(result).toBeUndefined();
      expect(cache.has(1)).toBe(false); // Expired entry was removed
    });

    it("should return undefined for missing key", () => {
      const cache = new Map();
      const result = getCachedData(cache, 999);
      expect(result).toBeUndefined();
    });
  });

  describe("setCachedData", () => {
    it("should store data with current timestamp", () => {
      const cache = new Map();
      const data = { garden: "Test Garden" };
      const before = Date.now();

      setCachedData(cache, 1, data);

      const after = Date.now();
      const entry = cache.get(1);

      expect(entry).toBeDefined();
      expect(entry.data).toEqual(data);
      expect(entry.timestamp).toBeGreaterThanOrEqual(before);
      expect(entry.timestamp).toBeLessThanOrEqual(after);
    });

    it("should overwrite existing cache entry", () => {
      const cache = new Map();
      const oldData = { garden: "Old Garden" };
      const newData = { garden: "New Garden" };

      setCachedData(cache, 1, oldData);
      setCachedData(cache, 1, newData);

      const result = getCachedData(cache, 1);
      expect(result).toEqual(newData);
    });
  });

  describe("createClearAllCaches", () => {
    it("should clear all provided caches", () => {
      const cache1 = new Map();
      const cache2 = new Map();
      const cache3 = new Map();

      setCachedData(cache1, 1, "data1");
      setCachedData(cache2, 1, "data2");
      setCachedData(cache3, 1, "data3");

      const clearAll = createClearAllCaches(cache1, cache2, cache3);
      clearAll();

      expect(cache1.size).toBe(0);
      expect(cache2.size).toBe(0);
      expect(cache3.size).toBe(0);
    });
  });

  describe("createInvalidateCaches", () => {
    it("should remove specific garden from all caches", () => {
      const cache1 = new Map();
      const cache2 = new Map();

      setCachedData(cache1, 1, "garden 1");
      setCachedData(cache1, 2, "garden 2");
      setCachedData(cache2, 1, "climate 1");
      setCachedData(cache2, 2, "climate 2");

      const invalidate = createInvalidateCaches(cache1, cache2);
      invalidate(1); // Invalidate garden 1

      expect(cache1.has(1)).toBe(false);
      expect(cache1.has(2)).toBe(true);
      expect(cache2.has(1)).toBe(false);
      expect(cache2.has(2)).toBe(true);
    });
  });
});
