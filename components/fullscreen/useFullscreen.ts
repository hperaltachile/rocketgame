"use client";

import { useEffect, useEffectEvent, useState, type RefObject } from "react";

/**
 * "native": the browser's Fullscreen API (Android, desktop, iPad).
 * "pseudo": iPhone Safari has no element fullscreen, so the stage is pinned
 * over the whole viewport instead (edge to edge when installed as an app).
 */
export type FullscreenMode = "off" | "native" | "pseudo";

/** Marks the history entry pushed for pseudo-fullscreen, so Back exits it. */
const HISTORY_KEY = "rocketgameFullscreen";

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

function fullscreenElement(): Element | null {
  const doc = document as WebkitDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

async function requestNative(el: WebkitElement): Promise<boolean> {
  try {
    if (el.requestFullscreen && document.fullscreenEnabled) {
      await el.requestFullscreen({ navigationUI: "hide" });
      return true;
    }
    if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
      return fullscreenElement() === el;
    }
  } catch {
    // Refused (no user gesture, iframe without permission...): fall back.
  }
  return false;
}

function exitNative() {
  const doc = document as WebkitDocument;
  try {
    if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => {});
    else if (doc.webkitFullscreenElement) void doc.webkitExitFullscreen?.();
  } catch {
    // Already left.
  }
}

async function lockLandscape() {
  try {
    await (screen.orientation as LockableOrientation | undefined)?.lock?.(
      "landscape",
    );
  } catch {
    // Not supported (iOS, desktop): the rotate hint covers it.
  }
}

function unlockOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // Nothing locked.
  }
}

/**
 * Fullscreen for one element (the game stage, not the whole page). Leaving
 * by Esc, the Back gesture or the browser's own UI is picked up through
 * events, so `mode` always matches what's on screen.
 */
export function useFullscreen(
  ref: RefObject<HTMLElement | null>,
  { landscape = false }: { landscape?: boolean } = {},
) {
  const [mode, setMode] = useState<FullscreenMode>("off");

  const onNativeChange = useEffectEvent(() => {
    const isOurs = ref.current !== null && fullscreenElement() === ref.current;
    if (isOurs) setMode("native");
    else if (mode === "native") {
      unlockOrientation();
      setMode("off");
    }
  });

  useEffect(() => {
    const handler = () => onNativeChange();
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);

  // Pseudo mode: Back exits, the page behind can't scroll, and iOS pinch
  // gestures are blocked.
  useEffect(() => {
    if (mode !== "pseudo") return;
    const root = document.documentElement;
    root.classList.add("fs-lock");
    const onPopState = () => setMode("off");
    const blockGesture = (event: Event) => event.preventDefault();
    window.addEventListener("popstate", onPopState);
    document.addEventListener("gesturestart", blockGesture);
    return () => {
      root.classList.remove("fs-lock");
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("gesturestart", blockGesture);
    };
  }, [mode]);

  // Leaving the page while fullscreen: put everything back.
  useEffect(
    () => () => {
      if (ref.current && fullscreenElement() === ref.current) exitNative();
      if (window.history.state?.[HISTORY_KEY]) window.history.back();
    },
    [ref],
  );

  const enter = async () => {
    const el = ref.current;
    if (!el || mode !== "off") return;
    if (await requestNative(el)) {
      setMode("native");
      if (landscape) void lockLandscape();
      return;
    }
    window.history.pushState({ [HISTORY_KEY]: true }, "");
    setMode("pseudo");
  };

  const exit = () => {
    if (mode === "native") {
      exitNative();
    } else if (mode === "pseudo") {
      if (window.history.state?.[HISTORY_KEY]) window.history.back();
      else setMode("off");
    }
  };

  return {
    mode,
    active: mode !== "off",
    enter,
    exit,
    toggle: () => (mode === "off" ? void enter() : exit()),
  };
}
