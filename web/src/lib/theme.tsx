"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "mf-theme";

/**
 * Runs in <head> before first paint (app/layout.tsx): applies the saved theme so a dark-mode user never
 * sees a light flash. Light is the default when nothing is saved or storage is unavailable.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
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
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light" as Theme);

  return { theme, toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark") };
}
