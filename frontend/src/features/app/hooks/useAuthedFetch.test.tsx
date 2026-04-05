import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthedFetch } from "./useAuthedFetch";

function mockResponse({
  status,
  ok,
  json,
  text,
  contentType,
}: {
  status: number;
  ok: boolean;
  json?: unknown;
  text?: string;
  contentType?: string;
}) {
  return {
    status,
    ok,
    headers: { get: vi.fn(() => contentType || "") },
    json: vi.fn(async () => json),
    text: vi.fn(async () => text || ""),
  } as unknown as Response;
}

describe("useAuthedFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("builds auth headers and parses JSON responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockResponse({
          status: 200,
          ok: true,
          contentType: "application/json",
          json: { ok: true },
        }),
      ),
    );
    const setToken = vi.fn();
    const { result } = renderHook(() => useAuthedFetch("abc", setToken));

    expect(result.current.authHeaders.Authorization).toBe("Bearer abc");

    let payload: unknown;
    await act(async () => {
      payload = await result.current.fetchAuthed("/gardens", { method: "GET" });
    });

    expect(payload).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/gardens"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer abc" }),
      }),
    );
  });

  it("handles 401 by clearing token and throwing sessionExpired error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse({ status: 401, ok: false, contentType: "text/plain", text: "unauthorized" })),
    );
    localStorage.setItem("open-garden-token", "abc");
    const setToken = vi.fn();
    const { result } = renderHook(() => useAuthedFetch("abc", setToken));

    await expect(result.current.fetchAuthed("/x")).rejects.toMatchObject({ sessionExpired: true });
    expect(localStorage.getItem("open-garden-token")).toBeNull();
    expect(setToken).toHaveBeenCalledWith("");
  });

  it("handles non-json error, 204 null, and text success response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ status: 400, ok: false, contentType: "text/plain", text: "Bad request" }))
      .mockResolvedValueOnce(mockResponse({ status: 204, ok: true, contentType: "" }))
      .mockResolvedValueOnce(mockResponse({ status: 200, ok: true, contentType: "text/plain", text: "done" }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuthedFetch("abc", vi.fn()));

    await expect(result.current.fetchAuthed("/bad")).rejects.toThrow("Bad request");
    await expect(result.current.fetchAuthed("/empty")).resolves.toBeNull();
    await expect(result.current.fetchAuthed("/txt")).resolves.toBe("done");
  });
});
