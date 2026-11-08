import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, CalendarClock, Send, Check } from 'lucide-react';
import { htmlToLinkedInText } from './unicodeFormatter';
import { Button } from '../../components/ui';

const ActionBar = ({ editorHtml, onScheduleClick, onPostNow, isPosting, providerName = 'LinkedIn' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(htmlToLinkedInText(editorHtml));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const hasContent = editorHtml && editorHtml.replace(/<br\s*\/?>/g, '').replace(/<div><\/div>/g, '').trim().length > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-[1.25rem] border-t border-line bg-surface-2/40 px-4 py-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={handleCopy}
          disabled={!hasContent}
          className={copied ? '!border-success/40 !text-success' : ''}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? 'done' : 'copy'}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </motion.span>
          </AnimatePresence>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="outline" icon={CalendarClock} onClick={onScheduleClick} disabled={!hasContent || isPosting}>
          Schedule
        </Button>
      </div>

      <Button variant="accent" size="lg" icon={Send} onClick={onPostNow} disabled={!hasContent} loading={isPosting} className="!h-11">
        {isPosting ? 'Posting…' : `Post to ${providerName}`}
      </Button>
    </div>
  );
};

export default ActionBar;
