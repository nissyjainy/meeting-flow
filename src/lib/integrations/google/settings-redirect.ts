/** TanStack Start merges pending cookies into handler responses; use mutable Headers. */
export function redirectResponse(url: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: new Headers({ Location: url }),
  });
}

export function settingsRedirectUrl(baseUrl: string, params: Record<string, string>): string {
  const url = new URL("/settings", baseUrl);
  url.searchParams.set("tab", "integrations");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
