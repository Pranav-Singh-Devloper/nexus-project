import { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Mail, Linkedin, Twitter, RefreshCw, Radar, CheckCircle2, Send, CalendarHeart, Palette, Plug, Link2 } from 'lucide-react';
import { API_URL } from '../config';
import { useCurrentUser } from '../lib/useCurrentUser';
import { useToast } from '../lib/toast';
import { ease, fadeUp, stagger } from '../lib/motion';
import { connectionInfo, reconnectUrl, formatExpiry } from '../utils/connections';
import { AnimatedNumber, Badge, Button, Card, Skeleton } from '../components/ui';
import { ThemePicker } from '../components/layout/ThemeToggle';

const LINKEDIN_DAYS = 60;

const Stat = ({ icon: Icon, label, value, suffix, tone }) => (
  <motion.div variants={fadeUp}>
    <Card hover className="group relative overflow-hidden p-5">
      <div className={`mb-4 grid h-10 w-10 place-items-center rounded-xl transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110 ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-display text-4xl font-semibold tracking-tight text-ink">
        <AnimatedNumber value={value} />
        {suffix && <span className="ml-1.5 font-sans text-sm font-medium text-muted">{suffix}</span>}
      </p>
      <p className="mt-1 text-sm font-medium text-muted">{label}</p>
    </Card>
  </motion.div>
);

const LinkedInCard = ({ user }) => {
  const info = connectionInfo(user, 'linkedin');
  const hasAccount = user.socialAccounts?.some(a => a.provider === 'linkedin');
  const pct = info.daysLeft == null ? 100 : Math.min(100, (info.daysLeft / LINKEDIN_DAYS) * 100);
  const tone = info.expired ? 'danger' : info.expiringSoon ? 'warning' : 'success';
  const bar = { danger: 'bg-danger', warning: 'bg-warning', success: 'bg-success' }[tone];

  return (
    <Card hover className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0A66C2] text-white shadow-soft">
          <Linkedin className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">LinkedIn</p>
          <p className="text-xs text-muted">Publish and schedule posts</p>
        </div>
        {hasAccount && (
          <Badge tone={tone} icon={info.expired ? undefined : CheckCircle2}>{info.expired ? 'Expired' : 'Connected'}</Badge>
        )}
      </div>

      {hasAccount ? (
        <>
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
              <span className="text-ink-soft">{formatExpiry(info) || 'Connected'}</span>
              {info.daysLeft != null && <span className="text-muted">{info.daysLeft} / {LINKEDIN_DAYS} days</span>}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <motion.div className={`h-full rounded-full ${bar}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, delay: 0.3, ease }} />
            </div>
            <p className="mt-2 text-xs text-muted">LinkedIn connections last 60 days. Reconnecting resets the clock.</p>
          </div>
          <Button
            href={reconnectUrl('linkedin', '/profile')}
            variant={info.expired || info.expiringSoon ? 'accent' : 'outline'}
            size="sm"
            icon={RefreshCw}
            className="mt-4 self-start"
          >
            Reconnect
          </Button>
        </>
      ) : (
        <Button href={reconnectUrl('linkedin', '/profile')} variant="accent" icon={Link2} className="mt-5 self-start">Connect LinkedIn</Button>
      )}
    </Card>
  );
};

const XCard = ({ user }) => {
  const connected = user.socialAccounts?.some(a => a.provider === 'x');
  return (
    <Card hover className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black text-white shadow-soft ring-1 ring-white/10">
          <Twitter className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">X (Twitter)</p>
          <p className="text-xs text-muted">Share short-form updates</p>
        </div>
        {connected && <Badge tone="success" icon={CheckCircle2}>Connected</Badge>}
      </div>
      {!connected && (
        <Button href={`${API_URL}/auth/x`} variant="primary" icon={Link2} className="mt-5 self-start">Connect X</Button>
      )}
      {connected && <p className="mt-5 text-xs text-muted">Your X account is ready for posting.</p>}
    </Card>
  );
};

const Profile = () => {
  const user = useCurrentUser();
  const toast = useToast();
  const [projects, setProjects] = useState(null);
  const [published, setPublished] = useState(0);
  const [now] = useState(Date.now);

  useEffect(() => {
    axios.get(`${API_URL}/api/projects?limit=100`, { withCredentials: true })
      .then(res => setProjects(res.data.projects))
      .catch(() => setProjects([]));
    axios.get(`${API_URL}/api/drafts?status=published`, { withCredentials: true })
      .then(res => setPublished(res.data.counts?.published || 0))
      .catch(() => {});

    // Results of a LinkedIn / X connect redirect
    const params = new URLSearchParams(window.location.search);
    const ok = ['linkedin', 'x'].find(p => params.get(p) === 'success');
    const err = params.get('error');
    if (ok) toast.success(`${ok === 'x' ? 'X' : 'LinkedIn'} connected.`);
    else if (err) toast.error(`Connection failed: ${err.replace(/_/g, ' ')}`);
    if (ok || err) window.history.replaceState(window.history.state, document.title, window.location.pathname);
  }, [toast]);

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 pt-10 sm:px-6">
        <Skeleton className="h-56 !rounded-3xl" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-36 !rounded-2xl" />)}</div>
      </div>
    );
  }

  const completed = projects?.filter(p => p.status === 'Completed').length ?? 0;
  const ageDays = Math.max(0, Math.floor((now - new Date(user.createdAt)) / 86400000));

  return (
    <motion.div initial="hidden" animate="show" variants={stagger(0.07)} className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 sm:pt-12">
      {/* Identity */}
      <motion.div variants={fadeUp}>
        <Card className="relative overflow-hidden">
          <div className="relative h-32 overflow-hidden bg-navy sm:h-40">
            <div className="absolute -left-10 -top-24 h-72 w-72 animate-blob rounded-full bg-coral/40 blur-3xl" />
            <div className="absolute -right-10 -top-10 h-64 w-64 animate-blob rounded-full bg-[#2B4C8C]/70 blur-3xl [animation-delay:-7s]" />
            <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(#F4EDE0_1px,transparent_1px)] [background-size:20px_20px]" />
          </div>
          <div className="relative px-6 pb-6 sm:px-8">
            <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.15 }}
                className="relative w-fit"
              >
                <span className="absolute -inset-1 animate-spin-slow rounded-full [background:conic-gradient(from_0deg,#FF6B5B,#F4EDE0,#14213D,#FF6B5B)]" />
                {user.avatar
                  ? <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="relative h-24 w-24 rounded-full border-4 border-surface object-cover sm:h-28 sm:w-28" />
                  : <span className="relative grid h-24 w-24 place-items-center rounded-full border-4 border-surface bg-accent font-display text-4xl font-semibold text-on-accent sm:h-28 sm:w-28">{user.name?.charAt(0)}</span>}
              </motion.div>
              <div className="min-w-0 flex-1 pb-1">
                <h1 className="truncate font-display text-3xl font-semibold tracking-tight text-ink">{user.name}</h1>
                <p className="mt-1 flex items-center gap-2 truncate text-sm text-muted"><Mail className="h-4 w-4 shrink-0" /> {user.email}</p>
              </div>
              <div className="flex gap-2 pb-1">
                <Badge tone="accent">Free tier</Badge>
                <Badge tone="success" icon={CheckCircle2}>Verified</Badge>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div variants={stagger(0.06)} className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={Radar} label="Research missions" value={projects?.length ?? 0} tone="bg-info/12 text-info" />
        <Stat icon={CheckCircle2} label="Reports completed" value={completed} tone="bg-success/12 text-success" />
        <Stat icon={Send} label="Posts published" value={published} tone="bg-accent/15 text-accent-ink" />
        <Stat icon={CalendarHeart} label="With Nexus" value={ageDays} suffix="days" tone="bg-warning/12 text-warning" />
      </motion.div>

      {/* Connections */}
      <motion.section variants={fadeUp} className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold text-ink"><Plug className="h-5 w-5 text-accent-ink" /> Connections</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LinkedInCard user={user} />
          <XCard user={user} />
        </div>
      </motion.section>

      {/* Appearance */}
      <motion.section variants={fadeUp} className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold text-ink"><Palette className="h-5 w-5 text-accent-ink" /> Appearance</h2>
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-ink">Theme</p>
            <p className="text-sm text-muted">Pick light or dark, or follow your device.</p>
          </div>
          <ThemePicker className="w-full sm:w-80" />
        </Card>
      </motion.section>
    </motion.div>
  );
};

export default Profile;
