// WordJar Reader Format Novel
// Dedicated Reader button + text formatter.

(function installReaderFormatNovel() {
  if (window.__wordjarReaderFormatNovelInstalled) return;
  window.__wordjarReaderFormatNovelInstalled = true;

  const READER_STORAGE_KEY = 'wordjar_reader_note_v1';
  const STYLE_ID = 'readerFormatNovelStyle';
  const ACTIONS_ID = 'readerNovelActions';
  const BUTTON_ID = 'readerFormatNovelBtn';

  function toastSafe(message) {
    if (typeof toast === 'function') toast(message);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .reader-novel-actions {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        gap: 8px !important;
        margin: 10px 0 12px !important;
      }
      .reader-format-novel-btn {
        width: 100% !important;
        min-height: 44px !important;
        border: 1px solid var(--bdr) !important;
        border-radius: 14px !important;
        background: #fff !important;
        color: var(--ink) !important;
        font: inherit !important;
        font-size: 13px !important;
        font-weight: 850 !important;
        box-shadow: 0 6px 16px rgba(0,0,0,.035) !important;
      }
      .reader-format-novel-btn:active {
        background: var(--sur2) !important;
        transform: translateY(1px) !important;
      }
      .reader-tokens.novel-formatted {
        white-space: pre-wrap !important;
        line-height: 1.7 !important;
        font-family: Georgia, serif !important;
        text-align: justify !important;
      }
    `;
    document.head.appendChild(style);
  }

  function isHeading(line) {
    const text = String(line || '').trim();
    if (!text) return false;
    return /^chapter\b/i.test(text) || (text.length < 20 && !/[.!?]$/.test(text));
  }

  function formatNovelText(inputText) {
    if (!inputText) return '';

    const lines = String(inputText)
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/\d+\s+Charlotte's Web/gi, '')
      .replace(/Charlotte's Web\s+\d+/gi, '')
      .replace(/Before Breakfast\s+\d+/gi, '')
      .replace(/\d+\s+Before Breakfast/gi, '')
      .replace(/Wilbur\s+\d+/gi, '')
      .replace(/\d+\s+Wilbur/gi, '')
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim());

    let output = '';

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      if (!line) {
        output += '\n\n';
        continue;
      }

      const shouldJoinNext = !isHeading(line) && !/[.!?”"”]$/.test(line) && Boolean(lines[i + 1]);
      output += shouldJoinNext ? `${line} ` : `${line}\n`;
    }

    return output
      .replace(/[ ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function saveReaderText(text) {
    try { localStorage.setItem(READER_STORAGE_KEY, text); } catch (err) {}

    if (typeof D !== 'undefined') {
      D.reader = D.reader || {};
      D.reader.text = text;
    }

    if (typeof save === 'function') save();
  }

  function refreshReaderView() {
    if (typeof renderReader === 'function') renderReader();
    else if (typeof renderReaderTokens === 'function') renderReaderTokens();

    document.getElementById('readerTokens')?.classList.add('novel-formatted');
  }

  function applyReaderNovelFormat() {
    const input = document.getElementById('readerInput');
    if (!input) return toastSafe('Reader input not found');

    const before = input.value || '';
    if (!before.trim()) return toastSafe('Paste text first');

    const after = formatNovelText(before);
    input.value = after;
    saveReaderText(after);
    refreshReaderView();
    mountReaderNovelButton();
    toastSafe('Formatted as novel text');
  }

  function mountReaderNovelButton() {
    injectStyles();

    const input = document.getElementById('readerInput');
    if (!input) return false;

    let actions = document.getElementById(ACTIONS_ID);
    if (!actions) {
      actions = document.createElement('div');
      actions.id = ACTIONS_ID;
      actions.className = 'reader-novel-actions';
      input.insertAdjacentElement('beforebegin', actions);
    }

    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.className = 'reader-format-novel-btn';
      button.type = 'button';
      button.textContent = 'Format Novel';
      actions.appendChild(button);
    }

    button.onclick = applyReaderNovelFormat;
    return true;
  }

  function boot() {
    mountReaderNovelButton();

    const observer = new MutationObserver(() => {
      if (document.getElementById('pg-reader')) mountReaderNovelButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.formatNovelText = formatNovelText;
  window.applyReaderNovelFormat = applyReaderNovelFormat;
  window.WordJarReaderFormatNovel = {
    mount: mountReaderNovelButton,
    format: formatNovelText,
    apply: applyReaderNovelFormat
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
