import { useCallback, useState } from "react";
import { ConfirmState } from "../types";
import { getErrorMessage } from "../utils/appUtils";

type NoticeKind = "info" | "success" | "error";

interface UseConfirmActionParams {
  pushNotice: (message: string, kind: NoticeKind) => void;
}

export function useConfirmAction({ pushNotice }: UseConfirmActionParams) {
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const runConfirmedAction = useCallback(async () => {
    if (!confirmState) return;
    try {
      setIsConfirmingAction(true);
      await confirmState.onConfirm();
    } catch (err: unknown) {
      pushNotice(getErrorMessage(err, "Unable to complete action."), "error");
    } finally {
      setIsConfirmingAction(false);
      setConfirmState(null);
    }
  }, [confirmState, pushNotice]);

  return { confirmState, setConfirmState, isConfirmingAction, runConfirmedAction };
}
