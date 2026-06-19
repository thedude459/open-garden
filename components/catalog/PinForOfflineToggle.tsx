"use client";

import { useState } from "react";

export function PinForOfflineToggle({ plantId }: { plantId: string }) {
  const [pinned, setPinned] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function togglePin() {
    if (pinned) {
      await fetch(`/api/users/me/garden-plants?plant_id=${plantId}`, { method: "DELETE" });
      setPinned(false);
      setMessage("Unpinned from offline cache");
      return;
    }

    await fetch("/api/users/me/garden-plants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plant_id: plantId }),
    });
    setPinned(true);
    setMessage("Pinned for offline access");
  }

  return (
    <div className="row">
      <button className="btn secondary" type="button" onClick={togglePin}>
        {pinned ? "Unpin offline" : "Pin for offline"}
      </button>
      {message ? <span className="field-label">{message}</span> : null}
    </div>
  );
}
