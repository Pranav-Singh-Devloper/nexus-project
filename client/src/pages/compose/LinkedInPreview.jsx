import { useState, useMemo, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { ThumbsUp, MessageCircle, Repeat2, Send, Globe, FileText, Image, Smile } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

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
      className="card overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {userAvatar ? (
            <img src={userAvatar} alt="" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-line" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-on-accent">
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h4 className="text-[15px] font-semibold leading-tight text-ink">{userName}</h4>
            <p className="mt-0.5 truncate text-xs leading-tight text-muted">Nexus User • Building something great</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted">
              <span>Now</span>
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
            <div className="mb-4 inline-flex h-16 w-16 animate-float items-center justify-center rounded-full bg-surface-2">
              <FileText className="h-7 w-7 text-muted" />
            </div>
            <p className="mb-2 text-sm font-medium text-muted">Start writing and your post will appear here…</p>
            <div className="flex justify-center gap-4 text-xs text-muted/70">
              <span className="flex items-center gap-1"><Smile className="w-3 h-3" /> Emojis</span>
              <span className="flex items-center gap-1"><Image className="w-3 h-3" /> Images</span>
              <span className="flex items-center gap-1 text-info/70"># Hashtags</span>
            </div>
          </div>
        ) : (
          <div>
            <div className="relative">
              <div
                ref={contentRef}
                className={`
                  text-[14px] leading-[24px] text-ink break-words
                  [&_.li-hashtag]:text-info [&_.li-hashtag]:font-semibold [&_.li-hashtag]:cursor-pointer [&_.li-hashtag]:hover:underline
                  [&_.li-link]:text-info [&_.li-link]:hover:underline
                  [&_b]:font-bold [&_strong]:font-bold
                  [&_i]:italic [&_em]:italic
                  [&_u]:underline
                  [&_s]:line-through [&_strike]:line-through [&_del]:line-through
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1
                  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1
                  [&_li]:mb-0.5 [&_p]:mb-3 [&_a]:text-info
                  ${!expanded && isTruncated ? 'max-h-[96px] overflow-hidden' : ''}
                `}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
              {isTruncated && !expanded && (
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
              )}
            </div>
            {isTruncated && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="relative z-10 mt-1 text-sm font-medium text-muted transition-colors hover:text-ink"
              >
                {expanded ? '...show less' : '...more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Image Preview */}
      <AnimatePresence mode="wait" initial={false}>
        {isGeneratingImage ? (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden border-y border-line bg-surface-2 sm:aspect-[1.91/1]"
          >
            <div className="skeleton absolute inset-0 !rounded-none opacity-70" />
            <div className="absolute -left-10 top-0 h-full w-1/2 animate-blob rounded-full bg-accent/20 blur-2xl" />
            <div className="relative flex flex-col items-center gap-2 text-ink-soft">
              <Image className="h-8 w-8 animate-float" />
              <span className="text-sm font-semibold">Painting your visual…</span>
            </div>
          </motion.div>
        ) : imageUrl ? (
          <motion.div
            key={imageUrl}
            initial={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full overflow-hidden border-y border-line bg-surface-2"
          >
            <img src={imageUrl} alt="Generated visual content" className="max-h-[500px] w-full object-contain" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Divider */}
      <div className="mx-4 mt-2 border-t border-line" />

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
            type="button"
            tabIndex={-1}
            className="group/act flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Icon className="h-4 w-4 transition-transform duration-200 group-hover/act:-rotate-12 group-hover/act:scale-110" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default LinkedInPreview;
