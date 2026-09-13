"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "mf-theme";

/** Theme used when the user has not chosen one. */
export const DEFAULT_THEME: Theme = "dark";

/**
 * Runs in <head> before first paint (app/layout.tsx): applies the saved theme so the page never flashes the
 * wrong theme. Dark is the default when nothing is saved or storage is unavailable (the server renders dark).
 */
export const THEME_INIT_SCRIPT = `(function(){var t="${DEFAULT_THEME}";try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");if(s==="dark"||s==="light")t=s}catch(e){}document.documentElement.setAttribute("data-theme",t)})()`;

function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

/** The <html data-theme> attribute is the single source of truth; subscribers re-render when it changes. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY && (event.newValue === "dark" || event.newValue === "light")) {
      document.documentElement.setAttribute("data-theme", event.newValue);
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode): the theme still applies for this page view.
  }
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => DEFAULT_THEME);

  return { theme, toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark") };
}
