import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Layout, LogOut, PenLine, ExternalLink, AlertCircle, CheckCircle2, X, RefreshCw, Image, Files, Copy as CopyIcon, Loader2 } from 'lucide-react';
import { API_URL } from '../../config';
import { htmlToLinkedInText } from './unicodeFormatter';
import { connectionInfo, reconnectUrl, providerName } from '../../utils/connections';

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
  window.history.replaceState({}, '', draftId ? `/compose?draft=${draftId}` : '/compose');
};

const TextFormatterPage = () => {
  const [user, setUser] = useState(null);
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
  const [toast, setToast] = useState(null); // { type, message, postUrl?, reconnectUrl?, postsLink? }

  const editorRef = useRef(null);
  const debounceTimer = useRef(null);
  const autosaveTimer = useRef(null);

  const locked = !EDITABLE.includes(draftStatus);

  // Set default provider based on connected accounts
  useEffect(() => {
    if (user && user.socialAccounts) {
      const hasLi = user.socialAccounts.some(acc => acc.provider === 'linkedin');
      const hasX = user.socialAccounts.some(acc => acc.provider === 'x');
      if (!hasLi && hasX) setSelectedProvider('x');
    }
  }, [user]);

  // --- Auth check ---
  useEffect(() => {
    axios.get(`${API_URL}/api/current_user`, { withCredentials: true })
      .then(res => {
        if (!res.data) window.location.href = '/';
        setUser(res.data);
      })
      .catch(() => { window.location.href = '/'; });
  }, []);

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
      if (!newUrl) setToast({ type: 'error', message: 'Image generation returned no image. Try again.' });
    } catch {
      setToast({ type: 'error', message: 'Failed to generate companion image.' });
    } finally {
      setIsGeneratingImage(false);
    }
  }, []);

  // --- Load the draft from the URL, or move an old browser draft to the server ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('draft');
    const autoImage = params.get('autoImage') === '1';
    const reconnected = ['linkedin', 'x'].find(p => params.get(p) === 'success');
    if (reconnected) setToast({ type: 'success', message: `${providerName(reconnected)} connected. You're good to post.` });

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
        setToast({ type: 'error', message: id ? 'That draft could not be found.' : 'Could not load your draft.' });
        setComposeUrl(null);
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, [applyDraft, generateImage]);

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
            setComposeUrl(res.data.id);
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

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const onLeave = (e) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, []);

  // --- Auto-dismiss toast ---
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), toast.sticky ? 20000 : 8000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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
      setToast({ type: 'success', message: 'Copied into a new draft. You can edit it now.' });
    } catch {
      setToast({ type: 'error', message: 'Could not duplicate this post.' });
    }
  };

  const connection = user ? connectionInfo(user, selectedProvider) : null;
  const returnPath = draftId ? `/compose?draft=${draftId}` : '/compose';

  const handleSocialError = (err, fallback) => {
    const code = err.response?.data?.code;
    const name = providerName(selectedProvider);
    if (code === 'NO_TOKEN' || code === 'INVALID_TOKEN') { window.location.href = '/'; return; }
    if (code === 'TOKEN_EXPIRED' || code === 'PROVIDER_NOT_CONNECTED') {
      setToast({
        type: 'error',
        message: code === 'TOKEN_EXPIRED' ? `Your ${name} connection expired. Reconnect to continue. Your draft is saved.` : `${name} not connected.`,
        reconnectUrl: reconnectUrl(selectedProvider, returnPath),
        sticky: true,
      });
    } else if (code === 'RATE_LIMIT') {
      setToast({ type: 'error', message: `Rate limit exceeded for ${name}. Please try again later.` });
    } else {
      setToast({ type: 'error', message: err.response?.data?.error || fallback });
    }
  };

  // --- Post Now ---
  const handlePostNow = async () => {
    if (!connection?.connected) {
      setToast({ type: 'error', message: `${providerName(selectedProvider)} not connected.`, reconnectUrl: reconnectUrl(selectedProvider, returnPath) });
      return;
    }
    const text = toPlainText(selectedProvider, editorHtml);
    if (!text.trim()) return;

    setIsPosting(true);
    setToast(null);
    try {
      const id = await flushSave();
      const res = await axios.post(
        `${API_URL}/api/social/${selectedProvider}/post`,
        { text, imageUrl, draftId: id },
        { withCredentials: true }
      );
      startNewDraft();
      setToast({
        type: 'success',
        message: `Posted successfully to ${providerName(selectedProvider)}!`,
        postUrl: res.data.postUrl,
        postsLink: true,
      });
    } catch (err) {
      handleSocialError(err, `Failed to post to ${providerName(selectedProvider)}`);
    } finally {
      setIsPosting(false);
    }
  };

  // --- Schedule ---
  const handleScheduleConfirm = async (utcDateString) => {
    if (!connection?.connected) {
      setToast({ type: 'error', message: `${providerName(selectedProvider)} not connected.`, reconnectUrl: reconnectUrl(selectedProvider, returnPath) });
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
      setToast(res.data.warning
        ? { type: 'error', message: `Scheduled for ${displayTime}. ${res.data.warning}`, reconnectUrl: reconnectUrl(selectedProvider, '/posts'), postsLink: true, sticky: true }
        : { type: 'success', message: `Post scheduled for ${displayTime}`, postsLink: true });
    } catch (err) {
      setScheduleOpen(false);
      handleSocialError(err, 'Failed to schedule post');
    } finally {
      setIsScheduling(false);
    }
  };

  if (!user || !loaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  const isCurrentProviderConnected = !!connection?.connected;
  const name = providerName(selectedProvider);
  const maxChars = selectedProvider === 'x' ? 280 : 3000;
  const currentLength = editorHtml?.replace(/<[^>]*>/g, '').length || 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white px-6 py-3.5 shadow-sm flex justify-between items-center sticky top-0 z-30 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-xl font-bold flex items-center gap-2 text-slate-900 hover:opacity-80 transition-opacity">
            <Layout className="w-5 h-5" /> Nexus
          </a>
          <span className="text-slate-300">/</span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <PenLine className="w-4 h-4" /> Compose
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/posts" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            <Files className="w-4 h-4" /> Posts
          </a>
          <a href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={user.avatar} alt="User" className="w-8 h-8 rounded-full border" />
            <span className="text-sm font-medium hidden sm:block">{user.name}</span>
          </a>
          <a href={`${API_URL}/api/logout`} className="text-slate-500 hover:text-red-500 transition-colors" title="Logout">
            <LogOut className="w-5 h-5" />
          </a>
        </div>
      </nav>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-right duration-300 ${
          toast.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        } rounded-xl shadow-lg p-4`}>
          <div className="flex items-start gap-3">
            {toast.type === 'success' 
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              : <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{toast.message}</p>
              {toast.postUrl && (
                <a 
                  href={toast.postUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#0A66C2] hover:underline mt-1.5"
                >
                  View on {toast.postUrl.includes('x.com') ? 'X' : 'LinkedIn'} <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {toast.reconnectUrl && (
                  <a
                    href={toast.reconnectUrl}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0A66C2] hover:bg-[#004182] px-3 py-1.5 rounded-lg mt-2 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Reconnect {toast.reconnectUrl.includes('/auth/x') ? 'X' : 'LinkedIn'}
                  </a>
                )}
                {toast.postsLink && (
                  <a href="/posts" className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:underline mt-2">
                    <Files className="w-3 h-3" /> View all posts
                  </a>
                )}
              </div>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Post Composer</h1>
            <p className="text-sm text-slate-500 mt-1">Write, format, and preview your post before publishing.</p>
          </div>
          
          {/* Platform Selector */}
          <div className="flex bg-slate-200/50 p-1 rounded-lg self-start">
            <button
              onClick={() => setSelectedProvider('linkedin')}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                selectedProvider === 'linkedin' 
                  ? 'bg-white text-[#0A66C2] shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              LinkedIn
            </button>
            <button
              onClick={() => setSelectedProvider('x')}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                selectedProvider === 'x' 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              X (Twitter)
            </button>
          </div>
        </div>

        {/* Source + locked banners */}
        {draftProject && (
          <p className="mb-4 text-xs text-slate-500">
            Generated from research: <a href={`/projects/${draftProject.id}`} className="font-medium text-slate-700 hover:underline">{draftProject.title}</a>
          </p>
        )}
        {locked && (
          <div className="mb-6 bg-slate-100 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <AlertCircle className="w-5 h-5 text-slate-500 shrink-0" />
            <p className="flex-1 text-sm text-slate-700">
              This post is already <span className="font-semibold">{draftStatus}</span>, so it can't be edited. Make a copy to reuse it.
            </p>
            <button onClick={duplicateDraft} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-lg transition-colors">
              <CopyIcon className="w-3.5 h-3.5" /> Duplicate as new draft
            </button>
          </div>
        )}

        {/* Connection status */}
        {!locked && (!connection?.connected || connection?.expiringSoon) && (
          <div className={`mb-6 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 border ${
            connection?.expired ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
          }`}>
            <AlertCircle className={`w-5 h-5 shrink-0 ${connection?.expired ? 'text-red-500' : 'text-amber-500'}`} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${connection?.expired ? 'text-red-800' : 'text-amber-800'}`}>
                {connection?.expired
                  ? `Your ${name} connection has expired`
                  : connection?.expiringSoon
                    ? `Your ${name} connection expires in ${connection.daysLeft} day${connection.daysLeft === 1 ? '' : 's'}`
                    : `${name} not connected`}
              </p>
              <p className={`text-xs mt-0.5 ${connection?.expired ? 'text-red-600' : 'text-amber-600'}`}>
                {selectedProvider === 'linkedin'
                  ? 'LinkedIn connections last 60 days. Reconnecting takes a few seconds and your draft stays here.'
                  : 'Connect your account to publish and schedule posts.'}
              </p>
            </div>
            <a href={reconnectUrl(selectedProvider, returnPath)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors self-start sm:self-auto ${
              connection?.expired ? 'text-red-700 bg-red-100 hover:bg-red-200' : 'text-amber-700 bg-amber-100 hover:bg-amber-200'
            }`}>
              {connection?.expired || connection?.expiringSoon ? `Reconnect ${name}` : `Connect ${name}`}
            </a>
          </div>
        )}

        {/* Split Panel Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Panel — Editor */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <EditorToolbar
                editorRef={editorRef}
                onContentChange={handleContentChange}
              />
              <RichTextEditor
                ref={editorRef}
                value={editorHtml}
                onContentChange={handleContentChange}
              />
              {!locked && (
                <ActionBar
                  editorHtml={editorHtml}
                  onScheduleClick={() => setScheduleOpen(true)}
                  onPostNow={handlePostNow}
                  isPosting={isPosting}
                  providerConnected={isCurrentProviderConnected}
                />
              )}
            </div>

            {/* Save status */}
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-2">
                {saveState === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>}
                {saveState === 'saved' && <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Draft saved</>}
                {saveState === 'error' && <><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> <span className="text-red-500">Couldn't save. Retrying when you type again.</span></>}
                {saveState === 'idle' && !locked && <><span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Start typing. Drafts save automatically.</>}
              </span>
              <span className="flex items-center gap-3">
                {draftId && !locked && (
                  <button onClick={() => { flushSave().catch(() => {}).finally(startNewDraft); }} className="font-medium text-slate-500 hover:text-slate-800">
                    New post
                  </button>
                )}
                <a href="/posts" className="font-medium text-slate-500 hover:text-slate-800">All drafts</a>
              </span>
            </div>
          </div>

          {/* Right Panel — Preview */}
          <div className="w-full lg:w-[420px] shrink-0">
            <div className="sticky top-20">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-slate-700">Post Preview</span>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Live</span>
              </div>

              <LinkedInPreview
                html={previewHtml}
                user={user}
                imageUrl={imageUrl}
                isGeneratingImage={isGeneratingImage}
              />

              {/* Image Controls */}
              {imagePrompt && (
                <div className="mt-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                       <Image className="w-4 h-4" /> AI Visual
                     </span>
                     {imageUrl && (
                        <button 
                          onClick={() => { setImageUrl(null); setImagePrompt(''); dirty.current = true; }} 
                          className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                        >Remove</button>
                     )}
                  </div>
                  <textarea 
                     className="w-full text-xs text-slate-600 bg-slate-50 border border-slate-200 p-2 rounded-lg resize-none outline-none focus:ring-1 focus:ring-slate-300" 
                     rows="3" 
                     value={imagePrompt}
                     onChange={(e) => { setImagePrompt(e.target.value); dirty.current = true; }}
                     placeholder="Detailed prompt for the companion image..."
                  />
                  <div className="mt-2 flex justify-end gap-2">
                     <button 
                       onClick={() => generateImage(imagePrompt, imageStyle)}
                       className="flex items-center gap-1 bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                       disabled={isGeneratingImage || !imagePrompt.trim()}
                     >
                       {isGeneratingImage ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                       Regenerate
                     </button>
                  </div>
                </div>
              )}

              {/* Character count */}
              <div className="mt-3 text-right">
                <span className={`text-xs font-mono ${
                  currentLength > maxChars
                    ? 'text-red-500'
                    : 'text-slate-400'
                }`}>
                  {currentLength} / {maxChars.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Schedule Modal */}
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
