import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ExternalLink, AlertCircle, RefreshCw, Image, Files, Copy as CopyIcon, Lock, Linkedin, Twitter,
  BookOpen, Plus, Trash2, Wand2,
} from 'lucide-react';
import { API_URL } from '../../config';
import { htmlToLinkedInText } from './unicodeFormatter';
import { connectionInfo, reconnectUrl, providerName } from '../../utils/connections';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { useToast } from '../../lib/toast';
import { ease, fadeUp, stagger } from '../../lib/motion';
import { trackSave } from '../../lib/draftSync';
import { Banner, Button, Card, PageHeader, Segmented, Skeleton } from '../../components/ui';

import EditorToolbar from './EditorToolbar';
import RichTextEditor from './RichTextEditor';
import LinkedInPreview from './LinkedInPreview';
import ActionBar from './ActionBar';
import ScheduleModal from './ScheduleModal';

// Old browser-only drafts (before drafts were saved to the server)
const LEGACY_KEYS = ['nexus_linkedin_data', 'nexus_linkedin_draft'];
const AUTOSAVE_DELAY = 1200;
const PREVIEW_DEBOUNCE = 150;
const EDITABLE = ['draft', 'failed'];

const PROVIDERS = [
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'x', label: 'X', icon: Twitter },
];

const hasText = (html) => !!html && html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;

const toPlainText = (provider, html) => provider === 'linkedin'
  ? htmlToLinkedInText(html)
  : html.replace(/<br\s*\/?>/gi, '\n').replace(/<p[^>]*>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();

function readLegacyDraft() {
  try {
    const raw = localStorage.getItem('nexus_linkedin_data');
    if (raw) {
      const data = JSON.parse(raw);
      if (data?.post_html) return { html: data.post_html, imageUrl: data.image_url || null, imagePrompt: data.image_prompt || '', imageStyle: data.image_style || 'square', hashtags: data.hashtags || [] };
    }
    const html = localStorage.getItem('nexus_linkedin_draft');
    if (hasText(html)) return { html };
  } catch { /* storage unavailable or corrupt */ }
  return null;
}

function clearLegacyDraft() {
  try { LEGACY_KEYS.forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
}

const setComposeUrl = (draftId) => {
  window.history.replaceState(window.history.state, '', draftId ? `/compose?draft=${draftId}` : '/compose');
};

// Ring that fills as the post approaches the platform's character limit.
const CharRing = ({ length, max }) => {
  const r = 9;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, length / max);
  const over = length > max;
  const near = !over && pct > 0.9;
  const color = over ? 'var(--danger)' : near ? 'var(--warning)' : 'var(--accent)';
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90">
        <circle cx="12" cy="12" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
        <motion.circle
          cx="12" cy="12" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.4, ease }}
        />
      </svg>
      <span className={`font-mono text-xs tabular-nums ${over ? 'text-danger' : 'text-muted'}`}>
        {length.toLocaleString()} / {max.toLocaleString()}
      </span>
    </span>
  );
};

const SaveStatus = ({ state, locked }) => {
  const map = {
    saving: { dot: 'bg-warning animate-pulse', text: 'Saving…' },
    saved: { dot: 'bg-success', text: 'Draft saved' },
    error: { dot: 'bg-danger', text: "Couldn't save. Retrying when you type again.", cls: 'text-danger' },
    idle: { dot: 'bg-line-strong', text: 'Start typing. Drafts save automatically.' },
  };
  if (locked) return <span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Read only</span>;
  const s = map[state] || map.idle;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={state}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center gap-2 ${s.cls || ''}`}
      >
        <span className={`h-2 w-2 rounded-full ${s.dot}`} /> {s.text}
      </motion.span>
    </AnimatePresence>
  );
};

const TextFormatterPage = () => {
  const user = useCurrentUser();
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [editorHtml, setEditorHtml] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');

  // Server draft
  const [draftId, setDraftId] = useState(null);
  const [draftStatus, setDraftStatus] = useState('draft');
  const [draftProject, setDraftProject] = useState(null);
  const [hashtags, setHashtags] = useState([]);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const draftIdRef = useRef(null);
  const createPromise = useRef(null);
  const dirty = useRef(false);

  // Image Generation States
  const [imageUrl, setImageUrl] = useState(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageStyle, setImageStyle] = useState('square');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('linkedin');

  // Posting states
  const [isPosting, setIsPosting] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const editorRef = useRef(null);
  const debounceTimer = useRef(null);
  const autosaveTimer = useRef(null);

  const locked = !EDITABLE.includes(draftStatus);

  // Toast with optional "view post", "reconnect" and "all posts" actions
  const notify = useCallback((type, message, { postUrl, reconnect, postsLink, sticky } = {}) => {
    const actions = [];
    if (reconnect) actions.push({ label: `Reconnect ${reconnect.includes('/auth/x') ? 'X' : 'LinkedIn'}`, href: reconnect, icon: RefreshCw, primary: true });
    if (postUrl) actions.push({ label: `View on ${postUrl.includes('x.com') ? 'X' : 'LinkedIn'}`, href: postUrl, external: true, icon: ExternalLink });
    if (postsLink) actions.push({ label: 'View all posts', to: '/posts', icon: Files });
    toast[type](message, { actions, sticky });
  }, [toast]);

  // Set default provider based on connected accounts
  useEffect(() => {
    if (user && user.socialAccounts) {
      const hasLi = user.socialAccounts.some(acc => acc.provider === 'linkedin');
      const hasX = user.socialAccounts.some(acc => acc.provider === 'x');
      if (!hasLi && hasX) setSelectedProvider('x');
    }
  }, [user]);

  const applyDraft = useCallback((d) => {
    draftIdRef.current = d.id;
    setDraftId(d.id);
    setDraftStatus(d.status);
    setDraftProject(d.project || null);
    setEditorHtml(d.html || '');
    setPreviewHtml(d.html || '');
    setImageUrl(d.imageUrl || null);
    setImagePrompt(d.imagePrompt || '');
    setImageStyle(d.imageStyle || 'square');
    setHashtags(d.hashtags || []);
  }, []);

  const generateImage = useCallback(async (prompt, style) => {
    if (!prompt?.trim()) return;
    setIsGeneratingImage(true);
    try {
      const res = await axios.post(`${API_URL}/api/generate-image`, { prompt, style }, { withCredentials: true });
      const newUrl = res.data.image_url || null;
      setImageUrl(newUrl);
      dirty.current = true;
      if (!newUrl) toast.error('Image generation returned no image. Try again.');
    } catch {
      toast.error('Failed to generate companion image.');
    } finally {
      setIsGeneratingImage(false);
    }
  }, [toast]);

  // --- Load the draft from the URL, or move an old browser draft to the server ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('draft');
    const autoImage = params.get('autoImage') === '1';
    const reconnected = ['linkedin', 'x'].find(p => params.get(p) === 'success');
    if (reconnected) toast.success(`${providerName(reconnected)} connected. You're good to post.`);

    const load = async () => {
      try {
        if (id) {
          const res = await axios.get(`${API_URL}/api/drafts/${id}`, { withCredentials: true });
          applyDraft(res.data);
          setSaveState('saved');
          setComposeUrl(res.data.id);
          if (autoImage && res.data.imagePrompt && !res.data.imageUrl) {
            generateImage(res.data.imagePrompt, res.data.imageStyle || 'square');
          }
          return;
        }
        const legacy = readLegacyDraft();
        if (legacy) {
          const res = await axios.post(`${API_URL}/api/drafts`, legacy, { withCredentials: true });
          clearLegacyDraft();
          applyDraft(res.data);
          setSaveState('saved');
          setComposeUrl(res.data.id);
          if (legacy.imagePrompt && !legacy.imageUrl) generateImage(legacy.imagePrompt, legacy.imageStyle);
        } else {
          setComposeUrl(null);
        }
      } catch (err) {
        if (err.response?.status === 401) { window.location.href = '/'; return; }
        toast.error(id ? 'That draft could not be found.' : 'Could not load your draft.');
        setComposeUrl(null);
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, [applyDraft, generateImage, toast]);

  // --- Save to the server (creates the draft on first real content) ---
  const saveDraft = useCallback(async (fields) => {
    if (!draftIdRef.current) {
      if (!hasText(fields.html) && !fields.imageUrl) return null;
      if (!createPromise.current) {
        createPromise.current = axios.post(`${API_URL}/api/drafts`, fields, { withCredentials: true })
          .then(res => {
            draftIdRef.current = res.data.id;
            setDraftId(res.data.id);
            setDraftStatus(res.data.status);
            if (window.location.pathname === '/compose') setComposeUrl(res.data.id);
            return res.data.id;
          })
          .finally(() => { createPromise.current = null; });
      }
      return createPromise.current;
    }
    await axios.put(`${API_URL}/api/drafts/${draftIdRef.current}`, fields, { withCredentials: true });
    return draftIdRef.current;
  }, []);

  const currentFields = useCallback(() => ({
    html: editorRef.current?.innerHTML ?? editorHtml,
    imageUrl, imagePrompt, imageStyle, hashtags,
  }), [editorHtml, imageUrl, imagePrompt, imageStyle, hashtags]);

  // Save now (used before posting/scheduling and by the autosave timer)
  const flushSave = useCallback(async () => {
    clearTimeout(autosaveTimer.current);
    if (locked) return draftIdRef.current;
    setSaveState('saving');
    try {
      const id = await saveDraft(currentFields());
      dirty.current = false;
      setSaveState(id ? 'saved' : 'idle');
      return id;
    } catch (err) {
      setSaveState('error');
      throw err;
    }
  }, [locked, saveDraft, currentFields]);

  // --- Autosave shortly after the user stops typing ---
  useEffect(() => {
    if (!loaded || locked || !dirty.current) return;
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { flushSave().catch(() => {}); }, AUTOSAVE_DELAY);
    return () => clearTimeout(autosaveTimer.current);
  }, [editorHtml, imageUrl, imagePrompt, imageStyle, loaded, locked, flushSave]);

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    const onLeave = (e) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, []);

  // Moving to another page inside the app doesn't reload, so save on the way out
  const flushRef = useRef(flushSave);
  useEffect(() => { flushRef.current = flushSave; });
  useEffect(() => () => {
    if (dirty.current) trackSave(flushRef.current()).catch(() => {});
  }, []);

  // --- Debounced preview update ---
  const handleContentChange = useCallback((html) => {
    setEditorHtml(html);
    dirty.current = true;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPreviewHtml(html);
    }, PREVIEW_DEBOUNCE);
  }, []);

  // Start a fresh, empty draft (after posting/scheduling)
  const startNewDraft = () => {
    draftIdRef.current = null;
    dirty.current = false;
    setDraftId(null);
    setDraftStatus('draft');
    setDraftProject(null);
    setEditorHtml('');
    setPreviewHtml('');
    setImageUrl(null);
    setImagePrompt('');
    setHashtags([]);
    setSaveState('idle');
    if (editorRef.current) editorRef.current.innerHTML = '';
    setComposeUrl(null);
  };

  const duplicateDraft = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/drafts/${draftId}/duplicate`, {}, { withCredentials: true });
      applyDraft(res.data);
      setSaveState('saved');
      setComposeUrl(res.data.id);
      toast.success('Copied into a new draft. You can edit it now.');
    } catch {
      toast.error('Could not duplicate this post.');
    }
  };

  const connection = user ? connectionInfo(user, selectedProvider) : null;
  const returnPath = draftId ? `/compose?draft=${draftId}` : '/compose';

  const handleSocialError = (err, fallback) => {
    const code = err.response?.data?.code;
    const name = providerName(selectedProvider);
    if (code === 'NO_TOKEN' || code === 'INVALID_TOKEN') { window.location.href = '/'; return; }
    if (code === 'TOKEN_EXPIRED' || code === 'PROVIDER_NOT_CONNECTED') {
      notify('error',
        code === 'TOKEN_EXPIRED' ? `Your ${name} connection expired. Reconnect to continue. Your draft is saved.` : `${name} not connected.`,
        { reconnect: reconnectUrl(selectedProvider, returnPath), sticky: true });
    } else if (code === 'RATE_LIMIT') {
      toast.error(`Rate limit exceeded for ${name}. Please try again later.`);
    } else {
      toast.error(err.response?.data?.error || fallback);
    }
  };

  // --- Post Now ---
  const handlePostNow = async () => {
    if (!connection?.connected) {
      notify('error', `${providerName(selectedProvider)} not connected.`, { reconnect: reconnectUrl(selectedProvider, returnPath) });
      return;
    }
    const text = toPlainText(selectedProvider, editorHtml);
    if (!text.trim()) return;

    setIsPosting(true);
    try {
      const id = await flushSave();
      const res = await axios.post(
        `${API_URL}/api/social/${selectedProvider}/post`,
        { text, imageUrl, draftId: id },
        { withCredentials: true }
      );
      startNewDraft();
      notify('success', `Posted successfully to ${providerName(selectedProvider)}!`, { postUrl: res.data.postUrl, postsLink: true });
    } catch (err) {
      handleSocialError(err, `Failed to post to ${providerName(selectedProvider)}`);
    } finally {
      setIsPosting(false);
    }
  };

  // --- Schedule ---
  const handleScheduleConfirm = async (utcDateString) => {
    if (!connection?.connected) {
      notify('error', `${providerName(selectedProvider)} not connected.`, { reconnect: reconnectUrl(selectedProvider, returnPath) });
      setScheduleOpen(false);
      return;
    }
    const text = toPlainText(selectedProvider, editorHtml);
    if (!text.trim()) return;

    setIsScheduling(true);
    try {
      const id = await flushSave();
      const res = await axios.post(
        `${API_URL}/api/social/${selectedProvider}/schedule`,
        { text, scheduledAt: utcDateString, imageUrl, draftId: id },
        { withCredentials: true }
      );
      setScheduleOpen(false);
      startNewDraft();

      const displayTime = new Date(res.data.scheduledAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
      });
      if (res.data.warning) {
        notify('warning', `Scheduled for ${displayTime}. ${res.data.warning}`, { reconnect: reconnectUrl(selectedProvider, '/posts'), postsLink: true, sticky: true });
      } else {
        notify('success', `Post scheduled for ${displayTime}`, { postsLink: true });
      }
    } catch (err) {
      setScheduleOpen(false);
      handleSocialError(err, 'Failed to schedule post');
    } finally {
      setIsScheduling(false);
    }
  };

  if (!user || !loaded) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6">
        <Skeleton className="mb-3 h-4 w-28" />
        <Skeleton className="mb-10 h-10 w-72" />
        <div className="flex flex-col gap-6 lg:flex-row">
          <Skeleton className="h-[420px] flex-1 !rounded-[1.25rem]" />
          <Skeleton className="h-[420px] w-full !rounded-[1.25rem] lg:w-[420px]" />
        </div>
      </div>
    );
  }

  const name = providerName(selectedProvider);
  const maxChars = selectedProvider === 'x' ? 280 : 3000;
  const currentLength = editorHtml?.replace(/<[^>]*>/g, '').length || 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12">
      <PageHeader
        eyebrow="Composer"
        title={locked ? 'View post' : draftId ? 'Edit draft' : 'Write a post'}
        description="Write, format and preview your post before it goes live."
        actions={<Segmented options={PROVIDERS} value={selectedProvider} onChange={setSelectedProvider} />}
      />

      <motion.div initial="hidden" animate="show" variants={stagger(0.06)} className="space-y-4">
        {draftProject && (
          <motion.p variants={fadeUp} className="flex items-center gap-2 text-sm text-muted">
            <BookOpen className="h-4 w-4 text-accent-ink" /> Generated from
            <Link to={`/projects/${draftProject.id}`} className="link-draw font-semibold text-ink">{draftProject.title}</Link>
          </motion.p>
        )}
        {locked && (
          <Banner
            tone="neutral"
            icon={Lock}
            title={`This post is already ${draftStatus}`}
            action={<Button size="sm" variant="primary" icon={CopyIcon} onClick={duplicateDraft}>Duplicate as new draft</Button>}
          >
            It can't be edited. Make a copy to reuse it.
          </Banner>
        )}
        {!locked && (!connection?.connected || connection?.expiringSoon) && (
          <Banner
            tone={connection?.expired ? 'danger' : 'warning'}
            icon={AlertCircle}
            title={connection?.expired
              ? `Your ${name} connection has expired`
              : connection?.expiringSoon
                ? `Your ${name} connection expires in ${connection.daysLeft} day${connection.daysLeft === 1 ? '' : 's'}`
                : `${name} not connected`}
            action={(
              <Button href={reconnectUrl(selectedProvider, returnPath)} size="sm" variant="accent" icon={RefreshCw}>
                {connection?.expired || connection?.expiringSoon ? `Reconnect ${name}` : `Connect ${name}`}
              </Button>
            )}
          >
            {selectedProvider === 'linkedin'
              ? 'LinkedIn connections last 60 days. Reconnecting takes a few seconds and your draft stays here.'
              : 'Connect your account to publish and schedule posts.'}
          </Banner>
        )}
      </motion.div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Editor */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1, ease }} className="min-w-0 flex-1">
          <Card className="overflow-visible transition-[border-color,box-shadow] duration-300 focus-within:border-accent/50 focus-within:shadow-card">
            {!locked && <EditorToolbar editorRef={editorRef} onContentChange={handleContentChange} />}
            <RichTextEditor ref={editorRef} value={editorHtml} onContentChange={handleContentChange} readOnly={locked} />
            {!locked && (
              <ActionBar
                editorHtml={editorHtml}
                onScheduleClick={() => setScheduleOpen(true)}
                onPostNow={handlePostNow}
                isPosting={isPosting}
                providerName={name}
              />
            )}
          </Card>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 text-xs font-medium text-muted">
            <SaveStatus state={saveState} locked={locked} />
            <span className="flex items-center gap-1">
              {draftId && !locked && (
                <Button size="xs" variant="ghost" icon={Plus} onClick={() => { flushSave().catch(() => {}).finally(startNewDraft); }}>New post</Button>
              )}
              <Button size="xs" variant="ghost" icon={Files} to="/posts">All drafts</Button>
            </span>
          </div>
        </motion.div>

        {/* Preview */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.2, ease }} className="w-full shrink-0 lg:sticky lg:top-24 lg:w-[420px]">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              Live preview
            </span>
            <CharRing length={currentLength} max={maxChars} />
          </div>

          <LinkedInPreview html={previewHtml} user={user} imageUrl={imageUrl} isGeneratingImage={isGeneratingImage} />

          <AnimatePresence>
            {imagePrompt && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease }} className="overflow-hidden">
                <Card className="mt-4 p-4">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Image className="h-4 w-4 text-accent-ink" /> AI visual
                    </span>
                    {imageUrl && !locked && (
                      <Button size="xs" variant="danger-ghost" icon={Trash2} onClick={() => { setImageUrl(null); setImagePrompt(''); dirty.current = true; }}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <textarea
                    className="field resize-none !text-xs !leading-relaxed"
                    rows="3"
                    value={imagePrompt}
                    disabled={locked}
                    onChange={(e) => { setImagePrompt(e.target.value); dirty.current = true; }}
                    placeholder="Describe the companion image…"
                  />
                  {!locked && (
                    <div className="mt-2.5 flex justify-end">
                      <Button
                        size="sm"
                        variant="primary"
                        icon={imageUrl ? RefreshCw : Wand2}
                        loading={isGeneratingImage}
                        disabled={!imagePrompt.trim()}
                        onClick={() => generateImage(imagePrompt, imageStyle)}
                      >
                        {isGeneratingImage ? 'Generating…' : imageUrl ? 'Regenerate' : 'Generate image'}
                      </Button>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <ScheduleModal
        isOpen={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onConfirm={handleScheduleConfirm}
        isScheduling={isScheduling}
      />
    </div>
  );
};

export default TextFormatterPage;
