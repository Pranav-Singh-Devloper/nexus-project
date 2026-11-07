import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';

// --- Cursor Save / Restore Utilities ---

function saveCursorPosition(containerEl) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!containerEl.contains(range.startContainer)) return null;

  // Walk text nodes to compute a flat character offset
  let charOffset = 0;
  let found = false;

  const walk = (node) => {
    if (found) return;
    if (node === range.startContainer) {
      charOffset += range.startOffset;
      found = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      charOffset += node.textContent.length;
    } else if (node.nodeName === 'BR') {
      charOffset += 1;
    } else {
      for (const child of node.childNodes) {
        walk(child);
        if (found) return;
      }
    }
  };

  walk(containerEl);
  return found ? charOffset : null;
}

function restoreCursorPosition(containerEl, targetOffset) {
  if (targetOffset === null || targetOffset === undefined) return;

  const selection = window.getSelection();
  if (!selection) return;

  let currentOffset = 0;
  let targetNode = null;
  let targetNodeOffset = 0;
  let found = false;

  const walk = (node) => {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent.length;
      if (currentOffset + len >= targetOffset) {
        targetNode = node;
        targetNodeOffset = targetOffset - currentOffset;
        found = true;
        return;
      }
      currentOffset += len;
    } else if (node.nodeName === 'BR') {
      if (currentOffset + 1 >= targetOffset) {
        targetNode = node.parentNode;
        targetNodeOffset = Array.from(node.parentNode.childNodes).indexOf(node) + 1;
        found = true;
        return;
      }
      currentOffset += 1;
    } else {
      for (const child of node.childNodes) {
        walk(child);
        if (found) return;
      }
    }
  };

  walk(containerEl);

  if (targetNode) {
    try {
      const range = document.createRange();
      range.setStart(targetNode, Math.min(targetNodeOffset, targetNode.length || targetNode.childNodes.length));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      // Silently fail on invalid positions
    }
  }
}

const RichTextEditor = forwardRef(({ value, onContentChange }, ref) => {
  const editorRef = useRef(null);
  const cursorPosRef = useRef(null);
  const isInternalUpdate = useRef(false);

  // Expose editorRef to parent
  useImperativeHandle(ref, () => editorRef.current);

  // Sync external value changes (like restore from localStorage)
  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    isInternalUpdate.current = false;
  }, [value]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    // Save cursor before syncing state
    cursorPosRef.current = saveCursorPosition(editorRef.current);
    isInternalUpdate.current = true;
    onContentChange(editorRef.current.innerHTML);
  }, [onContentChange]);

  // Restore cursor after React re-render
  useEffect(() => {
    if (isInternalUpdate.current && cursorPosRef.current !== null && editorRef.current) {
      restoreCursorPosition(editorRef.current, cursorPosRef.current);
    }
  });

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const plainText = e.clipboardData.getData('text/plain');
    // Convert newlines to <br> and sanitize
    const safeText = plainText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    document.execCommand('insertHTML', false, safeText);
    if (onContentChange) onContentChange(editorRef.current.innerHTML);
  }, [onContentChange]);

  const handleKeyDown = useCallback((e) => {
    const isMod = e.metaKey || e.ctrlKey;

    if (isMod && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold');
      if (onContentChange) onContentChange(editorRef.current.innerHTML);
    } else if (isMod && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic');
      if (onContentChange) onContentChange(editorRef.current.innerHTML);
    } else if (isMod && e.key === 'u') {
      e.preventDefault();
      document.execCommand('underline');
      if (onContentChange) onContentChange(editorRef.current.innerHTML);
    } else if (isMod && e.shiftKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      document.execCommand('strikeThrough');
      if (onContentChange) onContentChange(editorRef.current.innerHTML);
    }
  }, [onContentChange]);

  return (
    <div className="flex-1 relative">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        data-placeholder="Write your LinkedIn post..."
        className="
          min-h-[300px] max-h-[500px] overflow-y-auto
          px-5 py-4 text-base text-slate-800 leading-relaxed
          outline-none bg-white
          empty:before:content-[attr(data-placeholder)]
          empty:before:text-slate-400 empty:before:pointer-events-none
          [&_b]:font-bold [&_i]:italic [&_u]:underline [&_s]:line-through
          [&_a]:text-[#0A66C2] [&_a]:underline
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2
          [&_li]:mb-1
        "
        role="textbox"
        aria-label="Post editor"
        aria-multiline="true"
      />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;
