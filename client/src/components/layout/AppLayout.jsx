import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Link, useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Radar, PenLine, Files, UserRound, LogOut } from 'lucide-react';
import { API_URL } from '../../config';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { ease } from '../../lib/motion';
import { Logo } from '../ui';
import { ThemeToggle, ThemePicker } from './ThemeToggle';
import AppBackground from '../backgrounds/AppBackground';

const NAV = [
  { to: '/dashboard', label: 'Research', icon: Radar, match: ['/dashboard', '/projects'] },
  { to: '/compose', label: 'Compose', icon: PenLine, match: ['/compose'] },
  { to: '/posts', label: 'Posts', icon: Files, match: ['/posts'] },
];

const isActive = (item, pathname) => item.match.some(m => pathname.startsWith(m));

// Springy enough that the bubble stretches and settles like iOS tab bars.
const LENS_SPRING = { type: 'spring', stiffness: 380, damping: 28, mass: 0.9 };

/* A liquid-glass capsule with a highlight that follows the pointer. */
const GlassCapsule = ({ as: Tag = 'div', className = '', children, ...props }) => {
  const ref = useRef(null);
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${e.clientX - r.left}px`);
    ref.current.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <Tag ref={ref} onPointerMove={onMove} className={`liquid-glass group/glass relative rounded-full ${className}`} {...props}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/glass:opacity-100"
        style={{ background: 'radial-gradient(120px circle at var(--mx, 50%) var(--my, 50%), var(--glass-hover), transparent 70%)' }}
      />
      {children}
    </Tag>
  );
};

const Avatar = ({ user, className = 'h-9 w-9' }) => (
  user?.avatar
    ? <img src={user.avatar} alt="" referrerPolicy="no-referrer" className={`${className} rounded-full object-cover ring-1 ring-white/40`} />
    : (
      <span className={`${className} grid place-items-center rounded-full bg-accent text-sm font-bold text-on-accent`}>
        {(user?.name || '?').charAt(0).toUpperCase()}
      </span>
    )
);

const UserMenu = ({ user }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  // The menu is portalled out of the glass capsule: a blurred element can't
  // blur the page through another blurred parent.
  const toggle = () => {
    const r = buttonRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 14, right: window.innerWidth - r.right - 4 });
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const inside = (t) => buttonRef.current?.contains(t) || menuRef.current?.contains(t);
    const onDown = (e) => { if (!inside(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <>
      <motion.button
        ref={buttonRef}
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={toggle}
        className="grid h-10 w-10 place-items-center rounded-full transition-transform duration-300 hover:scale-105"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <Avatar user={user} />
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              role="menu"
              initial={{ opacity: 0, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.94, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              style={{ transformOrigin: 'top right', top: pos.top, right: pos.right }}
              className="liquid-glass fixed z-50 w-72 overflow-hidden rounded-[1.75rem] !bg-surface"
            >
              <div className="flex items-center gap-3 p-4">
                <Avatar user={user} className="h-11 w-11" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
                  <p className="truncate text-xs text-muted">{user?.email}</p>
                </div>
              </div>
              <div className="mx-3 h-px bg-line" />
              <div className="p-2">
                <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-3 hover:text-ink">
                  <UserRound className="h-4 w-4" /> Profile & connections
                </Link>
              </div>
              <div className="px-4 pb-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Theme</p>
                <ThemePicker />
              </div>
              <div className="mx-3 h-px bg-line" />
              <div className="p-2">
                <a href={`${API_URL}/api/logout`} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-danger/10 hover:text-danger">
                  <LogOut className="h-4 w-4" /> Sign out
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};

const NavTabs = ({ pathname, layoutId, mobile = false }) => (
  NAV.map(item => {
    const active = isActive(item, pathname);
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={mobile
          ? `relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-semibold transition-colors ${active ? 'text-ink' : 'text-muted'}`
          : `relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
      >
        {active && <motion.span layoutId={layoutId} className="glass-lens absolute inset-0 rounded-full" transition={LENS_SPRING} />}
        <motion.span
          className={`relative ${mobile ? 'flex flex-col items-center gap-0.5' : 'flex items-center gap-2'}`}
          animate={{ scale: active ? 1 : 0.96 }}
          whileTap={{ scale: 0.88 }}
        >
          <Icon className={`${mobile ? 'h-5 w-5' : 'h-4 w-4'} ${active ? 'text-accent-ink' : ''}`} />
          {item.label}
        </motion.span>
      </NavLink>
    );
  })
);

const TopNav = ({ user }) => {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="pointer-events-none sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <motion.div
        animate={{ scale: scrolled ? 0.97 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="mx-auto flex max-w-7xl items-center justify-between gap-3"
      >
        <GlassCapsule className="pointer-events-auto flex h-12 items-center px-4">
          <Link to="/dashboard" aria-label="Nexus home"><Logo /></Link>
        </GlassCapsule>

        <GlassCapsule as="nav" aria-label="Main" className="pointer-events-auto hidden h-12 items-center gap-1 p-1 sm:flex">
          <NavTabs pathname={pathname} layoutId="nav-lens" />
        </GlassCapsule>

        <GlassCapsule className="pointer-events-auto flex h-12 items-center gap-1 p-1">
          <ThemeToggle className="!rounded-full" />
          {user ? <UserMenu user={user} /> : <span className="skeleton h-9 w-9 !rounded-full" />}
        </GlassCapsule>
      </motion.div>
    </header>
  );
};

// Phone-sized screens get a floating glass tab bar at the bottom.
const BottomNav = () => {
  const { pathname } = useLocation();
  return (
    <GlassCapsule as="nav" aria-label="Main" className="fixed inset-x-4 bottom-4 z-40 flex items-center gap-1 p-1.5 sm:hidden">
      <NavTabs pathname={pathname} layoutId="bottom-lens" mobile />
    </GlassCapsule>
  );
};

// Keeps the old page on screen while it animates out.
const FrozenOutlet = () => {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
};

export default function AppLayout() {
  const user = useCurrentUser();
  const location = useLocation();

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  return (
    <div className="relative isolate min-h-screen">
      <AppBackground />
      <TopNav user={user} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={location.pathname + location.search}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease } }}
          exit={{ opacity: 0, y: -10, transition: { duration: 0.16 } }}
          className="pb-28 sm:pb-16"
        >
          <FrozenOutlet />
        </motion.main>
      </AnimatePresence>
      <BottomNav />
    </div>
  );
}
