import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { onWakeChange } from '../lib/serverWake';

// Shown while the free server is waking up after being idle.
export default function WakeNotice() {
  const [waking, setWaking] = useState(false);
  useEffect(() => onWakeChange(setWaking), []);
  return (
    <AnimatePresence>
      {waking && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="liquid-glass fixed left-1/2 top-20 z-[95] flex -translate-x-1/2 items-center gap-2.5 rounded-full !bg-surface px-4 py-2.5 text-sm font-medium text-ink"
        >
          <Loader2 className="h-4 w-4 animate-spin text-accent-ink" />
          Waking up the server. On the free plan this can take up to a minute.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
