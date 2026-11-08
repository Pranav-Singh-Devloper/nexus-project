import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  Layout, Files, PenLine, Plus, Pencil, Trash2, Copy, ExternalLink, CalendarX, Eye,
  AlertCircle, Clock, CheckCircle2, XCircle, FileText, Loader2, RefreshCw, LogOut
} from 'lucide-react';
import { API_URL } from '../config';
import { connectionInfo, reconnectUrl, formatExpiry } from '../utils/connections';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
  { key: 'failed', label: 'Failed' },
];

const STATUS_STYLE = {
  draft: { label: 'Draft', icon: FileText, cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  scheduled: { label: 'Scheduled', icon: Clock, cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  published: { label: 'Published', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  failed: { label: 'Failed', icon: XCircle, cls: 'bg-red-50 text-red-700 border-red-100' },
};

const EMPTY_TEXT = {
  all: 'No posts yet. Write one in the composer or generate one from a research report.',
  draft: 'No drafts. Anything you write in the composer is saved here automatically.',
  scheduled: 'Nothing scheduled.',
  published: 'Nothing published from Nexus yet.',
  failed: 'No failed posts.',
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
  if (d.status === 'scheduled' && d.scheduledAt) return `Scheduled for ${formatDateTime(d.scheduledAt)}`;
  if (d.status === 'published' && d.publishedAt) return `Published ${formatDateTime(d.publishedAt)}`;
  return `Edited ${relativeTime(d.updatedAt)}`;
}

const providerLabel = (p) => (p === 'x' ? 'X' : p === 'linkedin' ? 'LinkedIn' : null);

const PostCard = ({ draft, busy, onDelete, onDuplicate, onUnschedule }) => {
  const [confirming, setConfirming] = useState(false);
  const status = STATUS_STYLE[draft.status] || STATUS_STYLE.draft;
  const StatusIcon = status.icon;
  const text = previewText(draft.html);
  const editable = draft.status === 'draft' || draft.status === 'failed';
  const btn = 'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50';

  return (
    <article className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
      <div className="p-4 flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${status.cls}`}>
            <StatusIcon className="w-3.5 h-3.5" /> {status.label}
            {providerLabel(draft.provider) && <span className="opacity-70">· {providerLabel(draft.provider)}</span>}
          </span>
          <span className="text-xs text-slate-400">{timeLabel(draft)}</span>
        </div>

        <div className="flex gap-3 min-w-0">
          <p className={`flex-1 min-w-0 text-sm whitespace-pre-line line-clamp-5 break-words ${text ? 'text-slate-700' : 'text-slate-400 italic'}`}>
            {text || 'Empty draft'}
          </p>
          {draft.imageUrl && (
            <img
              src={draft.imageUrl}
              alt=""
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-slate-100 shrink-0"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
        </div>

        {draft.status === 'failed' && draft.error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" /> {draft.error}
          </p>
        )}

        {draft.project && (
          <p className="text-xs text-slate-400 truncate">
            From research: <a href={`/projects/${draft.project.id}`} className="text-slate-600 hover:underline">{draft.project.title}</a>
          </p>
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2 flex items-center gap-1.5 flex-wrap">
        {confirming ? (
          <>
            <span className="text-xs text-slate-600 mr-auto">
              {draft.status === 'published' ? 'Remove from Nexus? The live post stays up.' : 'Delete this post?'}
            </span>
            <button className={`${btn} text-slate-600 hover:bg-slate-100`} onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
            <button className={`${btn} text-white bg-red-600 hover:bg-red-700`} onClick={() => onDelete(draft)} disabled={busy}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
            </button>
          </>
        ) : (
          <>
            {editable ? (
              <a href={`/compose?draft=${draft.id}`} className={`${btn} text-white bg-slate-800 hover:bg-slate-900`}>
                <Pencil className="w-3.5 h-3.5" /> {draft.status === 'failed' ? 'Edit & retry' : 'Edit'}
              </a>
            ) : (
              <a href={`/compose?draft=${draft.id}`} className={`${btn} text-slate-700 hover:bg-slate-100`}>
                <Eye className="w-3.5 h-3.5" /> View
              </a>
            )}
            {draft.status === 'published' && draft.postUrl && (
              <a href={draft.postUrl} target="_blank" rel="noopener noreferrer" className={`${btn} text-[#0A66C2] hover:bg-blue-50`}>
                <ExternalLink className="w-3.5 h-3.5" /> Open on {providerLabel(draft.provider) || 'site'}
              </a>
            )}
            {draft.status === 'scheduled' && (
              <button className={`${btn} text-slate-700 hover:bg-slate-100`} onClick={() => onUnschedule(draft)} disabled={busy}>
                <CalendarX className="w-3.5 h-3.5" /> Cancel schedule
              </button>
            )}
            <button className={`${btn} text-slate-700 hover:bg-slate-100`} onClick={() => onDuplicate(draft)} disabled={busy}>
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </button>
            <button className={`${btn} text-slate-500 hover:text-red-600 hover:bg-red-50 ml-auto`} onClick={() => setConfirming(true)} disabled={busy} aria-label="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </article>
  );
};

const Posts = () => {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return TABS.some(x => x.key === t) ? t : 'all';
  });
  const [drafts, setDrafts] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/api/current_user`, { withCredentials: true })
      .then(res => { if (!res.data) window.location.href = '/'; setUser(res.data); })
      .catch(() => { window.location.href = '/'; });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
    window.history.replaceState({}, '', tab === 'all' ? '/posts' : `/posts?tab=${tab}`);
  }, [load, tab]);

  const act = async (draft, fn, message) => {
    setBusyId(draft.id);
    setNotice(null);
    try {
      await fn();
      if (message) setNotice({ type: 'success', message });
      await load();
    } catch (err) {
      setNotice({ type: 'error', message: err.response?.data?.error || 'Something went wrong. Try again.' });
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
      window.location.href = `/compose?draft=${res.data.id}`;
    } catch {
      setNotice({ type: 'error', message: 'Could not duplicate this post.' });
      setBusyId(null);
    }
  };

  const linkedin = user ? connectionInfo(user, 'linkedin') : null;
  const hasLinkedInAccount = user?.socialAccounts?.some(a => a.provider === 'linkedin');

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white px-4 sm:px-6 py-3.5 shadow-sm flex justify-between items-center sticky top-0 z-30 border-b border-slate-100">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <a href="/dashboard" className="text-xl font-bold flex items-center gap-2 text-slate-900 hover:opacity-80 transition-opacity">
            <Layout className="w-5 h-5" /> Nexus
          </a>
          <span className="text-slate-300">/</span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Files className="w-4 h-4" /> Posts
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <a href="/compose" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            <PenLine className="w-4 h-4" /> <span className="hidden sm:inline">Compose</span>
          </a>
          {user && (
            <a href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src={user.avatar} alt="User" className="w-8 h-8 rounded-full border" />
            </a>
          )}
          <a href={`${API_URL}/api/logout`} className="text-slate-500 hover:text-red-500 transition-colors" title="Logout">
            <LogOut className="w-5 h-5" />
          </a>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Posts</h1>
            <p className="text-sm text-slate-500 mt-1">Your drafts, scheduled posts and post history.</p>
          </div>
          <a href="/compose" className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors self-start">
            <Plus className="w-4 h-4" /> New post
          </a>
        </div>

        {hasLinkedInAccount && (linkedin.expired || linkedin.expiringSoon) && (
          <div className={`mb-6 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 border ${linkedin.expired ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <AlertCircle className={`w-5 h-5 shrink-0 ${linkedin.expired ? 'text-red-500' : 'text-amber-500'}`} />
            <p className={`flex-1 text-sm ${linkedin.expired ? 'text-red-800' : 'text-amber-800'}`}>
              {linkedin.expired
                ? 'Your LinkedIn connection has expired, so scheduled posts will fail until you reconnect.'
                : `Your LinkedIn connection ${formatExpiry(linkedin).toLowerCase()}. Reconnect to keep scheduled posts working.`}
            </p>
            <a href={reconnectUrl('linkedin', '/posts')} className="text-xs font-semibold text-white bg-[#0A66C2] hover:bg-[#004182] px-3 py-1.5 rounded-lg self-start sm:self-auto inline-flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Reconnect LinkedIn
            </a>
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto pb-1 mb-6 border-b border-slate-200" role="tablist">
          {TABS.map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${t.key === 'failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {notice && (
          <div className={`mb-4 text-sm rounded-lg px-4 py-2.5 border ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {notice.message}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-slate-600 mb-3">{error}</p>
            <button onClick={load} className="text-sm font-medium text-slate-800 underline">Try again</button>
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
            <Files className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm max-w-sm mx-auto">{EMPTY_TEXT[tab]}</p>
            {(tab === 'all' || tab === 'draft') && (
              <a href="/compose" className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-slate-800 hover:underline">
                <PenLine className="w-4 h-4" /> Write a post
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {drafts.map(d => (
              <PostCard
                key={d.id}
                draft={d}
                busy={busyId === d.id}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onUnschedule={handleUnschedule}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Posts;
