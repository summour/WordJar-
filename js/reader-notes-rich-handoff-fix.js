// WordJar Reader Notes Rich Handoff Fix V1
// Keeps saved note HTML formatting when opening notes in Reader and Reader View.

(function installWordJarReaderNotesRichHandoffFix() {
  if (window.__wordjarReaderNotesRichHandoffFixInstalled) return;
  window.__wordjarReaderNotesRichHandoffFixInstalled = true;

  const RICH_STORAGE_KEY = 'wordjar_reader_note_html_v1';
  const RICH_NOTE_ID_KEY = 'wordjar_reader_active_note_id_v1';
  const RICH_SOURCE_ID = 'wordjarReaderRichSource';
  const RICH_STYLE_ID = 'wordjarReaderRichHandoffStyle';
  const ACTIVE_CLASS = 'wordjar-reader-rich-active';

  function ensureReaderData() {
    D.reader = D.reader || {};
    if (!Array.isArray(D.readerNotes)) D.readerNotes = [];
  }

  function escapeText(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(value);
    if (typeof escHTML === 'function') return escHTML(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeCSSColor(value) {
    const raw = String(value || '').trim();
    if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw;
    if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(raw)) return raw;
    if (/^[a-z]+$/i.test(raw) && !/expression|url|import|var/i.test(raw)) return raw;
    return '';
  }

  function safeCSSLength(value) {
    const raw = String(value || '').trim();
    if (/^-?\d+(?:\.\d+)?(?:px|em|rem|%|ch)?$/i.test(raw)) return raw;
    return '';
  }

  function sanitizeStyle(styleText) {
    const safe = [];
    String(styleText || '').split(';').forEach(part => {
      const index = part.indexOf(':');
      if (index < 0) return;
      const prop = part.slice(0, index).trim().toLowerCase();
      const value = part.slice(index + 1).trim();
      if (!prop || !value || /url\s*\(|expression\s*\(|javascript:/i.test(value)) return;

      if (prop === 'color' || prop === 'background' || prop === 'background-color') {
        const color = safeCSSColor(value);
        if (color) safe.push(`${prop === 'background' ? 'background-color' : prop}: ${color}`);
        return;
      }
      if (prop === 'font-weight' && /^(normal|bold|bolder|lighter|[1-9]00)$/i.test(value)) {
        safe.push(`font-weight: ${value}`);
        return;
      }
      if (prop === 'font-style' && /^(normal|italic|oblique)$/i.test(value)) {
        safe.push(`font-style: ${value}`);
        return;
      }
      if (prop === 'text-decoration' && /^(none|underline|line-through|underline line-through|line-through underline)$/i.test(value)) {
        safe.push(`text-decoration: ${value}`);
        return;
      }
      if (prop === 'text-align' && /^(left|right|center|justify)$/i.test(value)) {
        safe.push(`text-align: ${value}`);
        return;
      }
      if (['font-size', 'line-height', 'letter-spacing', 'text-indent', 'margin-left', 'padding-left'].includes(prop)) {
        const length = safeCSSLength(value);
        if (length) safe.push(`${prop}: ${length}`);
        return;
      }
      if ((prop === 'border-left-color' || prop === 'border-color') && safeCSSColor(value)) {
        safe.push(`${prop}: ${safeCSSColor(value)}`);
      }
    });
    return safe.join('; ');
  }

  function sanitizeRichHTML(html) {
    const allowedTags = new Set([
      'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'DIV', 'P', 'SPAN', 'MARK',
      'UL', 'OL', 'LI', 'A', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SUB', 'SUP'
    ]);
    const box = document.createElement('div');
    box.innerHTML = String(html || '');

    function clean(node) {
      [...node.childNodes].forEach(child => {
        if (child.nodeType !== Node.ELEMENT_NODE) return;

        if (!allowedTags.has(child.tagName)) {
          child.replaceWith(document.createTextNode(child.textContent || ''));
          return;
        }

        [...child.attributes].forEach(attr => {
          const name = attr.name.toLowerCase();
          if (name === 'href' && child.tagName === 'A') {
            const href = attr.value || '';
            if (/^(https?:|mailto:)/i.test(href)) {
              child.setAttribute('target', '_blank');
              child.setAttribute('rel', 'noopener noreferrer');
            } else {
              child.removeAttribute(attr.name);
            }
            return;
          }
          if (name === 'style' || name === 'data-color') return;
          child.removeAttribute(attr.name);
        });

        const style = sanitizeStyle(child.getAttribute('style') || '');
        if (style) child.setAttribute('style', style);
        else child.removeAttribute('style');

        if (child.hasAttribute('data-color')) {
          const color = safeCSSColor(child.getAttribute('data-color'));
          if (color) child.setAttribute('data-color', color);
          else child.removeAttribute('data-color');
        }

        clean(child);
      });
    }

    clean(box);
    return box.innerHTML;
  }

  function plainFromHTML(html) {
    const box = document.createElement('div');
    box.innerHTML = String(html || '');
    return (box.innerText || box.textContent || '').replace(/\u00a0/g, ' ').trim();
  }

  function noteById(id) {
    ensureReaderData();
    return D.readerNotes.find(note => String(note.id) === String(id));
  }

  function activeNote() {
    ensureReaderData();
    return noteById(D.reader.activeNoteId || localStorage.getItem(RICH_NOTE_ID_KEY) || '');
  }

  function getStoredRichHTML() {
    ensureReaderData();
    const note = activeNote();
    if (note?.html) return sanitizeRichHTML(note.html);
    if (D.reader.html) return sanitizeRichHTML(D.reader.html);
    return sanitizeRichHTML(localStorage.getItem(RICH_STORAGE_KEY) || '');
  }

  function hasRichReaderHTML() {
    return !!plainFromHTML(getStoredRichHTML());
  }

  function normalizeWord(word) {
    return String(word || '').toLowerCase().replace(/^'+|'+$/g, '').trim();
  }

  function isWordToken(token) {
    return /^[A-Za-z]+(?:['’-][A-Za-z]+)?$/.test(token);
  }

  function knownWords() {
    return new Set((Array.isArray(D.words) ? D.words : []).map(card => normalizeWord(card?.word)).filter(Boolean));
  }

  function injectStyles() {
    if (document.getElementById(RICH_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = RICH_STYLE_ID;
    style.textContent = `
      .wordjar-reader-rich-hidden { display: none; }
      .wordjar-reader-rich-source {
        min-height: 180px;
        max-height: 42vh;
        overflow: auto;
        color: var(--ink);
        font: inherit;
        font-size: 16px;
        line-height: 1.62;
        padding: 4px 0;
        word-break: break-word;
      }
      .wordjar-reader-rich-source p,
      .wordjar-reader-rich-view p {
        margin: 0 0 1.05em;
        line-height: inherit;
      }
      .wordjar-reader-rich-source ul,
      .wordjar-reader-rich-source ol,
      .wordjar-reader-rich-view ul,
      .wordjar-reader-rich-view ol {
        margin: 0 0 1em 1.25em;
        padding-left: 1.1em;
      }
      .wordjar-reader-rich-source li,
      .wordjar-reader-rich-view li {
        margin: 0.25em 0;
      }
      .wordjar-reader-rich-source blockquote,
      .wordjar-reader-rich-view blockquote {
        margin: 0 0 1em;
        padding-left: 1em;
        border-left: 3px solid var(--bdr);
        color: var(--ink2);
      }
      .wordjar-reader-rich-source mark,
      .wordjar-reader-rich-view mark {
        border-radius: 4px;
        padding: 0 2px;
      }
      .wordjar-reader-rich-view {
        font-size: 17px;
        line-height: 1.85;
        color: var(--ink);
        word-break: break-word;
      }
      .wordjar-reader-rich-view .reader-token {
        display: inline;
        border-radius: 8px;
        padding: 1px 2px;
        cursor: pointer;
      }
      .wordjar-reader-rich-note-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0 0 10px;
        padding: 7px 10px;
        border: 1px solid var(--bdr);
        border-radius: 999px;
        background: var(--sur2);
        color: var(--ink2);
        font-size: 12px;
        font-weight: 800;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureRichSourceBox() {
    injectStyles();
    const input = document.getElementById('readerInput');
    if (!input) return null;

    let box = document.getElementById(RICH_SOURCE_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = RICH_SOURCE_ID;
      box.className = 'wordjar-reader-rich-source';
      input.insertAdjacentElement('afterend', box);
    }
    return box;
  }

  function clearRichReaderState() {
    ensureReaderData();
    D.reader.html = '';
    D.reader.richNote = false;
    localStorage.removeItem(RICH_STORAGE_KEY);
    localStorage.removeItem(RICH_NOTE_ID_KEY);
    document.getElementById('pg-reader')?.classList.remove(ACTIVE_CLASS);
    document.getElementById('readerInput')?.classList.remove('wordjar-reader-rich-hidden');
    document.getElementById(RICH_SOURCE_ID)?.remove();
  }

  function setRichReaderState({ html, text, noteId = '' }) {
    ensureReaderData();
    const cleanHTML = sanitizeRichHTML(html);
    const cleanText = String(text || plainFromHTML(cleanHTML) || '').trim();
    if (!cleanText) return false;

    D.reader.text = cleanText;
    D.reader.html = cleanHTML;
    D.reader.richNote = true;
    if (noteId) D.reader.activeNoteId = noteId;

    localStorage.setItem('wordjar_reader_note_v1', cleanText);
    localStorage.setItem(RICH_STORAGE_KEY, cleanHTML);
    if (noteId) localStorage.setItem(RICH_NOTE_ID_KEY, noteId);

    const input = document.getElementById('readerInput');
    if (input) input.value = cleanText;
    if (typeof save === 'function') save();
    return true;
  }

  function syncRichSourceBox() {
    const html = getStoredRichHTML();
    const input = document.getElementById('readerInput');
    const page = document.getElementById('pg-reader');
    if (!input || !plainFromHTML(html)) {
      clearRichReaderState();
      return;
    }

    const box = ensureRichSourceBox();
    if (!box) return;
    input.classList.add('wordjar-reader-rich-hidden');
    page?.classList.add(ACTIVE_CLASS);
    box.innerHTML = html;
  }

  function tokenizeTextNode(text, startOffset, known) {
    const frag = document.createDocumentFragment();
    const parts = String(text || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)?|\d+|[^A-Za-z\d]+/g) || [];
    let offset = startOffset;
    let wordCount = 0;

    parts.forEach(part => {
      if (isWordToken(part)) {
        const span = document.createElement('span');
        span.className = `reader-token ${known.has(normalizeWord(part)) ? 'known' : ''}`.trim();
        span.dataset.word = part;
        span.dataset.offset = String(offset);
        span.textContent = part;
        span.addEventListener('click', () => {
          if (typeof window.selectReaderWord === 'function') window.selectReaderWord(span);
        });
        frag.appendChild(span);
        wordCount += 1;
      } else {
        frag.appendChild(document.createTextNode(part));
      }
      offset += part.length;
    });

    return { frag, offset, wordCount };
  }

  function makeInteractiveRichHTML(html) {
    const root = document.createElement('div');
    root.innerHTML = sanitizeRichHTML(html);
    const known = knownWords();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let cursor = 0;
    let wordCount = 0;

    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const result = tokenizeTextNode(node.nodeValue, cursor, known);
      cursor = result.offset;
      wordCount += result.wordCount;
      node.replaceWith(result.frag);
    });

    return { html: root.innerHTML, wordCount };
  }

  function renderRichReaderTokens() {
    const html = getStoredRichHTML();
    const tokensEl = document.getElementById('readerTokens');
    const countEl = document.getElementById('readerCount');
    if (!tokensEl || !plainFromHTML(html)) return false;

    syncRichSourceBox();
    const rich = makeInteractiveRichHTML(html);
    if (countEl) countEl.textContent = `${rich.wordCount} word${rich.wordCount === 1 ? '' : 's'}`;
    tokensEl.innerHTML = `
      <div class="wordjar-reader-rich-note-badge">Opened from saved note · rich format kept</div>
      <div class="wordjar-reader-rich-view">${rich.html}</div>
    `;
    return true;
  }

  function closeNotesUI() {
    const modal = document.getElementById('readerNotesModal');
    if (modal && typeof closeO === 'function') closeO('readerNotesModal');
    const notesPage = document.getElementById('readerNotesPage');
    if (notesPage) {
      notesPage.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  function openRichHTMLInReader({ html, text, noteId = '', toastText = 'Opened in Reader' }) {
    if (!setRichReaderState({ html, text, noteId })) {
      if (typeof toast === 'function') toast('Note text is empty');
      return;
    }

    closeNotesUI();
    if (typeof nav === 'function') nav('reader');
    setTimeout(() => {
      const input = document.getElementById('readerInput');
      if (input) input.value = D.reader.text || '';
      renderRichReaderTokens();
      if (typeof toast === 'function') toast(toastText);
    }, 0);
  }

  function patchReaderRendering() {
    if (window.__wordjarReaderRichRenderPatched) return;
    window.__wordjarReaderRichRenderPatched = true;

    const originalRenderReader = window.renderReader;
    window.renderReader = function renderReaderWithRichNote() {
      const result = typeof originalRenderReader === 'function' ? originalRenderReader.apply(this, arguments) : undefined;
      if (hasRichReaderHTML()) setTimeout(renderRichReaderTokens, 0);
      return result;
    };

    const originalRenderReaderTokens = window.renderReaderTokens;
    window.renderReaderTokens = function renderReaderTokensWithRichNote() {
      if (hasRichReaderHTML()) return renderRichReaderTokens();
      return typeof originalRenderReaderTokens === 'function' ? originalRenderReaderTokens.apply(this, arguments) : undefined;
    };
  }

  function patchOpenReaderNote() {
    if (window.__wordjarOpenReaderNoteRichPatched) return;
    const originalOpenReaderNote = window.openReaderNote;
    if (typeof originalOpenReaderNote !== 'function') return;
    window.__wordjarOpenReaderNoteRichPatched = true;

    window.openReaderNote = function openReaderNoteWithRichFormat(id) {
      const note = noteById(id);
      if (note && note.html) {
        openRichHTMLInReader({ html: note.html, text: note.text || '', noteId: note.id });
        return;
      }
      clearRichReaderState();
      return originalOpenReaderNote.apply(this, arguments);
    };
  }

  function patchEditorHandoff() {
    if (window.__wordjarEditorReaderHandoffRichPatched) return;
    const originalOpenCurrentEditor = window.openCurrentEditorTextInReaderIOS;
    if (typeof originalOpenCurrentEditor !== 'function') return;
    window.__wordjarEditorReaderHandoffRichPatched = true;

    window.openCurrentEditorTextInReaderIOS = function openCurrentEditorTextInReaderRich() {
      const editor = document.getElementById('rnEditorBody');
      if (!editor) return originalOpenCurrentEditor.apply(this, arguments);
      const html = sanitizeRichHTML(editor.innerHTML || '');
      const text = plainFromHTML(html);
      openRichHTMLInReader({ html, text, noteId: D.reader?.activeNoteId || '', toastText: 'Opened rich note in Reader' });
    };
  }

  function patchClearReader() {
    if (window.__wordjarClearReaderRichPatched) return;
    const originalClearReaderText = window.clearReaderText;
    if (typeof originalClearReaderText !== 'function') return;
    window.__wordjarClearReaderRichPatched = true;

    window.clearReaderText = function clearReaderTextAndRichFormat() {
      const result = originalClearReaderText.apply(this, arguments);
      setTimeout(() => {
        const input = document.getElementById('readerInput');
        if (!input || !input.value.trim()) clearRichReaderState();
      }, 0);
      return result;
    };
  }

  function bindPlainInputReset() {
    const input = document.getElementById('readerInput');
    if (!input || input.__wordjarRichResetBound) return;
    input.__wordjarRichResetBound = true;
    input.addEventListener('input', () => {
      if (!input.classList.contains('wordjar-reader-rich-hidden')) clearRichReaderState();
    });
  }

  function patchAll() {
    injectStyles();
    patchReaderRendering();
    patchOpenReaderNote();
    patchEditorHandoff();
    patchClearReader();
    bindPlainInputReset();
    if (hasRichReaderHTML()) renderRichReaderTokens();
  }

  patchAll();
  setTimeout(patchAll, 0);
  setTimeout(patchAll, 250);
  document.addEventListener('click', () => setTimeout(patchAll, 0), true);
})();
