import { useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../../lib/theme';

const originOf = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

// Round button that flips light/dark; the icon spins as it swaps.
export const ThemeToggle = ({ className = '' }) => {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      onClick={(e) => toggle(originOf(e))}
      className={`relative grid h-10 w-10 place-items-center overflow-hidden rounded-full text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink ${className}`}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 18, rotate: -90, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -18, rotate: 90, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {dark ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
};

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

// Three-way picker (Light / Dark / System) for menus and settings.
export const ThemePicker = ({ className = '' }) => {
  const { preference, setPreference } = useTheme();
  const id = useId();
  return (
    <div className={`relative grid grid-cols-3 gap-1 rounded-full bg-surface-3/60 p-1 ring-1 ring-line ${className}`}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            onClick={(e) => setPreference(value, originOf(e))}
            className={`relative flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold transition-colors ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
            aria-pressed={active}
          >
            {active && (
              <motion.span
                layoutId={`theme-${id}`}
                className="glass-lens absolute inset-0 rounded-full"
                transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.9 }}
              />
            )}
            <span className="relative flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>
          </button>
        );
      })}
    </div>
  );
};
