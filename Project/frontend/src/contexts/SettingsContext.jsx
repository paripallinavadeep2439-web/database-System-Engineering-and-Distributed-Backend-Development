import { createContext, useContext, useEffect, useCallback } from "react";
import { DEFAULT_SETTINGS } from "../utils/constants";
import useLocalStorage from "../hooks/useLocalStorage";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useLocalStorage("pharmastock.settings", DEFAULT_SETTINGS);

  const update = useCallback(
    (patch) => setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings]
  );

  // Apply theme (dark/light/system) to <html data-theme>
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const resolved =
        settings.theme === "system" ? (mq.matches ? "light" : "dark") : settings.theme;
      document.documentElement.setAttribute("data-theme", resolved);
      document.documentElement.style.colorScheme = resolved;
    };
    apply();
    if (settings.theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [settings.theme]);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === "dark" ? "light" : prev.theme === "light" ? "system" : "dark",
    }));
  }, [setSettings]);

  const value = { settings, update, toggleTheme };
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
