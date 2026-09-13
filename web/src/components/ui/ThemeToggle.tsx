"use client";

import { useTheme } from "@/lib/theme";

/** Light / dark switch shown in the top bar and on the login page. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button type="button" className={`mf-theme-toggle ${className}`} onClick={toggleTheme} title={label} aria-label={label} aria-pressed={theme === "dark"} data-testid="theme-toggle">
      <i className={theme === "dark" ? "fa fa-sun-o" : "fa fa-moon-o"} />
    </button>
  );
}
