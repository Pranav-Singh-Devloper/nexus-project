import { useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import { NotebookPen, Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import { API_URL } from '../config';
import { useToast } from '../lib/toast';
import { ease } from '../lib/motion';
import { Button } from './ui';

// Analyst notes attached to a research project: add, edit and delete.
export default function NotesPanel({ projectId, notes, setNotes, className = '' }) {
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  const add = async () => {
    if (!draft.trim()) return;
    setAdding(true);
    try {
      const res = await axios.post(`${API_URL}/api/notes`, { content: draft, projectId }, { withCredentials: true });
      setNotes(list => [...list, res.data]);
      setDraft('');
    } catch {
      toast.error('Could not add the note.');
    } finally {
      setAdding(false);
    }
  };

  const save = async (id) => {
    try {
      const res = await axios.put(`${API_URL}/api/notes/${id}`, { content: editText }, { withCredentials: true });
      setNotes(list => list.map(n => (n.id === id ? res.data : n)));
      setEditingId(null);
    } catch {
      toast.error('Could not update the note.');
    }
  };

  const remove = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/notes/${id}`, { withCredentials: true });
      setNotes(list => list.filter(n => n.id !== id));
    } catch {
      toast.error('Could not delete the note.');
    } finally {
      setConfirmId(null);
    }
  };

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <NotebookPen className="h-4 w-4 text-accent-ink" /> Analyst notes
        </h3>
        {notes.length > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">{notes.length}</span>}
      </div>

      <div className="-mx-1 min-h-0 flex-1 space-y-2.5 overflow-y-auto px-1 pb-2">
        {notes.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">
            Jot down findings, follow-ups or angles for your post.
          </p>
        )}
        <AnimatePresence initial={false}>
          {notes.map(note => (
            <motion.div
              key={note.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, transition: { duration: 0.18 } }}
              transition={{ duration: 0.35, ease }}
              className="group relative rounded-2xl border border-line bg-surface p-3.5 text-sm shadow-soft transition-colors hover:border-line-strong"
            >
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea className="field resize-none !text-sm" rows="3" value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
                  <div className="flex justify-end gap-1.5">
                    <Button size="xs" variant="ghost" icon={X} onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button size="xs" variant="primary" icon={Check} onClick={() => save(note.id)} disabled={!editText.trim()}>Save</Button>
                  </div>
                </div>
              ) : confirmId === note.id ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-soft">Delete this note?</span>
                  <span className="flex gap-1.5">
                    <Button size="xs" variant="ghost" onClick={() => setConfirmId(null)}>Keep</Button>
                    <Button size="xs" variant="danger" onClick={() => remove(note.id)}>Delete</Button>
                  </span>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap break-words pr-14 leading-relaxed text-ink-soft">{note.content}</p>
                  <span className="mt-1.5 block text-[11px] font-medium text-muted">
                    {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="absolute right-2 top-2 flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button type="button" onClick={() => { setEditingId(note.id); setEditText(note.content); }} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Edit note">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setConfirmId(note.id)} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger" aria-label="Delete note">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-3 border-t border-line pt-4">
        <textarea
          className="field resize-none !text-sm"
          rows="2"
          placeholder="Add a finding…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(); }}
        />
        <Button variant="primary" icon={Plus} className="mt-2 w-full" onClick={add} loading={adding} disabled={!draft.trim()}>
          Add note
        </Button>
      </div>
    </div>
  );
}
