import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
const STORAGE_KEY = "au-hub-theme";

function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  // Dark is the brand default (every reference mockup is dark); light is opt-in
  // via the toggle, then remembered.
  return "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

// apply immediately on module load so there's no flash of the wrong theme
applyTheme(initialTheme());

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return { theme, toggleTheme };
}
