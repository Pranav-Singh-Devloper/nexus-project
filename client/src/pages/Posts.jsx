import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Files, PenLine, Plus, Pencil, Trash2, Copy, ExternalLink, CalendarX, Eye,
  AlertCircle, Clock, CheckCircle2, XCircle, FileText, RefreshCw, Linkedin, Twitter, BookOpen,
} from 'lucide-react';
import { API_URL } from '../config';
import { useCurrentUser } from '../lib/useCurrentUser';
import { useToast } from '../lib/toast';
import { ease } from '../lib/motion';
import { waitForSaves } from '../lib/draftSync';
import { connectionInfo, reconnectUrl, formatExpiry } from '../utils/connections';
import { Badge, Banner, Button, EmptyState, PageHeader, Segmented, Skeleton } from '../components/ui';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
];

const STATUS = {
  draft: { label: 'Draft', icon: FileText, tone: 'neutral', stripe: 'bg-line-strong' },
  scheduled: { label: 'Scheduled', icon: Clock, tone: 'info', stripe: 'bg-info' },
  published: { label: 'Published', icon: CheckCircle2, tone: 'success', stripe: 'bg-success' },
  failed: { label: 'Failed', icon: XCircle, tone: 'danger', stripe: 'bg-danger' },
};

const EMPTY = {
  all: ['No posts yet', 'Write one in the composer or generate one from a research report.'],
  draft: ['No drafts', 'Anything you write in the composer is saved here automatically.'],
  scheduled: ['Nothing scheduled', 'Schedule a post from the composer and it will wait here.'],
  published: ['Nothing published yet', 'Posts you publish from Nexus show up here.'],
  failed: ['No failed posts', 'All good. Nothing needs your attention.'],
};

// HTML from the editor -> readable plain text for the card preview
function previewText(html) {
  const withBreaks = (html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n');
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

function relativeTime(date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const formatDateTime = (date) => new Date(date).toLocaleString(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

function timeLabel(d) {
  if (d.status === 'scheduled' && d.scheduledAt) return `For ${formatDateTime(d.scheduledAt)}`;
  if (d.status === 'published' && d.publishedAt) return formatDateTime(d.publishedAt);
  return `Edited ${relativeTime(d.updatedAt)}`;
}

const providerLabel = (p) => (p === 'x' ? 'X' : p === 'linkedin' ? 'LinkedIn' : null);
const ProviderIcon = ({ provider }) => {
  if (provider === 'linkedin') return <Linkedin className="h-3.5 w-3.5" />;
  if (provider === 'x') return <Twitter className="h-3.5 w-3.5" />;
  return null;
};

const PostCard = ({ draft, index = 0, busy, onDelete, onDuplicate, onUnschedule }) => {
  const [confirming, setConfirming] = useState(false);
  const status = STATUS[draft.status] || STATUS.draft;
  const text = previewText(draft.html);
  const editable = draft.status === 'draft' || draft.status === 'failed';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease, delay: Math.min(index, 8) * 0.04 } }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
      transition={{ duration: 0.45, ease }}
      className="card card-hover group relative flex flex-col overflow-hidden"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${status.stripe} opacity-70 transition-all duration-300 group-hover:w-1.5 group-hover:opacity-100`} />

      <Link to={`/compose?draft=${draft.id}`} className="flex flex-1 flex-col gap-3 p-5 pl-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone={status.tone} icon={status.icon}>
            {status.label}
            {providerLabel(draft.provider) && <span className="flex items-center gap-1 opacity-75">· <ProviderIcon provider={draft.provider} /></span>}
          </Badge>
          <span className="text-xs font-medium text-muted">{timeLabel(draft)}</span>
        </div>

        <div className="flex min-w-0 gap-3">
          <p className={`line-clamp-5 min-w-0 flex-1 whitespace-pre-line break-words text-sm leading-relaxed ${text ? 'text-ink-soft' : 'italic text-muted'}`}>
            {text || 'Empty draft'}
          </p>
          {draft.imageUrl && (
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line">
              <img
                src={draft.imageUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
                onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
              />
            </div>
          )}
        </div>

        {draft.status === 'failed' && draft.error && (
          <p className="flex items-start gap-1.5 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {draft.error}
          </p>
        )}

        {draft.project && (
          <p className="mt-auto flex items-center gap-1.5 truncate text-xs text-muted">
            <BookOpen className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{draft.project.title}</span>
          </p>
        )}
      </Link>

      <div className="flex min-h-[52px] flex-wrap items-center gap-1 border-t border-line bg-surface-2/40 px-3 py-2">
        <AnimatePresence mode="wait" initial={false}>
          {confirming ? (
            <motion.div key="confirm" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex w-full items-center gap-1">
              <span className="mr-auto pl-1 text-xs font-medium text-ink-soft">
                {draft.status === 'published' ? 'Remove from Nexus? The live post stays up.' : 'Delete this post?'}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => onDelete(draft)} loading={busy}>Delete</Button>
            </motion.div>
          ) : (
            <motion.div key="actions" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex w-full flex-wrap items-center gap-1">
              {editable ? (
                <Button size="sm" variant="primary" icon={Pencil} to={`/compose?draft=${draft.id}`}>
                  {draft.status === 'failed' ? 'Edit & retry' : 'Edit'}
                </Button>
              ) : (
                <Button size="sm" variant="ghost" icon={Eye} to={`/compose?draft=${draft.id}`}>View</Button>
              )}
              {draft.status === 'published' && draft.postUrl && (
                <Button size="sm" variant="ghost" icon={ExternalLink} href={draft.postUrl} target="_blank" rel="noopener noreferrer">
                  {providerLabel(draft.provider) || 'Open'}
                </Button>
              )}
              {draft.status === 'scheduled' && (
                <Button size="sm" variant="ghost" icon={CalendarX} onClick={() => onUnschedule(draft)} disabled={busy}>Unschedule</Button>
              )}
              <span className="ml-auto flex items-center gap-0.5">
                <Button size="icon-sm" variant="ghost" icon={Copy} onClick={() => onDuplicate(draft)} disabled={busy} title="Duplicate" aria-label="Duplicate" />
                <Button size="icon-sm" variant="danger-ghost" icon={Trash2} onClick={() => setConfirming(true)} disabled={busy} title="Delete" aria-label="Delete" />
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
};

const GridSkeleton = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    {[0, 1, 2].map(i => (
      <div key={i} className="card space-y-3 p-5">
        <div className="flex justify-between"><Skeleton className="h-5 w-24 !rounded-full" /><Skeleton className="h-4 w-16" /></div>
        <Skeleton className="h-4" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-3/5" />
      </div>
    ))}
  </div>
);

const Posts = () => {
  const user = useCurrentUser();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return TABS.some(x => x.value === t) ? t : 'all';
  });
  const [drafts, setDrafts] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      await waitForSaves();
      const res = await axios.get(`${API_URL}/api/drafts?status=${tab}`, { withCredentials: true });
      setDrafts(res.data.drafts);
      setCounts(res.data.counts);
    } catch (err) {
      if (err.response?.status === 401) { window.location.href = '/'; return; }
      setError('Could not load your posts.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
    window.history.replaceState(window.history.state, '', tab === 'all' ? '/posts' : `/posts?tab=${tab}`);
  }, [load, tab]);

  const act = async (draft, fn, message) => {
    setBusyId(draft.id);
    try {
      await fn();
      if (message) toast.success(message);
      await load({ quiet: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (d) => act(d, () => axios.delete(`${API_URL}/api/drafts/${d.id}`, { withCredentials: true }), 'Deleted.');
  const handleUnschedule = (d) => act(d, () => axios.post(`${API_URL}/api/drafts/${d.id}/unschedule`, {}, { withCredentials: true }), 'Schedule cancelled. The post is back in your drafts.');
  const handleDuplicate = async (d) => {
    setBusyId(d.id);
    try {
      const res = await axios.post(`${API_URL}/api/drafts/${d.id}/duplicate`, {}, { withCredentials: true });
      navigate(`/compose?draft=${res.data.id}`);
    } catch {
      toast.error('Could not duplicate this post.');
      setBusyId(null);
    }
  };

  const linkedin = user ? connectionInfo(user, 'linkedin') : null;
  const hasLinkedInAccount = user?.socialAccounts?.some(a => a.provider === 'linkedin');
  const options = TABS.map(t => ({ ...t, count: counts[t.value], alert: t.value === 'failed' }));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
      <PageHeader
        eyebrow="Library"
        title="Posts"
        description="Your drafts, scheduled posts and everything you've published."
        actions={<Button variant="accent" size="lg" icon={Plus} to="/compose">New post</Button>}
      />

      {hasLinkedInAccount && (linkedin.expired || linkedin.expiringSoon) && (
        <Banner
          tone={linkedin.expired ? 'danger' : 'warning'}
          icon={AlertCircle}
          className="mb-6"
          title={linkedin.expired ? 'LinkedIn connection expired' : `LinkedIn connection ${formatExpiry(linkedin).toLowerCase()}`}
          action={<Button href={reconnectUrl('linkedin', '/posts')} variant="accent" size="sm" icon={RefreshCw}>Reconnect LinkedIn</Button>}
        >
          {linkedin.expired ? 'Scheduled posts will fail until you reconnect.' : 'Reconnect to keep scheduled posts working.'}
        </Banner>
      )}

      <div className="mb-6">
        <Segmented options={options} value={tab} onChange={setTab} />
      </div>

      {loading ? (
        <GridSkeleton />
      ) : error ? (
        <EmptyState icon={AlertCircle} title={error} action={<Button variant="outline" icon={RefreshCw} onClick={() => load()}>Try again</Button>} />
      ) : drafts.length === 0 ? (
        <EmptyState
          icon={tab === 'failed' ? CheckCircle2 : Files}
          title={EMPTY[tab][0]}
          action={(tab === 'all' || tab === 'draft') && <Button variant="accent" icon={PenLine} to="/compose">Write a post</Button>}
        >
          {EMPTY[tab][1]}
        </EmptyState>
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {drafts.map((d, i) => (
              <PostCard
                key={d.id}
                index={i}
                draft={d}
                busy={busyId === d.id}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onUnschedule={handleUnschedule}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

export default Posts;
