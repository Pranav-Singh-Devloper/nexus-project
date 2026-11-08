import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AnimatePresence, motion, useAnimate } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Radar, FileText, PenLine, Send, CheckCircle2, Sparkles } from 'lucide-react';
import { API_URL } from '../config';
import { fetchCurrentUser } from '../lib/useCurrentUser';
import { ease, fadeUp, stagger } from '../lib/motion';
import { Button, Logo } from '../components/ui';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import AppBackground from '../components/backgrounds/AppBackground';

/* ---------------------------------------------------------------- Brand side */

const STEPS = [
  { icon: Radar, label: 'Researching the market', detail: 'Scanning 24 sources…', tone: 'text-info' },
  { icon: FileText, label: 'Report ready', detail: '6 sections · 12 citations', tone: 'text-warning' },
  { icon: PenLine, label: 'LinkedIn draft written', detail: 'Hook, insights, hashtags', tone: 'text-accent-ink' },
  { icon: Send, label: 'Published', detail: 'Live on your profile', tone: 'text-success' },
];

const Pipeline = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % STEPS.length), 2600);
    return () => clearInterval(t);
  }, []);
  const S = STEPS[step];
  const Icon = S.icon;

  return (
    <div className="liquid-glass relative rounded-[1.75rem] p-4">
      <div className="flex items-center gap-3">
        <div className="glass-lens relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl">
          <AnimatePresence mode="wait">
            <motion.span key={step} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ duration: 0.35, ease }}>
              <Icon className={`h-5 w-5 ${S.tone}`} />
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.35, ease }}>
              <p className="text-sm font-semibold text-ink">{S.label}</p>
              <p className="text-xs text-muted">{S.detail}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        {step === STEPS.length - 1 && <CheckCircle2 className="h-5 w-5 text-success" />}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {STEPS.map((_, i) => (
          <div key={i} className="h-1 overflow-hidden rounded-full bg-surface-3">
            <motion.div
              className="h-full rounded-full bg-coral"
              initial={false}
              animate={{ width: i < step ? '100%' : i === step ? ['0%', '100%'] : '0%' }}
              transition={i === step ? { duration: 2.6, ease: 'linear' } : { duration: 0.3 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const HEADLINE = ['Research', 'that', 'turns', 'into', 'reach.'];

const BrandPanel = () => (
  <div className="relative hidden flex-col justify-between p-10 lg:flex xl:p-14">
    <Link to="/" aria-label="Nexus home"><Logo /></Link>

    <div className="max-w-lg space-y-6">
      <h2 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink xl:text-6xl">
        {HEADLINE.map((w, i) => (
          <motion.span
            key={w}
            className={`mr-[0.25em] inline-block ${w === 'reach.' ? 'italic text-accent-ink' : ''}`}
            initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, delay: 0.4 + i * 0.09, ease }}
          >
            {w}
          </motion.span>
        ))}
      </h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="max-w-md text-[15px] leading-relaxed text-ink-soft">
        Autonomous agents research your market, write the report, and draft the LinkedIn post. You just hit publish.
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.6, ease }} className="max-w-md">
        <Pipeline />
      </motion.div>
    </div>
  </div>
);

/* ---------------------------------------------------------------- Form */

const Field = ({ icon: Icon, ...props }) => (
  <div className="group relative">
    <Icon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within:text-accent-ink" />
    <input {...props} className="field h-12 !pl-11" />
  </div>
);

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [formScope, animateForm] = useAnimate();

  // Already signed in? Skip straight to the app.
  useEffect(() => {
    fetchCurrentUser().then(u => { if (u) navigate('/dashboard', { replace: true }); }).catch(() => {});
  }, [navigate]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const switchMode = (login) => { setIsLogin(login); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_URL}${isLogin ? '/auth/login' : '/auth/signup'}`, formData, { withCredentials: true });
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
      animateForm(formScope.current, { x: [0, -10, 9, -6, 4, 0] }, { duration: 0.45 });
      setLoading(false);
    }
  };

  return (
    <div className="relative isolate grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <AppBackground placement="left" />
      <BrandPanel />

      <div className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="relative flex items-center justify-between">
          <span className="lg:invisible"><Logo /></span>
          <div className="liquid-glass relative rounded-full p-1"><ThemeToggle className="!rounded-full" /></div>
        </div>

        <div className="relative flex flex-1 items-center justify-center py-10">
          <motion.div initial="hidden" animate="show" variants={stagger(0.07, 0.1)} className="liquid-glass relative w-full max-w-[460px] rounded-[2rem] p-7 sm:p-9">
            <motion.p variants={fadeUp} className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-ink">
              <Sparkles className="h-3.5 w-3.5" /> Autonomous market intelligence
            </motion.p>
            <AnimatePresence mode="wait">
              <motion.h1
                key={isLogin ? 'in' : 'up'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease }}
                className="font-display text-4xl font-semibold tracking-tight text-ink"
              >
                {isLogin ? 'Welcome back' : 'Start your journey'}
              </motion.h1>
            </AnimatePresence>
            <motion.p variants={fadeUp} className="mt-2 text-[15px] text-muted">
              {isLogin ? 'Sign in to pick up where your agents left off.' : 'Create an account and launch your first research mission.'}
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 grid grid-cols-2 gap-1 rounded-full bg-surface-3/60 p-1 ring-1 ring-line">
              {[['Sign in', true], ['Create account', false]].map(([label, login]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => switchMode(login)}
                  className={`relative rounded-full py-2.5 text-sm font-semibold transition-colors ${isLogin === login ? 'text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {isLogin === login && (
                    <motion.span layoutId="auth-tab" className="glass-lens absolute inset-0 rounded-full" transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.9 }} />
                  )}
                  <span className="relative">{label}</span>
                </button>
              ))}
            </motion.div>

            <motion.div variants={fadeUp} className="mt-6">
              <motion.a
                href={`${API_URL}/auth/google`}
                whileTap={{ scale: 0.98 }}
                className="glass-lens flex h-12 w-full items-center justify-center gap-3 rounded-full text-sm font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5"
              >
                <GoogleIcon /> Continue with Google
              </motion.a>
            </motion.div>

            <motion.div variants={fadeUp} className="my-6 flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
              <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
            </motion.div>

            <motion.form ref={formScope} onSubmit={handleSubmit} className="space-y-3" variants={fadeUp}>
              <AnimatePresence initial={false}>
                {!isLogin && (
                  <motion.div
                    key="name"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease }}
                    className="overflow-hidden"
                  >
                    <div className="pb-0.5">
                      <Field icon={User} type="text" name="name" placeholder="Full name" autoComplete="name" required value={formData.name} onChange={handleChange} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <Field icon={Mail} type="email" name="email" placeholder="Email address" autoComplete="email" required value={formData.email} onChange={handleChange} />
              <Field icon={Lock} type="password" name="password" placeholder="Password" autoComplete={isLogin ? 'current-password' : 'new-password'} required value={formData.password} onChange={handleChange} />

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-center text-sm font-medium text-danger"
                    role="alert"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="pt-2">
                <Button type="submit" variant="accent" size="lg" loading={loading} iconRight={ArrowRight} className="w-full">
                  {isLogin ? 'Sign in' : 'Create account'}
                </Button>
              </div>
            </motion.form>
          </motion.div>
        </div>

        <footer className="relative flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted">
          <span>© {new Date().getFullYear()} Nexus Intelligence · Pranav Singh</span>
          <Link to="/policy" className="link-draw hover:text-ink">Privacy</Link>
          <Link to="/service" className="link-draw hover:text-ink">Terms</Link>
        </footer>
      </div>
    </div>
  );
};

export default Auth;
