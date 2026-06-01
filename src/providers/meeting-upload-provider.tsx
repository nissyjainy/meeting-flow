import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MeetingUploadDialog } from "@/components/meetings/MeetingUploadDialog";
import { useMeetingUpload } from "@/hooks/use-meeting-upload";
import type { MeetingUploadState } from "@/lib/meetings/types";
import { uploadDebug, uploadDebugError } from "@/lib/meetings/upload-debug";
import { meetingsQueryKey } from "@/hooks/use-meetings";

type MeetingUploadContextValue = {
  openUploadDialog: () => void;
  closeUploadDialog: () => void;
  isProcessing: boolean;
  state: MeetingUploadState;
};

const MeetingUploadContext = createContext<MeetingUploadContextValue | null>(null);

export function MeetingUploadProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { state, upload, reset, isProcessing } = useMeetingUpload();

  const openUploadDialog = useCallback(() => {
    uploadDebug("MeetingUploadProvider openUploadDialog", { isProcessing, currentlyOpen: open });
    if (!isProcessing) {
      setOpen(true);
      uploadDebug("MeetingUploadProvider dialog opened");
    } else {
      uploadDebug("MeetingUploadProvider openUploadDialog blocked (isProcessing)");
    }
  }, [isProcessing, open]);

  const closeUploadDialog = useCallback(() => {
    uploadDebug("MeetingUploadProvider closeUploadDialog");
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    uploadDebug("MeetingUploadProvider onOpenChange", { next, isProcessing, phase: state.phase });
    setOpen(next);
  }, [isProcessing, state.phase]);

  const value = useMemo(
    () => ({
      openUploadDialog,
      closeUploadDialog,
      isProcessing,
      state,
    }),
    [openUploadDialog, closeUploadDialog, isProcessing, state],
  );

  return (
    <MeetingUploadContext.Provider value={value}>
      {children}
      <MeetingUploadDialog
        open={open}
        onOpenChange={handleOpenChange}
        state={state}
        upload={upload}
        reset={reset}
        isProcessing={isProcessing}
        onUploaded={async () => {
          uploadDebug("MeetingUploadProvider onUploaded started");
          try {
            await queryClient.invalidateQueries({ queryKey: meetingsQueryKey });
            uploadDebug("MeetingUploadProvider onUploaded invalidateQueries success");
          } catch (error) {
            uploadDebugError("MeetingUploadProvider onUploaded catch", error);
            throw error;
          }
        }}
      />
    </MeetingUploadContext.Provider>
  );
}

export function useMeetingUploadTrigger() {
  const ctx = useContext(MeetingUploadContext);
  if (!ctx) {
    throw new Error("useMeetingUploadTrigger must be used within MeetingUploadProvider");
  }
  return ctx;
}
