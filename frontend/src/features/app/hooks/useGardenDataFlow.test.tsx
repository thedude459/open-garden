import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGardenDataFlow } from "./useGardenDataFlow";

describe("useGardenDataFlow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("suppresses expired-session notices while keeping normal errors", async () => {
    const fetchAuthed = vi.fn(async (path: string) => {
      throw new Error(`Unhandled path: ${path}`);
    });

    const pushNotice = vi.fn();
    const { result } = renderHook(() => useGardenDataFlow({
      token: "",
      fetchAuthed,
      pushNotice,
      setIsEmailVerified: vi.fn(),
      setConfirmState: vi.fn(),
    }));

    await act(async () => {
      result.current.noticeUnlessExpired("Unable to load")(Object.assign(new Error("expired"), { sessionExpired: true }));
      result.current.noticeUnlessExpired("Unable to load")(new Error("other"));
    });

    expect(pushNotice).toHaveBeenCalledTimes(1);
    expect(pushNotice).toHaveBeenCalledWith("Unable to load", "error");
  });
});
