import { create } from "zustand";
import { tasks as initialTasks, notifications as initialNotifications, type Task, type TaskStatus, type AppNotification } from "@/lib/mock-data";

type Theme = "light" | "dark";

interface AppState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;

  copilotOpen: boolean;
  toggleCopilot: () => void;

  tasks: Task[];
  moveTask: (id: string, status: TaskStatus) => void;
  addTask: (task: Omit<Task, "id">) => void;

  notifications: AppNotification[];
  markAllRead: () => void;
  markRead: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: "light",
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === "light" ? "dark" : "light";
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next === "dark");
      }
      return { theme: next };
    }),
  setTheme: (t) =>
    set(() => {
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", t === "dark");
      }
      return { theme: t };
    }),

  copilotOpen: true,
  toggleCopilot: () => set((s) => ({ copilotOpen: !s.copilotOpen })),

  tasks: initialTasks,
  moveTask: (id, status) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status, progress: status === "done" ? 100 : t.progress } : t)),
    })),
  addTask: (task) =>
    set((s) => ({ tasks: [{ ...task, id: `tk${Date.now()}` }, ...s.tasks] })),

  notifications: initialNotifications,
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
}));