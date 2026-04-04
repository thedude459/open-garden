import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays updates until the debounce window elapses", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: "seed", delayMs: 300 } },
    );

    rerender({ value: "sprout", delayMs: 300 });

    expect(result.current).toBe("seed");

    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(result.current).toBe("seed");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe("sprout");
  });

  it("cancels the stale timer when the value changes again", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: "peas", delayMs: 200 } },
    );

    rerender({ value: "beans", delayMs: 200 });

    act(() => {
      vi.advanceTimersByTime(150);
    });

    rerender({ value: "beets", delayMs: 200 });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe("peas");

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current).toBe("beets");
  });
});