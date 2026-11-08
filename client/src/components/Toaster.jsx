import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastContext } from '../lib/toast';
import { ease } from '../lib/motion';

const TONES = {
  success: { icon: CheckCircle2, cls: 'text-success', bar: 'bg-success' },
  error: { icon: AlertCircle, cls: 'text-danger', bar: 'bg-danger' },
  warning: { icon: AlertCircle, cls: 'text-warning', bar: 'bg-warning' },
  info: { icon: Info, cls: 'text-info', bar: 'bg-info' },
};

let nextId = 1;

const ToastAction = ({ action, onDone }) => {
  const Icon = action.icon;
  const cls = action.primary
    ? 'bg-accent text-on-accent hover:bg-accent-hover'
    : 'text-ink-soft hover:text-ink hover:bg-surface-2';
  const props = {
    className: `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${cls}`,
    onClick: () => { action.onClick?.(); onDone(); },
  };
  const body = <>{Icon && <Icon className="h-3.5 w-3.5" />}{action.label}</>;
  if (action.to) return <Link to={action.to} {...props}>{body}</Link>;
  if (action.href) {
    return (
      <a href={action.href} {...props} {...(action.external && { target: '_blank', rel: 'noopener noreferrer' })}>
        {body}
      </a>
    );
  }
  return <button type="button" {...props}>{body}</button>;
};

export default function Toaster({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts(list => list.filter(t => t.id !== id));
  }, []);

  const show = useCallback((type, message, opts = {}) => {
    const id = nextId++;
    const duration = opts.duration ?? (opts.sticky ? 20000 : 6000);
    setToasts(list => [...list.slice(-3), { id, type, message, duration, ...opts }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    show,
    dismiss,
    success: (m, o) => show('success', m, o),
    error: (m, o) => show('error', m, o),
    warning: (m, o) => show('warning', m, o),
    info: (m, o) => show('info', m, o),
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6 sm:top-auto sm:bottom-6 sm:w-[380px]"
          aria-live="polite"
        >
          <AnimatePresence initial={false}>
            {toasts.map(t => {
              const tone = TONES[t.type] || TONES.info;
              const Icon = tone.icon;
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 24, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 60, scale: 0.96, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.45, ease }}
                  className="card pointer-events-auto relative w-full overflow-hidden !shadow-float"
                  role={t.type === 'error' ? 'alert' : 'status'}
                >
                  <div className="flex items-start gap-3 p-4 pr-10">
                    <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone.cls}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-ink">{t.message}</p>
                      {t.actions?.length > 0 && (
                        <div className="mt-2.5 -ml-2.5 flex flex-wrap items-center gap-1">
                          {t.actions.map(a => <ToastAction key={a.label} action={a} onDone={() => dismiss(t.id)} />)}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {/* Time-left bar */}
                  <motion.div
                    className={`absolute bottom-0 left-0 h-[3px] ${tone.bar} opacity-60`}
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: t.duration / 1000, ease: 'linear' }}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
