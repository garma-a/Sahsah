import { API_V1, LANGUAGE } from "./client";
import type { PublicPage, PublicPageSlug } from "./types";

export type PageResult = { status: "ok"; page: PublicPage } | { status: "missing" } | { status: "unavailable" };

/**
 * Read the public page on each request so unpublishing takes effect on the next visit.
 * A 404 means the page is missing. Other failures mean it is unavailable.
 */
export async function fetchPublicPage(slug: PublicPageSlug): Promise<PageResult> {
  try {
    const response = await fetch(`${API_V1}/pages/${slug}?language=${LANGUAGE}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 404) return { status: "missing" };
    if (!response.ok) return { status: "unavailable" };
    return { status: "ok", page: (await response.json()) as PublicPage };
  } catch {
    return { status: "unavailable" };
  }
}
