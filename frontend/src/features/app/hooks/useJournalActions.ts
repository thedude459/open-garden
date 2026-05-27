import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppPage, ConfirmState, FetchAuthed } from "../types";
import { getErrorMessage } from "../utils/appUtils";
import { GardenObservation } from "../../types";

type NoticeKind = "info" | "success" | "error";

interface UseJournalActionsParams {
  fetchAuthed: FetchAuthed;
  pushNotice: (message: string, kind: NoticeKind) => void;
  token: string;
  selectedGarden: number | null;
  activePage: AppPage;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState | null>>;
}

export function useJournalActions({
  fetchAuthed,
  pushNotice,
  token,
  selectedGarden,
  activePage,
  setConfirmState,
}: UseJournalActionsParams) {
  const [observations, setObservations] = useState<GardenObservation[]>([]);
  const [isLoadingObservations, setIsLoadingObservations] = useState(false);

  const loadObservations = useCallback(
    async (gardenId: number) => {
      try {
        setIsLoadingObservations(true);
        const data: GardenObservation[] = await fetchAuthed(`/observations?garden_id=${gardenId}`);
        setObservations(data);
      } finally {
        setIsLoadingObservations(false);
      }
    },
    [fetchAuthed]
  );

  useEffect(() => {
    if (token && selectedGarden && activePage === "journal") {
      loadObservations(selectedGarden).catch(() => {
        pushNotice("Unable to load observation journal.", "error");
      });
    }
  }, [token, selectedGarden, activePage, loadObservations, pushNotice]);

  const createObservation = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!selectedGarden) return;
      const form = e.currentTarget;
      const fd = new FormData(form);
      try {
        await fetchAuthed("/observations", {
          method: "POST",
          body: JSON.stringify({
            garden_id: selectedGarden,
            title: fd.get("title"),
            observed_on: fd.get("observed_on"),
            notes: fd.get("notes") || "",
            photo_url: fd.get("photo_url") || "",
          }),
        });
        form.reset();
        await loadObservations(selectedGarden);
        pushNotice("Journal entry saved.", "success");
      } catch (err: unknown) {
        pushNotice(getErrorMessage(err, "Unable to save entry."), "error");
      }
    },
    [fetchAuthed, selectedGarden, loadObservations, pushNotice]
  );

  const deleteObservation = useCallback(
    async (entryId: number) => {
      setConfirmState({
        title: "Delete journal entry?",
        message: "This permanently removes this observation from your garden history.",
        confirmLabel: "Delete",
        onConfirm: async () => {
          await fetchAuthed(`/observations/${entryId}`, { method: "DELETE" });
          if (selectedGarden) await loadObservations(selectedGarden);
          pushNotice("Entry deleted.", "info");
        },
      });
    },
    [fetchAuthed, selectedGarden, loadObservations, pushNotice, setConfirmState]
  );

  return {
    observations,
    isLoadingObservations,
    loadObservations,
    createObservation,
    deleteObservation,
  };
}
