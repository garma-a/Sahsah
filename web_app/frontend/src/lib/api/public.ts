import { API_V1, LANGUAGE } from "./client";
import type { PublicPage, PublicPageSlug } from "./types";

export type PageResult = { status: "ok"; page: PublicPage } | { status: "missing" } | { status: "unavailable" };

/**
 * Server-side read of a public page. Next keeps the answer for a minute, so a page costs the API one
 * request a minute at most. An unpublished page is "missing"; a failing API is "unavailable", never "missing".
 */
export async function fetchPublicPage(slug: PublicPageSlug): Promise<PageResult> {
  try {
    const response = await fetch(`${API_V1}/pages/${slug}?language=${LANGUAGE}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 404) return { status: "missing" };
    if (!response.ok) return { status: "unavailable" };
    return { status: "ok", page: (await response.json()) as PublicPage };
  } catch {
    return { status: "unavailable" };
  }
}
