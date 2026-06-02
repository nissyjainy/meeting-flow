/** User-facing product branding — single source of truth for display names. */
export const PRODUCT_NAME = "MeetFlow";
export const PRODUCT_TAGLINE = "AI meeting intelligence for modern teams";
export const DEFAULT_WORKSPACE_NAME = "MeetFlow";

export function pageTitle(section?: string): string {
  return section ? `${section} — ${PRODUCT_NAME}` : PRODUCT_NAME;
}
