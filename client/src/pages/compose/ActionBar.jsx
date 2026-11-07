import React, { useState } from 'react';
import { Copy, Calendar, Send, Check, Loader2 } from 'lucide-react';
import { htmlToLinkedInText } from './unicodeFormatter';

const ActionBar = ({ editorHtml, onScheduleClick, onPostNow, isPosting }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const linkedInText = htmlToLinkedInText(editorHtml);

    try {
      await navigator.clipboard.writeText(linkedInText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const hasContent = editorHtml && editorHtml.replace(/<br\s*\/?>/g, '').replace(/<div><\/div>/g, '').trim().length > 0;

  return (
    <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-3 rounded-b-xl flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          disabled={!hasContent}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${copied
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300'
            }
            disabled:opacity-40 disabled:cursor-not-allowed
          `}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>

        <button
          onClick={onScheduleClick}
          disabled={!hasContent || isPosting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Calendar className="w-4 h-4" />
          Schedule
        </button>
      </div>

      <button
        onClick={onPostNow}
        disabled={!hasContent || isPosting}
        className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-[#0A66C2] text-white hover:bg-[#004182] shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        {isPosting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Posting...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Post Now
          </>
        )}
      </button>
    </div>
  );
};

export default ActionBar;
