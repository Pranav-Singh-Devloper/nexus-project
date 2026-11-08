import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { ThemeContext, THEME_KEY } from '../lib/theme';

const media = () => window.matchMedia('(prefers-color-scheme: dark)');

// Light is the default for everyone; dark (or following the device) only if chosen.
const DEFAULT_PREFERENCE = 'light';

const readPreference = () => {
  try { return localStorage.getItem(THEME_KEY) || DEFAULT_PREFERENCE; } catch { return DEFAULT_PREFERENCE; }
};

const resolve = (pref, systemDark) => (pref === 'system' ? (systemDark ? 'dark' : 'light') : pref);

const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    m.setAttribute('content', theme === 'dark' ? '#0B1428' : '#F4EDE0');
  });
};

export default function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readPreference);
  const [systemDark, setSystemDark] = useState(() => media().matches);
  const theme = resolve(preference, systemDark);

  useEffect(() => {
    const mq = media();
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => { applyTheme(theme); }, [theme]);

  // `origin` is the click point; the new theme grows out of it as a circle.
  const setPreference = useCallback((pref, origin) => {
    try { localStorage.setItem(THEME_KEY, pref); } catch { /* storage unavailable */ }
    const next = resolve(pref, media().matches);
    const commit = () => {
      flushSync(() => setPreferenceState(pref));
      applyTheme(next);
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduced || next === document.documentElement.dataset.theme) {
      commit();
      return;
    }

    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? 0;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(commit);
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
  }, []);

  const toggle = useCallback((origin) => {
    setPreference(theme === 'dark' ? 'light' : 'dark', origin);
  }, [theme, setPreference]);

  const value = useMemo(() => ({ preference, theme, setPreference, toggle }), [preference, theme, setPreference, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
