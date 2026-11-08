import { forwardRef, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { ease, fadeUp } from '../lib/motion';
import { LOCKUP, MARK, WORDMARK } from '../lib/brand';

const cx = (...c) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ Button */

const VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover shadow-soft hover:shadow-card',
  accent: 'shine bg-accent text-on-accent hover:bg-accent-hover shadow-glow',
  outline: 'glass-lens text-ink hover:brightness-105',
  ghost: 'text-ink-soft hover:text-ink hover:bg-surface-2',
  subtle: 'bg-surface-2 text-ink hover:bg-surface-3',
  danger: 'bg-danger text-bg hover:opacity-90',
  'danger-ghost': 'text-muted hover:text-danger hover:bg-danger/10',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-full',
  sm: 'h-8 px-3.5 text-xs gap-1.5 rounded-full',
  md: 'h-10 px-4.5 text-sm gap-2 rounded-full',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-full',
  icon: 'h-10 w-10 rounded-full',
  'icon-sm': 'h-8 w-8 rounded-full',
};

const MotionLink = motion.create(Link);

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, icon: Icon, iconRight: IconRight, className, children, to, href, ...props },
  ref,
) {
  const classes = cx(
    'relative inline-flex select-none items-center justify-center whitespace-nowrap font-semibold',
    'transition-[background-color,color,border-color,box-shadow,opacity] duration-200',
    'disabled:pointer-events-none disabled:opacity-45',
    VARIANTS[variant], SIZES[size], className,
  );
  const iconSize = size === 'lg' ? 'h-[18px] w-[18px]' : size === 'xs' || size === 'sm' || size === 'icon-sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const content = (
    <>
      {loading ? <Loader2 className={cx(iconSize, 'animate-spin')} /> : Icon && <Icon className={iconSize} />}
      {children}
      {IconRight && !loading && <IconRight className={cx(iconSize, 'transition-transform duration-300 group-hover:translate-x-0.5')} />}
    </>
  );
  const tap = { whileTap: disabled || loading ? undefined : { scale: 0.97 } };

  if (to) return <MotionLink ref={ref} to={to} className={cx('group', classes)} {...tap} {...props}>{content}</MotionLink>;
  if (href) return <motion.a ref={ref} href={href} className={cx('group', classes)} {...tap} {...props}>{content}</motion.a>;
  return (
    <motion.button ref={ref} type="button" disabled={disabled || loading} className={cx('group', classes)} {...tap} {...props}>
      {content}
    </motion.button>
  );
});

/* ------------------------------------------------------------------ Card */

export const Card = ({ hover = false, className, children, as: Tag = 'div', ...props }) => (
  <Tag className={cx('card', hover && 'card-hover', className)} {...props}>{children}</Tag>
);

/* ------------------------------------------------------------------ Badge */

const BADGE_TONES = {
  neutral: 'bg-surface-2 text-ink-soft border-line',
  accent: 'bg-accent/12 text-accent-ink border-accent/25',
  success: 'bg-success/12 text-success border-success/25',
  warning: 'bg-warning/12 text-warning border-warning/25',
  danger: 'bg-danger/10 text-danger border-danger/25',
  info: 'bg-info/12 text-info border-info/25',
};

export const Badge = ({ tone = 'neutral', icon: Icon, pulse, className, children }) => (
  <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', BADGE_TONES[tone], className)}>
    {pulse ? (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
      </span>
    ) : Icon && <Icon className="h-3.5 w-3.5" />}
    {children}
  </span>
);

/* ------------------------------------------------------------------ Misc */

export const Spinner = ({ className }) => <Loader2 className={cx('animate-spin text-muted', className || 'h-5 w-5')} />;

export const Skeleton = ({ className }) => <div className={cx('skeleton', className)} />;

// The Nexus mark (N + coral dot) and wordmark, drawn from the same vectors as
// public/brand. The N and the word take the current text colour, so they
// switch between navy and cream with the theme.
const MarkShapes = () => (
  <>
    <path d={MARK.n} fill="none" stroke="currentColor" strokeWidth={MARK.stroke} strokeLinecap="round" strokeLinejoin="round" />
    <circle
      cx={MARK.dot.cx}
      cy={MARK.dot.cy}
      r={MARK.dot.r}
      fill="var(--color-coral)"
      className="transition-transform duration-500 [transform-box:fill-box] [transform-origin:center] group-hover:-translate-y-[22%] group-hover:scale-110"
    />
  </>
);

export const Logo = ({ className, mark = false, size = 'h-7' }) => (
  <span className={cx('group inline-flex items-center text-ink', className)}>
    {mark ? (
      <svg viewBox={MARK.viewBox} className={cx(size, 'w-auto overflow-visible')} role="img" aria-label="Nexus">
        <MarkShapes />
      </svg>
    ) : (
      <svg viewBox={LOCKUP.viewBox} className={cx(size, 'w-auto overflow-visible')} role="img" aria-label="Nexus">
        <g transform={LOCKUP.mark}><MarkShapes /></g>
        <path d={WORDMARK.d} transform={LOCKUP.word} fill="currentColor" />
      </svg>
    )}
  </span>
);

// Counts up from 0 when it first appears.
export const AnimatedNumber = ({ value = 0, className }) => {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const controls = animate(0, value, { duration: 1.1, ease, onUpdate: v => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [value, reduced]);
  return <span className={cx('tabular-nums', className)}>{(reduced ? value : shown).toLocaleString()}</span>;
};

/* ------------------------------------------------------------------ Page header */

export const PageHeader = ({ eyebrow, title, description, actions, className }) => (
  <motion.header
    initial="hidden"
    animate="show"
    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
    className={cx('mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between', className)}
  >
    <div className="min-w-0">
      {eyebrow && (
        <motion.p variants={fadeUp} className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent-ink">
          <span className="h-px w-6 bg-accent" /> {eyebrow}
        </motion.p>
      )}
      <motion.h1 variants={fadeUp} className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {title}
      </motion.h1>
      {description && <motion.p variants={fadeUp} className="mt-2 max-w-xl text-[15px] text-muted">{description}</motion.p>}
    </div>
    {actions && <motion.div variants={fadeUp} className="flex shrink-0 flex-wrap items-center gap-2">{actions}</motion.div>}
  </motion.header>
);

/* ------------------------------------------------------------------ Segmented tabs */

export const Segmented = ({ options, value, onChange, className, size = 'md' }) => {
  const id = useId();
  return (
    <div role="tablist" className={cx('liquid-glass relative inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1', className)}>
      {options.map(o => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative shrink-0 rounded-full font-semibold transition-colors duration-200',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
              active ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="glass-lens absolute inset-0 rounded-full"
                transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.9 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {Icon && <Icon className="h-4 w-4" />}
              {o.label}
              {o.count > 0 && (
                <span className={cx(
                  'min-w-5 rounded-full px-1.5 text-[11px] leading-5 tabular-nums',
                  o.alert ? 'bg-danger/15 text-danger' : active ? 'bg-accent/15 text-accent-ink' : 'bg-surface-3 text-muted',
                )}>
                  {o.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ Banner */

const BANNER_TONES = {
  warning: 'border-warning/35 from-warning/15 to-warning/5 text-warning',
  danger: 'border-danger/35 from-danger/15 to-danger/5 text-danger',
  info: 'border-info/35 from-info/15 to-info/5 text-info',
  neutral: 'border-line-strong from-surface-3 to-transparent text-ink-soft',
  success: 'border-success/35 from-success/15 to-success/5 text-success',
};

export const Banner = ({ tone = 'neutral', icon: Icon, title, children, action, className }) => (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease }}
    className={cx('flex flex-col gap-3 rounded-3xl border bg-surface bg-gradient-to-r p-4 shadow-soft backdrop-blur-xl backdrop-saturate-150 sm:flex-row sm:items-center', BANNER_TONES[tone], className)}
  >
    {Icon && <Icon className="h-5 w-5 shrink-0" />}
    <div className="min-w-0 flex-1">
      {title && <p className="text-sm font-semibold">{title}</p>}
      {children && <div className={cx('text-sm text-ink-soft', title && 'mt-0.5')}>{children}</div>}
    </div>
    {action}
  </motion.div>
);

/* ------------------------------------------------------------------ Empty state */

export const EmptyState = ({ icon: Icon, title, children, action, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease }}
    className={cx('flex flex-col items-center rounded-3xl border border-dashed border-line-strong bg-surface/60 px-6 py-16 text-center', className)}
  >
    {Icon && (
      <div className="relative mb-5">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent/25" />
        <div className="relative grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-accent-ink ring-1 ring-line">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    )}
    {title && <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>}
    {children && <p className="mt-1.5 max-w-sm text-sm text-muted">{children}</p>}
    {action && <div className="mt-6">{action}</div>}
  </motion.div>
);

/* ------------------------------------------------------------------ Modal */

const MODAL_SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-6xl' };

export const Modal = ({ open, onClose, title, description, size = 'md', children, footer, className, bodyClassName, dismissable = true }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && dismissable) onClose?.(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose, dismissable]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-navy/30 backdrop-blur-md dark:bg-black/55" onClick={() => dismissable && onClose?.()} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className={cx(
              'liquid-glass relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[2rem] !bg-surface sm:rounded-[2rem]',
              MODAL_SIZES[size], className,
            )}
          >
            {(title || dismissable) && (
              <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                <div className="min-w-0">
                  {title && <h2 className="font-display text-xl font-semibold leading-tight text-ink">{title}</h2>}
                  {description && <p className="mt-1 text-sm text-muted">{description}</p>}
                </div>
                {dismissable && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="-mr-2 rounded-xl p-2 text-muted transition-all duration-300 hover:rotate-90 hover:bg-surface-2 hover:text-ink"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
            <div className={cx('flex-1 overflow-y-auto', bodyClassName ?? 'px-6 py-5')}>{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/40 px-6 py-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

/* ------------------------------------------------------------------ Confirm dialog */

export const ConfirmDialog = ({ open, onClose, onConfirm, title, children, confirmLabel = 'Delete', busy, tone = 'danger' }) => (
  <Modal
    open={open}
    onClose={busy ? undefined : onClose}
    title={title}
    size="sm"
    footer={(
      <>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'accent'} onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
      </>
    )}
  >
    <p className="text-sm text-ink-soft">{children}</p>
  </Modal>
);
