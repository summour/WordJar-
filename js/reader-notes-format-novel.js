// WordJar Reader Notes Format Novel
// Formatter only. UI is handled by reader-notes-editor-toolbar.js.

(function installReaderNotesFormatNovel() {
  if (window.__wordjarReaderNotesFormatNovelInstalledV2) return;
  window.__wordjarReaderNotesFormatNovelInstalledV2 = true;

  const STYLE_ID = 'wjNotesNovelCss';
  const SENTENCES_PER_PARAGRAPH = 4;

  function escapeHTML(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function isChapterLine(line) {
    return /^chapter\s+[ivxlcdm\d]+\b/i.test(String(line || '').trim());
  }

  function isTitleLine(line, index) {
    const text = String(line || '').trim();
    if (!text) return false;
    if (isChapterLine(text)) return true;
    if (index > 8) return false;
    if (text.length > 48) return false;
    return !/[.!?]$/.test(text);
  }

  function getCleanLines(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .filter(line => line && !/^\d+$/.test(line));
  }

  function joinHyphenatedLines(lines) {
    const joined = [];

    for (let i = 0; i < lines.length; i += 1) {
      let line = lines[i];
      if (/[-‐‑‒–—]$/.test(line) && lines[i + 1]) {
        line = line.replace(/[-‐‑‒–—]$/, '') + lines[i + 1];
        i += 1;
      }
      joined.push(line.replace(/\b([A-Za-z]+)-\s+([a-z]{2,})\b/g, '$1$2'));
    }

    return joined;
  }

  function sentenceCount(text) {
    return (String(text || '').match(/[.!?]["”’')\]]?(?=\s|$)/g) || []).length;
  }

  function formatNovelText(text) {
    const lines = joinHyphenatedLines(getCleanLines(text));
    const paragraphs = [];
    let buffer = '';

    function pushBuffer() {
      const paragraph = buffer.replace(/[ ]+/g, ' ').trim();
      if (paragraph) paragraphs.push(paragraph);
      buffer = '';
    }

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (isTitleLine(line, i)) {
        pushBuffer();
        paragraphs.push(line);
        continue;
      }

      buffer = buffer ? `${buffer} ${line}` : line;
      const nextLine = lines[i + 1] || '';
      const shouldBreak = isTitleLine(nextLine, i + 1) || (sentenceCount(buffer) >= SENTENCES_PER_PARAGRAPH && /[.!?”"”]$/.test(line));
      if (shouldBreak) pushBuffer();
    }

    pushBuffer();
    return paragraphs.join('\n\n').replace(/[ ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  function novelHTML(text) {
    return String(text || '')
      .split(/\n{2,}/)
      .map(paragraph => paragraph.trim())
      .filter(Boolean)
      .map((paragraph, index) => {
        const content = escapeHTML(paragraph);
        if (isTitleLine(paragraph, index)) return `<p class="wj-novel-heading"><strong>${content}</strong></p>`;
        return `<p>${content}</p>`;
      })
      .join('\n\n');
  }

  function editorEl() {
    return document.getElementById('rnEditorBody') || document.querySelector('.rn-editor-body, .rn-text-input, [contenteditable="true"]');
  }

  function installNovelStyles() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
      .wj-novel-mode { line-height: 1.7 !important; text-align: left !important; }
      .rn-body p,
      .rn-editor-body p,
      .reader-rich-note-view p,
      .wj-novel-mode p { margin: 0 0 1.15em !important; line-height: 1.7 !important; text-indent: 1.35em !important; }
      .rn-body p.wj-novel-heading,
      .rn-editor-body p.wj-novel-heading,
      .reader-rich-note-view p.wj-novel-heading,
      .wj-novel-mode p.wj-novel-heading { text-indent: 0 !important; font-weight: 760 !important; text-align: left !important; }
    `;
  }

  function applyNovelFormat() {
    const editor = editorEl();
    if (!editor) return;

    editor.focus({ preventScroll: true });
    const formatted = formatNovelText(editor.innerText || editor.textContent || '');
    if (!formatted) return;

    editor.innerHTML = novelHTML(formatted);
    editor.classList.add('wj-novel-mode');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof toast === 'function') toast('Formatted as novel text');
  }

  installNovelStyles();

  window.WordJarReaderNotesFormatNovel = {
    mount: installNovelStyles,
    format: formatNovelText,
    html: novelHTML,
    apply: applyNovelFormat
  };
})();
