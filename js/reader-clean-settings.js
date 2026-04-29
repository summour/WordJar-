// WordJar Reader Clean Format Settings V5
// Account settings + separate Reader Format Novel button.

(function installReaderCleanSettings() {
  if (window.__wordjarReaderCleanSettingsInstalledV5) return;
  window.__wordjarReaderCleanSettingsInstalledV5 = true;

  const DEFAULTS = {
    mode: 'novel',
    removeHeaders: true,
    removePageNumbers: true,
    normalizeSpaces: true,
    mergeBrokenLines: true,
    preserveHeadings: true,
    paragraphIndent: true
  };

  function ensureSettings() {
    D.settings = D.settings || {};
    D.settings.readerNoteClean = { ...DEFAULTS, ...(D.settings.readerNoteClean || {}) };
    return D.settings.readerNoteClean;
  }

  function injectStyles() {
    if (document.getElementById('readerCleanSettingsStyleV5')) return;
    const style = document.createElement('style');
    style.id = 'readerCleanSettingsStyleV5';
    style.textContent = `
      .reader-clean-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,.28);
        padding: 18px;
        box-sizing: border-box;
      }
      .reader-clean-modal-backdrop.active { display: flex; }
      .reader-clean-modal {
        width: min(100%, 520px);
        max-height: min(84vh, 720px);
        display: flex;
        flex-direction: column;
        border: 1px solid var(--bdr);
        border-radius: 26px;
        background: var(--bg);
        color: var(--ink);
        box-shadow: 0 24px 70px rgba(0,0,0,.22);
        overflow: hidden;
      }
      .reader-clean-modal-top {
        flex: 0 0 auto;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        padding: 20px 20px 14px;
        border-bottom: 1px solid var(--bdr);
      }
      .reader-clean-modal-title {
        font-size: 24px;
        line-height: 1.08;
        font-weight: 850;
        letter-spacing: -.035em;
      }
      .reader-clean-modal-sub {
        margin-top: 6px;
        color: var(--ink2);
        font-size: 13px;
        font-weight: 650;
        line-height: 1.42;
      }
      .reader-clean-close {
        width: 38px;
        height: 38px;
        min-width: 38px;
        border-radius: 999px;
        border: 1px solid var(--bdr);
        background: var(--sur);
        color: var(--ink);
        font-size: 24px;
        line-height: 1;
      }
      .reader-clean-modal-content {
        flex: 1 1 auto;
        overflow: auto;
        padding: 14px 16px 16px;
      }
      
      .reader-clean-row {
        min-height: 66px;
        padding: 13px 15px;
        border-bottom: 1px solid var(--bdr);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
      }
      .reader-clean-row:last-child { border-bottom: 0; }
      .reader-clean-label {
        color: var(--ink);
        font-size: 14px;
        font-weight: 760;
        line-height: 1.25;
      }
      .reader-clean-note {
        margin-top: 3px;
        color: var(--ink2);
        font-size: 12px;
        font-weight: 600;
        line-height: 1.35;
      }
      .reader-clean-switch {
        width: 48px;
        height: 28px;
        min-width: 48px;
        border-radius: 999px;
        border: 1px solid var(--bdr);
        background: var(--sur2);
        position: relative;
        padding: 0;
      }
      .reader-clean-switch:before {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 20px;
        height: 20px;
        border-radius: 999px;
        background: var(--ink2);
        transition: transform .15s ease, background .15s ease;
      }
      .reader-clean-switch.on { background: var(--ink); }
      .reader-clean-switch.on:before {
        transform: translateX(20px);
        background: var(--sur);
      }
      .reader-clean-preview {
        margin-top: 12px;
        border: 1px solid var(--bdr);
        border-radius: 18px;
        background: var(--sur2);
        padding: 13px 14px;
        color: var(--ink2);
        font-size: 12px;
        font-weight: 650;
        line-height: 1.45;
      }

      .reader-novel-actions {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
        margin: 10px 0 12px;
      }
      .reader-format-novel-btn {
        width: 100%;
        min-height: 44px;
        border-radius: 14px;
        border: 1px solid var(--bdr);
        background: #fff;
        color: var(--ink);
        font-size: 13px;
        font-weight: 850;
        font-family: inherit;
        box-shadow: 0 6px 16px rgba(0,0,0,.035);
      }
      .reader-format-novel-btn:active {
        background: var(--sur2);
        transform: translateY(1px);
      }
      .reader-novel-preview-box,
      .preview-box {
        white-space: pre-wrap;
        line-height: 1.7;
        font-family: Georgia, serif;
        padding: 1.5rem;
        text-align: justify;
      }
      .reader-tokens.novel-formatted {
        white-space: pre-wrap;
        line-height: 1.7;
        font-family: Georgia, serif;
        text-align: justify;
      }
      @media (max-width: 560px) {
        .reader-clean-modal-backdrop {
          align-items: flex-end;
          padding: 12px;
        }
        .reader-clean-modal {
          max-height: 86vh;
          border-radius: 24px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function cleanRowHTML() {
    return `<div id="readerTextCleanRow" class="mr" onclick="openReaderCleanSettings()"><div class="ml">Reader Text Clean</div><div class="chev">›</div></div>`;
  }

  function rowLabel(row) {
    return row?.querySelector?.('.ml')?.textContent?.trim() || row?.textContent?.trim() || '';
  }

  function mountSettings() {
    injectStyles();
    ensureSettings();
    document.getElementById('readerCleanSettingsCard')?.remove();
    document.getElementById('readerCleanSettingsPage')?.remove();

    const menu = document.querySelector('#pg-account .menu-sec');
    if (!menu) return;

    const duplicates = Array.from(menu.querySelectorAll('#readerTextCleanRow'));
    duplicates.slice(1).forEach(row => row.remove());

    if (!document.getElementById('readerTextCleanRow')) {
      const rows = Array.from(menu.querySelectorAll(':scope > .mr'));
      const flashcardRow = rows.find(r => rowLabel(r) === 'Flashcard Display');
      const dashboardRow = rows.find(r => rowLabel(r) === 'Dashboard Statistics');
      if (flashcardRow) flashcardRow.insertAdjacentHTML('afterend', cleanRowHTML());
      else if (dashboardRow) dashboardRow.insertAdjacentHTML('beforebegin', cleanRowHTML());
      else menu.insertAdjacentHTML('beforeend', cleanRowHTML());
    }
  }

  function settingRow(key, label, note) {
    const s = ensureSettings();
    return `<div class="reader-clean-row"><div><div class="reader-clean-label">${label}</div><div class="reader-clean-note">${note}</div></div><button class="reader-clean-switch ${s[key] ? 'on' : ''}" type="button" onclick="toggleReaderCleanSetting('${key}')" aria-label="${label}"></button></div>`;
  }

  function modalHTML() {
    return `
      <div class="reader-clean-modal" onclick="event.stopPropagation()">
        <div class="reader-clean-modal-top">
          <div>
            <div class="reader-clean-modal-title">Reader Text Clean</div>
            <div class="reader-clean-modal-sub">Clean settings stay separate. Format Novel is a dedicated Reader button and does not share the normal Clean action.</div>
          </div>
          <button class="reader-clean-close" type="button" onclick="closeReaderCleanSettings()">×</button>
        </div>
        <div class="reader-clean-modal-content">
          <div class="reader-clean-card">
            ${settingRow('removeHeaders','Remove headers / page labels','Removes copied book headers, footers, and repeated page labels.')}
            ${settingRow('removePageNumbers','Remove page numbers','Deletes standalone page numbers from copied text.')}
            ${settingRow('normalizeSpaces','Normalize spaces','Fixes duplicated spaces and quote spacing problems.')}
            ${settingRow('mergeBrokenLines','Merge broken lines','Joins lines broken by PDF or web copy formatting.')}
            ${settingRow('preserveHeadings','Preserve chapter headings','Keeps chapter titles separate from story paragraphs.')}
            ${settingRow('paragraphIndent','Paragraph indent','Applies readable novel-style paragraph spacing.')}
          </div>
          <div class="reader-clean-preview">Format Novel uses its own button in Reader and keeps paragraph spacing for copied novel text.</div>
        </div>
      </div>
    `;
  }

  function renderModal() {
    injectStyles();
    ensureSettings();
    let backdrop = document.getElementById('readerCleanSettingsModal');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'readerCleanSettingsModal';
      backdrop.className = 'reader-clean-modal-backdrop';
      backdrop.onclick = () => closeReaderCleanSettings();
      document.body.appendChild(backdrop);
    }
    backdrop.innerHTML = modalHTML();
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  window.openReaderCleanSettings = renderModal;
  window.closeReaderCleanSettings = function closeReaderCleanSettings() {
    document.getElementById('readerCleanSettingsModal')?.classList.remove('active');
    document.body.style.overflow = '';
  };
  window.toggleReaderCleanSetting = function toggleReaderCleanSetting(key) {
    const s = ensureSettings();
    if (!(key in s)) return;
    s[key] = !s[key];
    save?.();
    renderModal();
    toast?.('Clean settings updated');
  };

  window.formatNovelText = function formatNovelText(inputText) {
    if (!inputText) return '';

    let cleaned = String(inputText)
      .replace(/\d+\s+Charlotte's Web/gi, '')
      .replace(/Before Breakfast\s+\d+/gi, '')
      .replace(/Wilbur\s+\d+/gi, '');

    const lines = cleaned.split('\n');
    let formattedText = '';

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i].trim();

      if (currentLine === '') {
        formattedText += '\n\n';
        continue;
      }

      const isHeader = /^chapter\b/i.test(currentLine) || currentLine.length < 20;
      const endsWithPunctuation = /[.?!”"”]$/.test(currentLine);

      if (!endsWithPunctuation && !isHeader && i + 1 < lines.length) {
        formattedText += currentLine + ' ';
      } else {
        formattedText += currentLine + '\n';
      }
    }

    return formattedText
      .replace(/[ ]+/g, ' ')
      .replace(/\n\n+/g, '\n\n')
      .trim();
  };

  window.applyReaderNovelFormat = function applyReaderNovelFormat() {
    const input = document.getElementById('readerInput');
    if (!input) {
      toast?.('Reader input not found');
      return;
    }

    const before = input.value || '';
    if (!before.trim()) {
      toast?.('Paste text first');
      return;
    }

    const after = window.formatNovelText(before);
    input.value = after;

    try { localStorage.setItem('wordjar_reader_note_v1', after); } catch (err) {}
    if (D.reader) D.reader.text = after;
    save?.();

    const tokens = document.getElementById('readerTokens');
    if (tokens) tokens.classList.add('novel-formatted');

    if (typeof renderReader === 'function') renderReader();
    if (tokens) tokens.classList.add('novel-formatted');

    toast?.('Formatted as novel text');
  };

  function mountReaderNovelButton() {
    injectStyles();
    const input = document.getElementById('readerInput');
    if (!input) return;

    if (!document.getElementById('readerNovelActions')) {
      input.insertAdjacentHTML('beforebegin', `
        <div id="readerNovelActions" class="reader-novel-actions">
          <button id="readerFormatNovelBtn" class="reader-format-novel-btn" type="button" onclick="applyReaderNovelFormat()">Format Novel</button>
        </div>
      `);
    }
  }

  function watchReaderPage() {
    mountReaderNovelButton();
    const observer = new MutationObserver(() => mountReaderNovelButton());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.WordJarReaderCleanSettings = {
    mountSettings,
    ensureSettings,
    open: renderModal,
    mountReaderNovelButton,
    formatNovelText: window.formatNovelText
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mountSettings();
      watchReaderPage();
    }, { once: true });
  } else {
    mountSettings();
    watchReaderPage();
  }
})();
