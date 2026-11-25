"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Maximize } from "lucide-react";

// Phones only: a touch screen whose short side is under 600px. Tablets and desktops keep the browser chrome.
const PHONE_QUERY = "(pointer: coarse) and (max-width: 599px), (pointer: coarse) and (max-height: 599px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  document.addEventListener("fullscreenchange", onChange);
  return () => {
    query.removeEventListener("change", onChange);
    document.removeEventListener("fullscreenchange", onChange);
  };
}

/** True when this is a phone that can go fullscreen and is not fullscreen yet. */
function canEnter() {
  return document.fullscreenEnabled && window.matchMedia(PHONE_QUERY).matches && !document.fullscreenElement;
}

async function enterFullscreen() {
  if (!canEnter()) return;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    // The game is played sideways; locking only works while fullscreen and not every browser allows it.
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
  } catch {
    // Refused (no user gesture, or the browser said no): the page keeps working with the address bar.
  }
}

/**
 * Hides the browser's address bar on phones, where it takes a large share of a landscape screen. Browsers allow
 * fullscreen only from a tap, so the first tap on the page enters it; after the player leaves fullscreen (back
 * gesture), this corner button brings it back. iPhone Safari has no fullscreen for pages, so nothing shows there.
 */
export default function FullscreenToggle() {
  const visible = useSyncExternalStore(subscribe, canEnter, () => false);

  useEffect(() => {
    const onFirstTap = () => void enterFullscreen();
    document.addEventListener("pointerup", onFirstTap, { once: true, capture: true });
    return () => document.removeEventListener("pointerup", onFirstTap, { capture: true });
  }, []);

  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={() => void enterFullscreen()}
      aria-label="ملء الشاشة"
      className="fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-[max(0.5rem,env(safe-area-inset-left))] z-[90] grid size-11 place-items-center rounded-full bg-ink/85 text-cream ring-2 ring-cyan/70 shadow-lg active:translate-y-px"
    >
      <Maximize aria-hidden className="size-5" strokeWidth={2.5} />
    </button>
  );
}
