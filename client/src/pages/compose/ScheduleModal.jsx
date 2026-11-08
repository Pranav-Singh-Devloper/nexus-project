import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, CalendarCheck } from 'lucide-react';
import { Button, Modal } from '../../components/ui';

const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// One-tap suggestions; LinkedIn engagement tends to peak on weekday mornings.
function quickPicks() {
  const now = new Date();
  const inHour = new Date(now.getTime() + 60 * 60 * 1000);
  inHour.setMinutes(Math.ceil(inHour.getMinutes() / 15) * 15, 0, 0);

  const tomorrow9 = new Date(now);
  tomorrow9.setDate(now.getDate() + 1);
  tomorrow9.setHours(9, 0, 0, 0);

  const monday9 = new Date(now);
  monday9.setDate(now.getDate() + (((8 - now.getDay()) % 7) || 7));
  monday9.setHours(9, 0, 0, 0);

  const picks = [
    { label: 'In 1 hour', date: inHour },
    { label: 'Tomorrow, 9 AM', date: tomorrow9 },
    { label: 'Monday, 9 AM', date: monday9 },
  ];
  // On Sundays "tomorrow" is Monday; keep only one of them
  return picks.filter((p, i) => picks.findIndex(q => q.date.getTime() === p.date.getTime()) === i);
}

const ScheduleModal = ({ isOpen, onClose, onConfirm, isScheduling }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const handleConfirm = () => {
    if (!date || !time) return;
    // The user picks local time; the server expects UTC
    onConfirm(new Date(`${date}T${time}:00`).toISOString());
    setDate('');
    setTime('');
  };

  const today = toDateInput(new Date());
  const picked = date && time ? new Date(`${date}T${time}:00`) : null;
  const inPast = picked && picked <= new Date();

  return (
    <Modal
      open={isOpen}
      onClose={isScheduling ? undefined : onClose}
      title="Schedule post"
      description="Pick when it should go live. Times are in your local time zone."
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={isScheduling}>Cancel</Button>
          <Button variant="accent" icon={CalendarCheck} onClick={handleConfirm} disabled={!picked || inPast} loading={isScheduling}>
            {isScheduling ? 'Scheduling…' : 'Schedule'}
          </Button>
        </>
      )}
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {quickPicks().map((q, i) => {
          const active = date === toDateInput(q.date) && time === toTimeInput(q.date);
          return (
            <motion.button
              key={q.label}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => { setDate(toDateInput(q.date)); setTime(toTimeInput(q.date)); }}
              disabled={isScheduling}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? 'border-accent bg-accent/15 text-accent-ink' : 'border-line bg-surface-2/60 text-ink-soft hover:border-accent/40 hover:text-ink'
              }`}
            >
              {q.label}
            </motion.button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-soft"><Calendar className="h-3.5 w-3.5" /> Date</span>
          <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} disabled={isScheduling} className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-soft"><Clock className="h-3.5 w-3.5" /> Time</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={isScheduling} className="field" />
        </label>
      </div>

      {picked && (
        <motion.p
          key={`${date}${time}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-4 rounded-xl px-3 py-2.5 text-xs ${inPast ? 'bg-danger/10 text-danger' : 'bg-surface-2 text-ink-soft'}`}
        >
          {inPast ? 'That time has already passed. Pick a later one.' : (
            <>Goes live <span className="font-semibold text-ink">{picked.toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></>
          )}
        </motion.p>
      )}
    </Modal>
  );
};

export default ScheduleModal;
