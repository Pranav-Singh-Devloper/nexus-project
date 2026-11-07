import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Layout, LogOut, PenLine, ExternalLink, AlertCircle, CheckCircle2, X, RefreshCw, Image } from 'lucide-react';
import { API_URL } from '../../config';
import { htmlToLinkedInText } from './unicodeFormatter';

import EditorToolbar from './EditorToolbar';
import RichTextEditor from './RichTextEditor';
import LinkedInPreview from './LinkedInPreview';
import ActionBar from './ActionBar';
import ScheduleModal from './ScheduleModal';

const STORAGE_KEY = 'nexus_linkedin_draft';
const AUTOSAVE_INTERVAL = 2000;
const PREVIEW_DEBOUNCE = 150;

const TextFormatterPage = () => {
  const [user, setUser] = useState(null);
  const [editorHtml, setEditorHtml] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  
  // Image Generation States
  const [imageUrl, setImageUrl] = useState(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageStyle, setImageStyle] = useState('square');
  const [imageStatus, setImageStatus] = useState('none');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('linkedin');

  // Set default provider based on connected accounts
  useEffect(() => {
    if (user && user.socialAccounts) {
      const hasLi = user.socialAccounts.some(acc => acc.provider === 'linkedin');
      const hasX = user.socialAccounts.some(acc => acc.provider === 'x');
      if (!hasLi && hasX) setSelectedProvider('x');
    }
  }, [user]);

  // Posting states
  const [isPosting, setIsPosting] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message, postUrl? }

  const editorRef = useRef(null);
  const debounceTimer = useRef(null);
  const autosaveTimer = useRef(null);

  // --- Auth check ---
  useEffect(() => {
    axios.get(`${API_URL}/api/current_user`, { withCredentials: true })
      .then(res => {
        if (!res.data) window.location.href = '/';
        setUser(res.data);
      });
  }, []);

  // --- Restore draft from localStorage ---
  useEffect(() => {
    const saved = localStorage.getItem('nexus_linkedin_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.version === 1) {
          setEditorHtml(data.post_html || '');
          setPreviewHtml(data.post_html || '');
          setImageUrl(data.image_url || null);
          setImagePrompt(data.image_prompt || '');
          setImageStyle(data.image_style || 'square');
          setImageStatus(data.image_status || 'none');
        }
      } catch {
        // Fallback for legacy
        setEditorHtml(saved);
        setPreviewHtml(saved);
      }
    } else {
        const legacy = localStorage.getItem(STORAGE_KEY);
        if (legacy) {
            setEditorHtml(legacy);
            setPreviewHtml(legacy);
        }
    }
  }, []);

  // --- Async Image Generation Trigger ---
  useEffect(() => {
    if (imageStatus === 'pending' && imagePrompt && !isGeneratingImage) {
      handleRegenerateImage(imagePrompt, imageStyle);
    }
  }, [imageStatus, imagePrompt]);

  const handleRegenerateImage = async (prompt, style) => {
    setIsGeneratingImage(true);
    setImageStatus('generating');
    try {
      const res = await axios.post(`${API_URL}/api/generate-image`, {
        prompt: prompt || imagePrompt,
        style: style || imageStyle
      }, { withCredentials: true });
      
      const newUrl = res.data.image_url || null;
      setImageUrl(newUrl);
      setImageStatus(newUrl ? 'ready' : 'failed');
      
      // Update local storage
      const saved = localStorage.getItem('nexus_linkedin_data');
      if (saved) {
         try {
             const data = JSON.parse(saved);
             data.image_url = newUrl;
             data.image_status = newUrl ? 'ready' : 'failed';
             localStorage.setItem('nexus_linkedin_data', JSON.stringify(data));
         } catch { /* ignore corrupt draft */ }
      }
      
    } catch {
      setImageUrl(null);
      setImageStatus('failed');
      setToast({ type: 'error', message: 'Failed to generate companion image.' });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // --- Auto-save to localStorage ---
  useEffect(() => {
    autosaveTimer.current = setInterval(() => {
      if (editorHtml) {
        const saved = localStorage.getItem('nexus_linkedin_data');
        if (saved) {
           try {
               const data = JSON.parse(saved);
               data.post_html = editorHtml;
               localStorage.setItem('nexus_linkedin_data', JSON.stringify(data));
           } catch {
               localStorage.setItem(STORAGE_KEY, editorHtml);
           }
        } else {
           localStorage.setItem(STORAGE_KEY, editorHtml);
        }
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(autosaveTimer.current);
  }, [editorHtml]);

  // --- Auto-dismiss toast ---
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- Debounced preview update ---
  const handleContentChange = useCallback((html) => {
    setEditorHtml(html);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPreviewHtml(html);
    }, PREVIEW_DEBOUNCE);
  }, []);

  // --- Post Now ---
  const handlePostNow = async () => {
    const isConnected = user?.socialAccounts?.some(acc => acc.provider === selectedProvider);
    if (!isConnected) {
      setToast({
        type: 'error',
        message: `${selectedProvider === 'x' ? 'X' : 'LinkedIn'} not connected. Go to your Profile to connect.`
      });
      return;
    }

    const text = selectedProvider === 'linkedin' 
      ? htmlToLinkedInText(editorHtml)
      : editorHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<p[^>]*>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!text.trim()) return;

    setIsPosting(true);
    setToast(null);

    try {
      const res = await axios.post(
        `${API_URL}/api/social/${selectedProvider}/post`,
        { text, imageUrl },
        { withCredentials: true }
      );

      // Success — clear editor
      setEditorHtml('');
      setPreviewHtml('');
      setImageUrl(null);
      setImagePrompt('');
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('nexus_linkedin_data');
      if (editorRef.current) editorRef.current.innerHTML = '';

      setToast({
        type: 'success',
        message: `Posted successfully to ${selectedProvider === 'x' ? 'X' : 'LinkedIn'}!`,
        postUrl: res.data.postUrl
      });

    } catch (err) {
      const code = err.response?.data?.code;
      const message = err.response?.data?.error || 'Failed to post to LinkedIn';

      if (code === 'NO_TOKEN' || code === 'INVALID_TOKEN') {
        // Session expired — redirect to login
        window.location.href = '/';
        return;
      } else if (code === 'TOKEN_EXPIRED') {
        setToast({
          type: 'error',
          message: `${selectedProvider === 'x' ? 'X' : 'LinkedIn'} token expired. Reconnect to continue posting.`,
          reconnectUrl: `${API_URL}/auth/${selectedProvider}`
        });
      } else if (code === 'PROVIDER_NOT_CONNECTED') {
        setToast({
          type: 'error',
          message: `${selectedProvider === 'x' ? 'X' : 'LinkedIn'} not connected.`,
          reconnectUrl: `${API_URL}/auth/${selectedProvider}`
        });
      } else if (code === 'RATE_LIMIT') {
        setToast({
          type: 'error',
          message: `Rate limit exceeded for ${selectedProvider === 'x' ? 'X' : 'LinkedIn'}. Please try again later.`
        });
      } else {
        setToast({ type: 'error', message });
      }
    } finally {
      setIsPosting(false);
    }
  };

  // --- Schedule ---
  const handleScheduleConfirm = async (utcDateString) => {
    const isConnected = user?.socialAccounts?.some(acc => acc.provider === selectedProvider);
    if (!isConnected) {
      setToast({
        type: 'error',
        message: `${selectedProvider === 'x' ? 'X' : 'LinkedIn'} not connected. Go to your Profile to connect.`
      });
      setScheduleOpen(false);
      return;
    }

    const text = selectedProvider === 'linkedin' 
      ? htmlToLinkedInText(editorHtml)
      : editorHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<p[^>]*>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!text.trim()) return;

    setIsScheduling(true);

    try {
      const res = await axios.post(
        `${API_URL}/api/social/${selectedProvider}/schedule`,
        { text, scheduledAt: utcDateString, imageUrl },
        { withCredentials: true }
      );

      setScheduleOpen(false);

      // Format the scheduled time for display
      const scheduledDate = new Date(res.data.scheduledAt);
      const displayTime = scheduledDate.toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        hour12: true
      });

      setToast({
        type: 'success',
        message: `Post scheduled for ${displayTime}`
      });

    } catch (err) {
      const message = err.response?.data?.error || 'Failed to schedule post';
      setToast({ type: 'error', message });
    } finally {
      setIsScheduling(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  const hasLinkedIn = user.socialAccounts?.some(acc => acc.provider === 'linkedin');
  const hasX = user.socialAccounts?.some(acc => acc.provider === 'x');
  const isCurrentProviderConnected = selectedProvider === 'x' ? hasX : hasLinkedIn;
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
              {toast.reconnectUrl && (
                <a
                  href={toast.reconnectUrl}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0A66C2] hover:bg-[#004182] px-3 py-1.5 rounded-lg mt-2 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Reconnect {toast.reconnectUrl.includes('/x') ? 'X' : 'LinkedIn'}
                </a>
              )}
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

        {/* Connection warning */}
        {!isCurrentProviderConnected && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">{selectedProvider === 'x' ? 'X' : 'LinkedIn'} not connected</p>
              <p className="text-xs text-amber-600 mt-0.5">Connect your account to publish and schedule posts.</p>
            </div>
            <a href="/profile" className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">
              Connect Now
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
              <ActionBar
                editorHtml={editorHtml}
                onScheduleClick={() => setScheduleOpen(true)}
                onPostNow={handlePostNow}
                isPosting={isPosting}
                providerConnected={isCurrentProviderConnected}
              />
            </div>

            {/* Draft indicator */}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Draft auto-saved locally
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
                          onClick={() => { setImageUrl(null); setImagePrompt(''); setImageStatus('none'); }} 
                          className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                        >Remove</button>
                     )}
                  </div>
                  <textarea 
                     className="w-full text-xs text-slate-600 bg-slate-50 border border-slate-200 p-2 rounded-lg resize-none outline-none focus:ring-1 focus:ring-slate-300" 
                     rows="3" 
                     value={imagePrompt}
                     onChange={(e) => setImagePrompt(e.target.value)}
                     placeholder="Detailed prompt for the companion image..."
                  />
                  <div className="mt-2 flex justify-end gap-2">
                     <button 
                       onClick={() => handleRegenerateImage(imagePrompt, imageStyle)}
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
