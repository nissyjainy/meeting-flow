import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  readStoredTheme,
  persistTheme,
} from "./theme";

const storage = new Map<string, string>();

describe("theme", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        clear: () => storage.clear(),
      },
    });
  });

  it("defaults to dark when no preference is saved", () => {
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
    expect(DEFAULT_THEME).toBe("dark");
  });

  it("returns saved light preference", () => {
    storage.set(THEME_STORAGE_KEY, "light");
    expect(readStoredTheme()).toBe("light");
  });

  it("returns saved dark preference", () => {
    storage.set(THEME_STORAGE_KEY, "dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("persists theme choice", () => {
    persistTheme("light");
    expect(storage.get(THEME_STORAGE_KEY)).toBe("light");
  });
});
