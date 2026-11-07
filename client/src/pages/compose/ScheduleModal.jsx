import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, Loader2 } from 'lucide-react';

const ScheduleModal = ({ isOpen, onClose, onConfirm, isScheduling }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const handleConfirm = () => {
    if (!date || !time) return;

    // Convert local date + time to a UTC ISO string
    // The user picks local time; we must send UTC to the server
    const localDateTime = new Date(`${date}T${time}:00`);
    const utcDateString = localDateTime.toISOString();

    onConfirm(utcDateString);

    // Reset inputs on next open
    setDate('');
    setTime('');
  };

  // Get today's date in YYYY-MM-DD format for date min
  const today = new Date().toISOString().split('T')[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Schedule Post</h3>
              <button
                onClick={onClose}
                disabled={isScheduling}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Date
                </label>
                <input
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isScheduling}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent outline-none transition-shadow disabled:opacity-50"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={isScheduling}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent outline-none transition-shadow disabled:opacity-50"
                />
              </div>

              {date && time && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                  Will be published on{' '}
                  <span className="font-semibold text-slate-700">
                    {new Date(`${date}T${time}:00`).toLocaleString(undefined, {
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true
                    })}
                  </span>
                  {' '}(your local time)
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isScheduling}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!date || !time || isScheduling}
                className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold bg-[#0A66C2] text-white hover:bg-[#004182] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isScheduling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  'Confirm Schedule'
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ScheduleModal;
