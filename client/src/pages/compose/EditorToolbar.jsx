import React, { useState } from 'react';
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
    className={`p-2 rounded-lg transition-all duration-150 hover:bg-slate-100 active:scale-95 ${active ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-6 bg-slate-200 mx-1" />;

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
    anchor.style.color = '#0A66C2';
    anchor.style.textDecoration = 'underline';

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
    <div className="relative border-b border-slate-200 bg-white px-3 py-2 rounded-t-xl">
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

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-72 animate-in fade-in duration-150">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Emoji</span>
            <button onClick={() => setShowEmojiPicker(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-10 gap-1">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleEmoji(emoji)}
                className="text-xl p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Link Input Popup */}
      {showLinkInput && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-4 w-80 animate-in fade-in duration-150">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Insert Link</span>
            <button onClick={() => setShowLinkInput(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Link text (optional)"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <input
            type="url"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInsertLink()}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <button
            onClick={handleInsertLink}
            disabled={!linkUrl.trim()}
            className="w-full bg-[#0A66C2] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#004182] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Insert Link
          </button>
        </div>
      )}
    </div>
  );
};

export default EditorToolbar;
