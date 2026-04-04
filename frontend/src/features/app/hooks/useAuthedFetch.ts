import { useCallback, useMemo } from "react";
import { API } from "../constants";

export function useAuthedFetch(token: string, setToken: (value: string) => void) {
  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token],
  );

  const fetchAuthed = useCallback(async (path: string, opts: RequestInit = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...opts,
      headers: { ...authHeaders, ...(opts.headers || {}) },
    });

    if (response.status === 401) {
      localStorage.removeItem("open-garden-token");
      setToken("");
      throw Object.assign(new Error("Session expired. Please sign in again."), { sessionExpired: true });
    }

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        throw new Error(payload?.detail || payload?.message || JSON.stringify(payload));
      }
      throw new Error((await response.text()).trim() || `Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    return response.text();
  }, [authHeaders, setToken]);

  return { authHeaders, fetchAuthed };
}
