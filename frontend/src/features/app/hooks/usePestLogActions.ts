import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppPage, ConfirmState, FetchAuthed } from "../types";
import { getErrorMessage } from "../utils/appUtils";
import { PestLog } from "../../types";

type NoticeKind = "info" | "success" | "error";

interface UsePestLogActionsParams {
  fetchAuthed: FetchAuthed;
  pushNotice: (message: string, kind: NoticeKind) => void;
  token: string;
  selectedGarden: number | null;
  activePage: AppPage;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState | null>>;
}

export function usePestLogActions({
  fetchAuthed,
  pushNotice,
  token,
  selectedGarden,
  activePage,
  setConfirmState,
}: UsePestLogActionsParams) {
  const [pestLogs, setPestLogs] = useState<PestLog[]>([]);
  const [isLoadingPestLogs, setIsLoadingPestLogs] = useState(false);

  const loadPestLogs = useCallback(
    async (gardenId: number) => {
      try {
        setIsLoadingPestLogs(true);
        const data: PestLog[] = await fetchAuthed(`/pest-logs?garden_id=${gardenId}`);
        setPestLogs(data);
      } finally {
        setIsLoadingPestLogs(false);
      }
    },
    [fetchAuthed],
  );

  useEffect(() => {
    if (token && selectedGarden && activePage === "pests") {
      loadPestLogs(selectedGarden).catch(() => {
        pushNotice("Unable to load pest log.", "error");
      });
    }
  }, [token, selectedGarden, activePage, loadPestLogs, pushNotice]);

  const createPestLog = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!selectedGarden) return;
      const form = e.currentTarget;
      const fd = new FormData(form);
      try {
        await fetchAuthed("/pest-logs", {
          method: "POST",
          body: JSON.stringify({
            garden_id: selectedGarden,
            title: fd.get("title"),
            observed_on: fd.get("observed_on"),
            treatment: fd.get("treatment") || "",
          }),
        });
        form.reset();
        await loadPestLogs(selectedGarden);
        pushNotice("Observation logged.", "success");
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to log observation."), "error");
      }
    },
    [fetchAuthed, selectedGarden, loadPestLogs, pushNotice],
  );

  const deletePestLog = useCallback(
    async (logId: number) => {
      setConfirmState({
        title: "Delete observation?",
        message: "This permanently removes this pest/disease record.",
        confirmLabel: "Delete",
        onConfirm: async () => {
          await fetchAuthed(`/pest-logs/${logId}`, { method: "DELETE" });
          if (selectedGarden) await loadPestLogs(selectedGarden);
          pushNotice("Observation deleted.", "info");
        },
      });
    },
    [fetchAuthed, selectedGarden, loadPestLogs, pushNotice, setConfirmState],
  );

  return {
    pestLogs,
    isLoadingPestLogs,
    loadPestLogs,
    createPestLog,
    deletePestLog,
  };
}
