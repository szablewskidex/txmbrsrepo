'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeName = 'standard' | 'dark' | 'light' | 'liquid-glass';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = 'pianorollai-theme';
const ORDER: ThemeName[] = ['standard', 'dark', 'light', 'liquid-glass'];

function applyTheme(theme: ThemeName) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('theme-standard', 'theme-dark', 'theme-light', 'theme-liquid-glass', 'dark');
  root.classList.add(`theme-${theme}`);
  root.dataset.theme = theme;
  if (theme === 'dark' || theme === 'liquid-glass') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
}

function detectInitialTheme(): ThemeName {
  if (typeof window === 'undefined') {
    return 'standard';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'standard' || stored === 'dark' || stored === 'light' || stored === 'liquid-glass') {
    return stored;
  }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'standard';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('standard');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const detected = detectInitialTheme();
    setThemeState(detected);
    applyTheme(detected);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [isHydrated, theme]);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState(prev => {
      const index = ORDER.indexOf(prev);
      const nextIndex = (index + 1) % ORDER.length;
      return ORDER[nextIndex];
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, cycleTheme }),
    [theme, setTheme, cycleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
