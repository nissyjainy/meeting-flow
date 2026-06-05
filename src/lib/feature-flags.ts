/**
 * Settings tab flags — set to `false` to hide a tab entirely (e.g. during MVP).
 * When `true`, roadmap tabs show a "Coming Soon" badge and placeholder content.
 */
export const featureFlags = {
  settingsAiAssistantTab: true,
  settingsBillingTab: true,
} as const;

export type FeatureFlags = typeof featureFlags;

/** Tabs that preview roadmap features — visible but not functional in MVP. */
export const SETTINGS_ROADMAP_TABS = new Set(["ai", "billing"]);
