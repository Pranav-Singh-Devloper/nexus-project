import React, { useState, useMemo, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { ThumbsUp, MessageCircle, Repeat2, Send, Globe, FileText, Image, Smile } from 'lucide-react';
import { motion } from 'framer-motion';

// --- Preview Transform Pipeline ---

function transformForPreview(cleanHtml) {
  if (!cleanHtml) return '';

  let result = cleanHtml;

  // Detect URLs not already inside <a> tags and wrap them
  // Negative lookbehind for href=" or > to avoid double-wrapping
  result = result.replace(
    /(?<!href="|>)(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="li-link">$1</a>'
  );

  // Detect hashtags (not already inside a tag) and wrap them
  result = result.replace(
    /(^|[\s>])(#\w[\w]*)/g,
    '$1<span class="li-hashtag">$2</span>'
  );

  return result;
}

const LinkedInPreview = ({ html, user, imageUrl, isGeneratingImage }) => {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef(null);
  const [isTruncated, setIsTruncated] = useState(false);

  // Sanitize + transform
  const previewHtml = useMemo(() => {
    if (!html || html === '<br>' || html === '<div><br></div>') return '';

    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'u', 's', 'br', 'ul', 'ol', 'li', 'a', 'span', 'p', 'div', 'strong', 'em', 'strike', 'del'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
    });

    return transformForPreview(clean);
  }, [html]);

  // Measure content height for truncation
  useEffect(() => {
    if (contentRef.current) {
      const lineHeight = 24; // ~1.5rem
      const maxLines = 4;
      const maxHeight = lineHeight * maxLines;
      setIsTruncated(contentRef.current.scrollHeight > maxHeight + 8);
    }
  }, [previewHtml]);

  const isEmpty = !previewHtml;

  const userName = user?.name || 'Your Name';
  const userAvatar = user?.avatar || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {userAvatar ? (
            <img src={userAvatar} alt="" className="w-12 h-12 rounded-full border-2 border-slate-100 shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-white text-lg font-bold shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h4 className="font-semibold text-[15px] text-slate-900 leading-tight">{userName}</h4>
            <p className="text-xs text-slate-500 leading-tight mt-0.5 truncate">Nexus User • Building something great</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
              <span>12h</span>
              <span>•</span>
              <Globe className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        {isEmpty ? (
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4">
              <FileText className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm text-slate-400 font-medium mb-2">Start writing and your post will appear here...</p>
            <div className="flex justify-center gap-4 text-xs text-slate-300">
              <span className="flex items-center gap-1"><Smile className="w-3 h-3" /> Emojis</span>
              <span className="flex items-center gap-1"><Image className="w-3 h-3" /> Images</span>
              <span className="flex items-center gap-1 text-[#0A66C2]/40"># Hashtags</span>
            </div>
          </div>
        ) : (
          <div>
            <div className="relative">
              <div
                ref={contentRef}
                className={`
                  text-[14px] leading-[24px] text-slate-800 break-words
                  [&_.li-hashtag]:text-[#0A66C2] [&_.li-hashtag]:font-semibold [&_.li-hashtag]:cursor-pointer [&_.li-hashtag]:hover:underline
                  [&_.li-link]:text-[#0A66C2] [&_.li-link]:hover:underline
                  [&_b]:font-bold [&_strong]:font-bold
                  [&_i]:italic [&_em]:italic
                  [&_u]:underline
                  [&_s]:line-through [&_strike]:line-through [&_del]:line-through
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1
                  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1
                  [&_li]:mb-0.5
                  ${!expanded && isTruncated ? 'max-h-[96px] overflow-hidden' : ''}
                `}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
              {isTruncated && !expanded && (
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              )}
            </div>
            {isTruncated && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium mt-1 transition-colors relative z-10"
              >
                {expanded ? '...show less' : '...more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Image Preview */}
      {isGeneratingImage && (
        <div className="w-full aspect-[4/3] sm:aspect-[1.91/1] bg-slate-100 animate-pulse flex items-center justify-center border-y border-slate-100">
           <div className="flex flex-col items-center gap-2 text-slate-400">
               <Image className="w-8 h-8 animate-pulse" />
               <span className="text-sm font-medium">Generating visual...</span>
           </div>
        </div>
      )}
      {!isGeneratingImage && imageUrl && (
        <div className="w-full relative border-y border-slate-100 bg-slate-50">
          <img src={imageUrl} alt="Generated visual content" className="w-full object-contain max-h-[500px]" />
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 border-t border-slate-100 mt-2" />

      {/* Action Row */}
      <div className="flex justify-around py-2 px-2">
        {[
          { icon: ThumbsUp, label: 'Like' },
          { icon: MessageCircle, label: 'Comment' },
          { icon: Repeat2, label: 'Repost' },
          { icon: Send, label: 'Send' },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors text-sm font-medium"
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default LinkedInPreview;
