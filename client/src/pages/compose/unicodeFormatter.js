/**
 * Converts HTML-formatted text into LinkedIn-ready Unicode-styled plain text.
 * LinkedIn strips all HTML, so we use Unicode Mathematical character sets
 * to preserve bold, italic, bold-italic, and strikethrough styling.
 *
 * Characters are generated via String.fromCodePoint() to avoid
 * embedding raw multi-byte Unicode literals that break Vite's parser.
 */

// --- Unicode Code Point Ranges ---
// Mathematical Sans-Serif Bold: U+1D5D4 (A) to U+1D607
const BOLD_UPPER_START = 0x1D5D4;
const BOLD_LOWER_START = 0x1D5EE;
const BOLD_DIGIT_START = 0x1D7EC;

// Mathematical Sans-Serif Italic: U+1D608 (A) to U+1D63B
const ITALIC_UPPER_START = 0x1D608;
const ITALIC_LOWER_START = 0x1D622;

// Mathematical Sans-Serif Bold Italic: U+1D63C (A) to U+1D66F
const BOLD_ITALIC_UPPER_START = 0x1D63C;
const BOLD_ITALIC_LOWER_START = 0x1D656;

function mapChar(ch, upperStart, lowerStart, digitStart) {
  const code = ch.charCodeAt(0);

  // Uppercase A-Z
  if (code >= 65 && code <= 90 && upperStart) {
    return String.fromCodePoint(upperStart + (code - 65));
  }
  // Lowercase a-z
  if (code >= 97 && code <= 122 && lowerStart) {
    return String.fromCodePoint(lowerStart + (code - 97));
  }
  // Digits 0-9
  if (code >= 48 && code <= 57 && digitStart) {
    return String.fromCodePoint(digitStart + (code - 48));
  }
  return ch;
}

function toBoldUnicode(text) {
  return [...text].map(ch => mapChar(ch, BOLD_UPPER_START, BOLD_LOWER_START, BOLD_DIGIT_START)).join('');
}

function toItalicUnicode(text) {
  return [...text].map(ch => mapChar(ch, ITALIC_UPPER_START, ITALIC_LOWER_START, null)).join('');
}

function toBoldItalicUnicode(text) {
  return [...text].map(ch => mapChar(ch, BOLD_ITALIC_UPPER_START, BOLD_ITALIC_LOWER_START, BOLD_DIGIT_START)).join('');
}

// Strikethrough uses combining character U+0336
function toStrikethroughUnicode(text) {
  return [...text].map(ch => ch + '\u0336').join('');
}

/**
 * Recursively walks a DOM tree and converts HTML formatting to Unicode text.
 * Handles nested formatting (e.g., <b><i>text</i></b> -> bold-italic Unicode).
 */
function walkNode(node, flags) {
  if (!flags) flags = { bold: false, italic: false, strike: false, underline: false };

  if (node.nodeType === Node.TEXT_NODE) {
    var text = node.textContent;

    if (flags.bold && flags.italic) {
      text = toBoldItalicUnicode(text);
    } else if (flags.bold) {
      text = toBoldUnicode(text);
    } else if (flags.italic) {
      text = toItalicUnicode(text);
    }

    if (flags.strike) {
      text = toStrikethroughUnicode(text);
    }

    // Underline: use combining underline U+0332
    if (flags.underline) {
      text = [...text].map(ch => ch + '\u0332').join('');
    }

    return text;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  var tag = node.tagName ? node.tagName.toUpperCase() : '';
  var newFlags = {
    bold: flags.bold,
    italic: flags.italic,
    strike: flags.strike,
    underline: flags.underline
  };

  // Update flags based on tag
  if (tag === 'B' || tag === 'STRONG') newFlags.bold = true;
  if (tag === 'I' || tag === 'EM') newFlags.italic = true;
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') newFlags.strike = true;
  if (tag === 'U') newFlags.underline = true;

  var result = '';

  // Handle block-level elements
  if (tag === 'BR') return '\n';
  if (tag === 'DIV' || tag === 'P') {
    result += '\n';
  }
  if (tag === 'LI') {
    var parent = node.parentElement;
    if (parent && parent.tagName === 'OL') {
      var index = Array.from(parent.children).indexOf(node) + 1;
      result += index + '. ';
    } else {
      result += '\u2022 '; // bullet
    }
  }

  // Recurse into children
  var children = node.childNodes;
  for (var i = 0; i < children.length; i++) {
    result += walkNode(children[i], newFlags);
  }

  // Add newline after block elements
  if (tag === 'DIV' || tag === 'P' || tag === 'LI') {
    if (!result.endsWith('\n')) result += '\n';
  }
  if (tag === 'UL' || tag === 'OL') {
    if (!result.endsWith('\n')) result += '\n';
  }

  // Handle links - show URL in parentheses
  if (tag === 'A' && node.href) {
    var linkText = result.trim();
    var url = node.getAttribute('href');
    if (linkText && linkText !== url) {
      return linkText + ' (' + url + ')';
    }
    return url || '';
  }

  return result;
}

/**
 * Main export: converts an HTML string to LinkedIn-ready Unicode plain text.
 * Preserves: bold, italic, bold-italic, strikethrough, underline,
 * lists, line breaks, emojis, links, and spacing.
 */
export function htmlToLinkedInText(html) {
  if (!html) return '';

  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  var text = walkNode(tempDiv);

  // Clean up excessive newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}
