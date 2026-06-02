import { create } from "zustand";
import { persistNotificationReadIds, readNotificationReadIds } from "@/lib/notifications/read-state";
import {
  applyThemeToDocument,
  persistTheme,
  readStoredTheme,
  type Theme,
} from "@/lib/theme";

interface AppState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;

  copilotOpen: boolean;
  toggleCopilot: () => void;
  copilotFocusMeetingId: string | null;
  copilotFocusMeetingTitle: string | null;
  copilotFocusRequestId: number;
  openCopilotForMeeting: (meetingId: string, meetingTitle?: string) => void;
  clearCopilotFocusMeeting: () => void;

  notificationReadIds: Set<string>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (ids: string[]) => void;
}

function persistReadIds(readIds: Set<string>) {
  persistNotificationReadIds(readIds);
}

function setThemeOnStore(theme: Theme) {
  applyThemeToDocument(theme);
  persistTheme(theme);
  return { theme };
}

export const useAppStore = create<AppState>((set) => ({
  theme: readStoredTheme(),
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === "light" ? "dark" : "light";
      applyThemeToDocument(next);
      persistTheme(next);
      return { theme: next };
    }),
  setTheme: (t) => set(() => setThemeOnStore(t)),

  copilotOpen: true,
  toggleCopilot: () => set((s) => ({ copilotOpen: !s.copilotOpen })),
  copilotFocusMeetingId: null,
  copilotFocusMeetingTitle: null,
  copilotFocusRequestId: 0,
  openCopilotForMeeting: (meetingId, meetingTitle) =>
    set((s) => ({
      copilotOpen: true,
      copilotFocusMeetingId: meetingId,
      copilotFocusMeetingTitle: meetingTitle?.trim() || null,
      copilotFocusRequestId: s.copilotFocusRequestId + 1,
    })),
  clearCopilotFocusMeeting: () =>
    set({ copilotFocusMeetingId: null, copilotFocusMeetingTitle: null }),

  notificationReadIds: readNotificationReadIds(),
  markNotificationRead: (id) =>
    set((state) => {
      if (state.notificationReadIds.has(id)) return state;
      const notificationReadIds = new Set(state.notificationReadIds);
      notificationReadIds.add(id);
      persistReadIds(notificationReadIds);
      return { notificationReadIds };
    }),
  markAllNotificationsRead: (ids) =>
    set((state) => {
      const notificationReadIds = new Set(state.notificationReadIds);
      for (const id of ids) {
        notificationReadIds.add(id);
      }
      persistReadIds(notificationReadIds);
      return { notificationReadIds };
    }),
}));
