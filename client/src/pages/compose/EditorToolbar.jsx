import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Undo2, Redo2, RemoveFormatting, Smile, Link2, X
} from 'lucide-react';

const EMOJI_LIST = [
  '🚀', '🔥', '💡', '✅', '📌', '🎯', '💪', '👏', '🙌', '❤️',
  '⭐', '📈', '🏆', '💼', '🤝', '🎉', '📣', '👉', '🧠', '🌟',
  '💬', '📝', '🔑', '⚡', '🛠️', '📊', '🌍', '✨', '🎓', '🤔'
];

// Declared outside the toolbar so React doesn't remount them on every render
const ToolButton = ({ onClick, title, children, active }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()} // Prevent editor blur
    onClick={onClick}
    title={title}
    aria-label={title}
    aria-pressed={active}
    className={`rounded-lg p-2 transition-all duration-150 active:scale-90 ${active ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}
  >
    {children}
  </button>
);

const Divider = () => <div className="mx-1 h-6 w-px bg-line" />;

// Pop-in animation for the emoji and link popovers
const POP = {
  initial: { opacity: 0, y: -6, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  style: { transformOrigin: 'top left' },
};

// --- Manual DOM Wrapping Helpers ---

function wrapSelectionWithTag(tagName, editorRef, onContentChange) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  // Only operate inside the editor
  if (!editorRef.current || !editorRef.current.contains(range.commonAncestorContainer)) return;

  // Check if already wrapped with this tag
  let parentEl = range.commonAncestorContainer;
  if (parentEl.nodeType === Node.TEXT_NODE) parentEl = parentEl.parentElement;
  
  if (parentEl && parentEl.tagName === tagName.toUpperCase() && parentEl !== editorRef.current) {
    // Unwrap: replace the tag with its contents
    const fragment = document.createDocumentFragment();
    while (parentEl.firstChild) {
      fragment.appendChild(parentEl.firstChild);
    }
    parentEl.parentNode.replaceChild(fragment, parentEl);
    if (onContentChange) onContentChange(editorRef.current.innerHTML);
    return;
  }

  if (range.collapsed) return;

  try {
    const wrapper = document.createElement(tagName);
    range.surroundContents(wrapper);
    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    selection.addRange(newRange);
  } catch {
    // If surroundContents fails (partial selection across nodes), use extractContents
    const fragment = range.extractContents();
    const wrapper = document.createElement(tagName);
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
  }

  if (onContentChange) onContentChange(editorRef.current.innerHTML);
}

function insertListInEditor(listType, editorRef, onContentChange) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!editorRef.current || !editorRef.current.contains(range.commonAncestorContainer)) return;

  const selectedText = range.toString();
  const lines = selectedText ? selectedText.split('\n').filter(l => l.trim()) : [''];

  const list = document.createElement(listType);
  lines.forEach(line => {
    const li = document.createElement('li');
    li.textContent = line || '\u200B'; // zero-width space for empty
    list.appendChild(li);
  });

  range.deleteContents();
  range.insertNode(list);

  // Place cursor inside last li
  const lastLi = list.lastElementChild;
  if (lastLi) {
    const newRange = document.createRange();
    newRange.selectNodeContents(lastLi);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }

  if (onContentChange) onContentChange(editorRef.current.innerHTML);
}

const EditorToolbar = ({ editorRef, onContentChange }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const exec = (command) => {
    editorRef.current?.focus();
    document.execCommand(command, false, null);
    if (onContentChange) onContentChange(editorRef.current.innerHTML);
  };

  const handleStrikethrough = () => {
    editorRef.current?.focus();
    wrapSelectionWithTag('s', editorRef, onContentChange);
  };

  const handleBulletList = () => {
    editorRef.current?.focus();
    insertListInEditor('ul', editorRef, onContentChange);
  };

  const handleNumberedList = () => {
    editorRef.current?.focus();
    insertListInEditor('ol', editorRef, onContentChange);
  };

  const handleEmoji = (emoji) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, emoji);
    if (onContentChange) onContentChange(editorRef.current.innerHTML);
    setShowEmojiPicker(false);
  };

  const handleInsertLink = () => {
    if (!linkUrl.trim()) return;
    editorRef.current?.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    const anchor = document.createElement('a');
    anchor.href = linkUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = linkText || linkUrl;

    range.deleteContents();
    range.insertNode(anchor);

    // Move cursor after the link
    const newRange = document.createRange();
    newRange.setStartAfter(anchor);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    // Insert a space after link
    document.execCommand('insertText', false, ' ');

    if (onContentChange) onContentChange(editorRef.current.innerHTML);
    setShowLinkInput(false);
    setLinkUrl('');
    setLinkText('');
  };


  return (
    <div className="relative rounded-t-[1.25rem] border-b border-line bg-surface-2/40 px-3 py-2">
      <div className="flex items-center flex-wrap gap-0.5">
        <ToolButton onClick={() => exec('bold')} title="Bold (Cmd+B)">
          <Bold className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => exec('italic')} title="Italic (Cmd+I)">
          <Italic className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => exec('underline')} title="Underline (Cmd+U)">
          <Underline className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={handleStrikethrough} title="Strikethrough (Cmd+Shift+S)">
          <Strikethrough className="w-4 h-4" />
        </ToolButton>

        <Divider />

        <ToolButton onClick={handleBulletList} title="Bullet List">
          <List className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={handleNumberedList} title="Numbered List">
          <ListOrdered className="w-4 h-4" />
        </ToolButton>

        <Divider />

        <ToolButton onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Emoji" active={showEmojiPicker}>
          <Smile className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => setShowLinkInput(!showLinkInput)} title="Insert Link" active={showLinkInput}>
          <Link2 className="w-4 h-4" />
        </ToolButton>

        <Divider />

        <ToolButton onClick={() => exec('undo')} title="Undo (Cmd+Z)">
          <Undo2 className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => exec('redo')} title="Redo (Cmd+Shift+Z)">
          <Redo2 className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => exec('removeFormat')} title="Clear Formatting">
          <RemoveFormatting className="w-4 h-4" />
        </ToolButton>
      </div>

      <AnimatePresence>
      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <motion.div key="emoji" {...POP} className="card absolute left-0 top-full z-50 mt-2 w-72 !bg-surface-solid p-3 !shadow-float">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Emoji</span>
            <button onClick={() => setShowEmojiPicker(false)} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-10 gap-1">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleEmoji(emoji)}
                className="cursor-pointer rounded-lg p-1 text-xl transition-transform duration-150 hover:scale-125 hover:bg-surface-2"
              >
                {emoji}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Link Input Popup */}
      {showLinkInput && (
        <motion.div key="link" {...POP} className="card absolute left-0 top-full z-50 mt-2 w-80 !bg-surface-solid p-4 !shadow-float">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Insert link</span>
            <button onClick={() => setShowLinkInput(false)} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Link text (optional)"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            className="field mb-2 !py-2 !text-sm"
          />
          <input
            type="url"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInsertLink()}
            className="field mb-3 !py-2 !text-sm"
          />
          <button
            onClick={handleInsertLink}
            disabled={!linkUrl.trim()}
            className="w-full rounded-xl bg-primary py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Insert link
          </button>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};

export default EditorToolbar;
