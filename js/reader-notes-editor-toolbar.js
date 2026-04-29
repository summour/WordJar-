// WordJar Reader Notes UI Add-on
// One compact layer for Reader Notes Core V2.

(function installReaderNotesAddon() {
  if (window.__wordjarReaderNotesAddonInstalledV12) return;
  window.__wordjarReaderNotesAddonInstalledV12 = true;

  const STYLE_ID = 'readerNotesAddonStyle';
  const EDITOR_BUTTON_ID = 'rnFormatNovelCoreBtn';
  const MOVE_SHEET_ID = 'readerNoteMoveSheet';
  const ADD_READER_BUTTON_ID = 'rnAddToReaderMenuBtn';
  const CLEAN_BOUND_KEY = 'readerNotesCleanHistoryBound';
  const UNCATEGORIZED_FOLDER = 'uncategorized';
  const history = { undo: [], redo: [] };

  function editorEl() {
    return document.getElementById('rnEditorBody') || document.querySelector('#readerNotesPage.active [contenteditable="true"]');
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function plainFromHTML(html) {
    const box = document.createElement('div');
    box.innerHTML = String(html || '');
    return (box.innerText || box.textContent || '').replace(/\u00a0/g, ' ').trim();
  }

  function toastSafe(message) {
    if (typeof toast === 'function') toast(message);
  }

  function ensureNotes() {
    window.D = window.D || {};
    D.reader = D.reader || {};
    if (!Array.isArray(D.readerNotes)) D.readerNotes = [];
    if (!Array.isArray(D.readerNoteFolders)) D.readerNoteFolders = [];
  }

  function noteById(id) {
    ensureNotes();
    return D.readerNotes.find(note => String(note.id) === String(id));
  }

  function folderName(id) {
    if (!id || id === UNCATEGORIZED_FOLDER) return 'Notes';
    return D.readerNoteFolders.find(folder => String(folder.id) === String(id))?.name || 'Folder';
  }

  function moveFolders() {
    ensureNotes();
    return [
      { id: UNCATEGORIZED_FOLDER, name: 'Notes' },
      ...D.readerNoteFolders.map(folder => ({ id: folder.id, name: folder.name || 'Folder' }))
    ];
  }

  function cleanLines(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .filter(line => line && !/^\d+$/.test(line));
  }

  function isHeading(line, index) {
    const value = String(line || '').trim();
    if (/^chapter\s+[ivxlcdm\d]+\b/i.test(value)) return true;
    return index < 8 && value.length <= 48 && !/[.!?]$/.test(value);
  }

  function fallbackFormatNovelText(text) {
    const paragraphs = [];
    let buffer = '';

    function push() {
      const value = buffer.replace(/[ ]+/g, ' ').trim();
      if (value) paragraphs.push(value);
      buffer = '';
    }

    cleanLines(text).forEach((line, index) => {
      if (isHeading(line, index)) {
        push();
        paragraphs.push(line);
        return;
      }
      buffer = buffer ? `${buffer} ${line}` : line;
      if (/[.!?”"”]$/.test(line)) push();
    });

    push();
    return paragraphs.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function formatText(text) {
    if (window.WordJarReaderNotesFormatNovel?.format) return WordJarReaderNotesFormatNovel.format(text);
    return fallbackFormatNovelText(text);
  }

  function formatToHTML(text) {
    if (window.WordJarReaderNotesFormatNovel?.html) return WordJarReaderNotesFormatNovel.html(text);

    return String(text || '')
      .split(/\n{2,}/)
      .map(part => part.trim())
      .filter(Boolean)
      .map((part, index) => `<p${isHeading(part, index) ? ' class="wj-novel-heading"' : ''}>${esc(part)}</p>`)
      .join('');
  }

  function currentHTML() {
    return editorEl()?.innerHTML || '';
  }

  function dispatchInput() {
    const editor = editorEl();
    if (!editor) return;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    updateHistoryButtons();
  }

  function pushHistory() {
    const html = currentHTML();
    if (!html) return;
    if (history.undo[history.undo.length - 1] !== html) history.undo.push(html);
    if (history.undo.length > 40) history.undo.shift();
    history.redo = [];
    updateHistoryButtons();
  }

  function setEditorHTML(html) {
    const editor = editorEl();
    if (!editor) return false;
    editor.innerHTML = html;
    editor.focus({ preventScroll: true });
    dispatchInput();
    return true;
  }

  function updateHistoryButtons() {
    const undo = document.getElementById('rnUndoBtn');
    const redo = document.getElementById('rnRedoBtn');
    if (undo && history.undo.length) undo.disabled = false;
    if (redo) redo.disabled = !history.redo.length;
  }

  function addonUndo() {
    if (!history.undo.length) return false;
    const now = currentHTML();
    const previous = history.undo.pop();
    if (now) history.redo.push(now);
    return setEditorHTML(previous);
  }

  function addonRedo() {
    if (!history.redo.length) return false;
    const now = currentHTML();
    const next = history.redo.pop();
    if (now) history.undo.push(now);
    return setEditorHTML(next);
  }

  function patchUndoRedo() {
    if (window.__wordjarReaderNotesUndoRedoPatchedV6) return;
    window.__wordjarReaderNotesUndoRedoPatchedV6 = true;

    const oldUndo = window.undoReaderNoteEdit;
    const oldRedo = window.redoReaderNoteEdit;

    window.undoReaderNoteEdit = function patchedUndo() {
      if (addonUndo()) return;
      if (typeof oldUndo === 'function') return oldUndo.apply(this, arguments);
    };

    window.redoReaderNoteEdit = function patchedRedo() {
      if (addonRedo()) return;
      if (typeof oldRedo === 'function') return oldRedo.apply(this, arguments);
    };
  }

  function injectStyles() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
      :root {
        --wj-title: 28px;
        --wj-section: 20px;
        --wj-label: 14px;
        --wj-meta: 13px;
        --wj-small: 12px;
        --wj-bold-title: 820;
        --wj-bold-ui: 680;
        --wj-bold-body: 500;
      }

      #readerNotesPage.active .rn-title,
      #readerNotesPage.active .rn-detail-title,
      #readerNotesPage.active .rn-title-input { font-size: var(--wj-title) !important; font-weight: var(--wj-bold-title) !important; }
      #readerNotesPage.active .rn-row-title,
      #readerNotesPage.active .rn-group { font-size: var(--wj-section) !important; font-weight: 760 !important; }
      #readerNotesPage.active .rn-sub,
      #readerNotesPage.active .rn-row-meta,
      #readerNotesPage.active .rn-detail-meta,
      #readerNotesPage.active .rn-detail-folder { font-size: var(--wj-meta) !important; font-weight: 620 !important; }
      #readerNotesPage.active .rn-row-preview,
      #readerNotesPage.active .rn-detail-body,
      #readerNotesPage.active .rn-editor-body { font-weight: var(--wj-bold-body) !important; }

      #readerNotesPage.active .rn-toolbar { gap: 8px !important; }
      #readerNotesPage.active .rn-tabs,
      #readerNotesPage.active .rn-tools { border-radius: 22px !important; border: 1px solid #e5e7eb !important; background: #fff !important; box-shadow: none !important; }
      #readerNotesPage.active .rn-tabs { grid-template-columns: repeat(3, 1fr) !important; }
      #readerNotesPage.active .rn-tabs .rn-tab:nth-child(4) { display: none !important; }
      #readerNotesPage.active .rn-tabs .rn-tab { height: 34px !important; font-size: var(--wj-label) !important; font-weight: var(--wj-bold-ui) !important; }
      #readerNotesPage.active .rn-tools { min-height: 62px !important; padding: 9px 10px !important; gap: 8px !important; align-items: center !important; overflow-x: auto !important; scrollbar-width: none !important; }
      #readerNotesPage.active .rn-tools::-webkit-scrollbar { display: none !important; }
      #readerNotesPage.active .rn-tool { height: 36px !important; min-width: 36px !important; border-radius: 12px !important; font-size: 18px !important; font-weight: var(--wj-bold-ui) !important; flex: 0 0 auto !important; }
      #readerNotesPage.active .rn-clean-short-btn,
      #readerNotesPage.active #rnFormatNovelCoreBtn { width: 42px !important; min-width: 42px !important; height: 36px !important; padding: 0 !important; font-size: 12px !important; font-weight: var(--wj-bold-ui) !important; border-radius: 12px !important; }
      #readerNotesPage.active #rnFormatNovelCoreBtn { border: 1px solid #111 !important; background: #111 !important; color: #fff !important; transition: none !important; animation: none !important; transform: none !important; }

      #readerNotesPage.active .rn-folder-select,
      #readerNotesPage.active .rn-editor select { height: 34px !important; min-height: 34px !important; padding: 0 36px 0 16px !important; font-size: 14px !important; font-weight: var(--wj-bold-ui) !important; border-radius: 999px !important; border: 1px solid #e5e7eb !important; background-color: #fff !important; box-shadow: none !important; }

      #readerNotesPage.active .rn-circle,
      #readerNotesPage.active #rnUndoBtn,
      #readerNotesPage.active #rnRedoBtn { width: 40px !important; height: 40px !important; min-width: 40px !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; color: #111 !important; padding: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; font-size: 24px !important; font-weight: 400 !important; line-height: 1 !important; -webkit-tap-highlight-color: transparent !important; }
      #readerNotesPage.active .rn-circle svg { width: 22px !important; height: 22px !important; stroke: #111 !important; stroke-width: 2 !important; fill: none !important; }
      #readerNotesPage.active .rn-circle:active,
      #readerNotesPage.active #rnUndoBtn:active,
      #readerNotesPage.active #rnRedoBtn:active { background: transparent !important; transform: scale(.96) !important; }
      #readerNotesPage.active #rnUndoBtn,
      #readerNotesPage.active #rnRedoBtn { font-size: 0 !important; }
      #readerNotesPage.active #rnUndoBtn::before,
      #readerNotesPage.active #rnRedoBtn::before { content: '' !important; width: 24px !important; height: 24px !important; display: block !important; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' fill='none'%3E%3Cpath d='M13.4 8 6.9 14.5l6.5 6.5' stroke='%23111' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M7.5 14.5h12.4a6.9 6.9 0 0 1 0 13.8h-4.2' stroke='%23111' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") !important; background-repeat: no-repeat !important; background-position: center !important; background-size: 24px 24px !important; }
      #readerNotesPage.active #rnRedoBtn::before { transform: scaleX(-1) !important; }
      #readerNotesPage.active #rnUndoBtn:disabled,
      #readerNotesPage.active #rnRedoBtn:disabled { opacity: .32 !important; background: transparent !important; }

      #readerNotesPage.active #rnMenu { width: min(220px, calc(100vw - 32px)) !important; min-width: 0 !important; left: auto !important; right: 16px !important; border-radius: 18px !important; overflow: hidden !important; }
      #readerNotesPage.active #rnMenu button { min-height: 42px !important; padding: 0 16px !important; display: flex !important; align-items: center !important; font-size: var(--wj-label) !important; font-weight: var(--wj-bold-ui) !important; line-height: 1.15 !important; color:#111 !important; }
      #readerNotesPage.active #rnMenu button.danger,
      #readerNotesPage.active #rnMenu button[style*="red"] { color:#e2554f !important; }

      .rn-move-backdrop { position: fixed !important; inset: 0 !important; z-index: 200000 !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 22px !important; background: rgba(0,0,0,.28) !important; box-sizing: border-box !important; }
      .rn-move-card { width: min(320px, 100%) !important; max-height: min(500px, 82vh) !important; overflow: hidden !important; border: 1px solid #e5e7eb !important; border-radius: 24px !important; background: #fff !important; box-shadow: 0 24px 70px rgba(0,0,0,.20) !important; color: #111 !important; box-sizing: border-box !important; }
      .rn-move-head { padding: 16px 18px 10px !important; border-bottom: 1px solid #f0f0f0 !important; }
      .rn-move-title { font-size: 18px !important; font-weight: var(--wj-bold-title) !important; letter-spacing: -.02em !important; }
      .rn-move-sub { margin-top: 4px !important; color: #71717a !important; font-size: var(--wj-small) !important; font-weight: 560 !important; }
      .rn-move-list { max-height: 330px !important; overflow: auto !important; padding: 6px !important; }
      .rn-move-option { width: 100% !important; min-height: 44px !important; border: 0 !important; border-radius: 14px !important; background: transparent !important; color: #111 !important; display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 10px !important; padding: 0 12px !important; font: inherit !important; font-size: var(--wj-label) !important; font-weight: var(--wj-bold-ui) !important; text-align: left !important; }
      .rn-move-option:active,
      .rn-move-option.active { background: #f4f4f5 !important; }
      .rn-move-check { color: #111 !important; font-size: 16px !important; font-weight: 760 !important; }
      .rn-move-actions { display: flex !important; justify-content: flex-end !important; gap: 10px !important; padding: 8px 12px 12px !important; border-top: 1px solid #f0f0f0 !important; }
      .rn-move-cancel { height: 38px !important; min-width: 96px !important; border-radius: 999px !important; padding: 0 16px !important; font-size: var(--wj-label) !important; font-weight: var(--wj-bold-ui) !important; line-height: 1 !important; box-sizing: border-box !important; }
    `;
  }

  function applyToEditor() {
    const editor = editorEl();
    if (!editor) return false;

    const formatted = formatText(editor.innerText || editor.textContent || plainFromHTML(editor.innerHTML));
    if (!formatted) {
      toastSafe('Note text is empty');
      return true;
    }

    pushHistory();
    editor.innerHTML = formatToHTML(formatted);
    dispatchInput();
    toastSafe('Formatted as novel text');
    return true;
  }

  function activeToolbarName(page) {
    return String(page?.querySelector('.rn-tabs .rn-tab.active')?.textContent || '').trim().toLowerCase();
  }

  function removeInsertTab(page) {
    const tabs = Array.from(page?.querySelectorAll('.rn-tabs .rn-tab') || []);
    const insertTab = tabs.find(tab => String(tab.textContent || '').trim().toLowerCase() === 'insert');
    if (String(page?.querySelector('.rn-tabs .rn-tab.active')?.textContent || '').trim().toLowerCase() === 'insert') {
      tabs.find(tab => String(tab.textContent || '').trim().toLowerCase() === 'text')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    }
    insertTab?.remove();
  }

  function shortenCleanButton(page) {
    const tools = page?.querySelector('.rn-toolbar .rn-tools');
    if (!tools || activeToolbarName(page) !== 'text') return;

    Array.from(tools.querySelectorAll('button')).forEach(button => {
      const label = String(button.textContent || '').trim().toLowerCase();
      if (label !== 'clean' && label !== 'cln') return;
      button.textContent = 'Cln';
      button.title = 'Clean';
      button.setAttribute('aria-label', 'Clean');
      button.classList.add('rn-clean-short-btn');
      if (!button.dataset[CLEAN_BOUND_KEY]) {
        button.dataset[CLEAN_BOUND_KEY] = '1';
        button.addEventListener('pointerdown', pushHistory, true);
      }
    });
  }

  function mountEditorButton() {
    injectStyles();
    patchUndoRedo();

    const page = document.getElementById('readerNotesPage');
    if (page) removeInsertTab(page);
    shortenCleanButton(page);

    const tools = page?.querySelector('.rn-toolbar .rn-tools');
    const shouldShow = page?.classList.contains('active') && editorEl() && tools && activeToolbarName(page) === 'text';
    if (!shouldShow) {
      document.getElementById(EDITOR_BUTTON_ID)?.remove();
      return;
    }

    let button = document.getElementById(EDITOR_BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = EDITOR_BUTTON_ID;
      button.type = 'button';
      button.className = 'rn-tool label';
      button.textContent = 'FN';
      button.title = 'Format Novel';
      button.setAttribute('aria-label', 'Format Novel');
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        applyToEditor();
      });
    }

    if (button.parentElement !== tools) tools.appendChild(button);
    updateHistoryButtons();
  }

  function noteIdFromMenu(menu) {
    const attrs = Array.from(menu.querySelectorAll('button')).map(button => button.getAttribute('onclick') || '').join(' ');
    const matches = Array.from(attrs.matchAll(/['"]([^'"]+)['"]/g)).map(match => match[1]);
    return matches.find(id => noteById(id)) || '';
  }

  function noteIdFromDetailPage() {
    const buttons = Array.from(document.querySelectorAll('#readerNotesPage.active button, #readerNotesModal button'));
    const attrs = buttons.map(button => button.getAttribute('onclick') || '').join(' ');
    const matches = Array.from(attrs.matchAll(/['"]([^'"]+)['"]/g)).map(match => match[1]);
    return matches.find(id => noteById(id)) || '';
  }

  function addNoteToReader(noteId) {
    const note = noteById(noteId || noteIdFromDetailPage());
    if (!note) return toastSafe('Note not found');

    const text = String(note.text || '').trim();
    if (!text) return toastSafe('Note text is empty');

    ensureNotes();
    D.reader.text = text;
    D.reader.activeNoteId = note.id;
    localStorage.setItem('wordjar_reader_note_v1', text);

    const input = document.getElementById('readerInput');
    if (input) {
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    document.getElementById('rnMenu')?.remove();
    if (typeof processReaderText === 'function') processReaderText();
    if (typeof nav === 'function') nav('reader');
    if (typeof closeO === 'function') closeO('readerNotesModal');
    toastSafe('Added to Reader');
  }

  function closeMovePicker() {
    document.getElementById(MOVE_SHEET_ID)?.remove();
  }

  function refreshAfterMove(noteId) {
    if (typeof openReaderNoteDetailIOS === 'function') openReaderNoteDetailIOS(noteId);
    else if (typeof renderReaderNoteDetailIOS === 'function') renderReaderNoteDetailIOS(noteId);
    else if (typeof renderReaderNotesListIOS === 'function') renderReaderNotesListIOS();
  }

  function moveNoteToFolder(noteId, folderId) {
    const note = noteById(noteId);
    if (!note) return toastSafe('Note not found');

    note.folderId = folderId || UNCATEGORIZED_FOLDER;
    note.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
    if (typeof save === 'function') save();

    closeMovePicker();
    toastSafe(`Moved to ${folderName(note.folderId)}`);
    refreshAfterMove(note.id);
  }

  function showMoveFolderPicker(noteId) {
    injectStyles();
    const note = noteById(noteId);
    if (!note) return toastSafe('Note not found');

    closeMovePicker();
    document.getElementById('rnMenu')?.remove();

    const activeId = note.folderId || UNCATEGORIZED_FOLDER;
    const rows = moveFolders().map(folder => {
      const active = String(folder.id) === String(activeId);
      return `<button class="rn-move-option ${active ? 'active' : ''}" type="button" data-folder-id="${esc(folder.id)}"><span>${esc(folder.name)}</span><span class="rn-move-check">${active ? '✓' : ''}</span></button>`;
    }).join('');

    const sheet = document.createElement('div');
    sheet.id = MOVE_SHEET_ID;
    sheet.className = 'rn-move-backdrop';
    sheet.innerHTML = `<div class="rn-move-card" role="dialog" aria-modal="true"><div class="rn-move-head"><div class="rn-move-title">Move to Folder</div><div class="rn-move-sub">Choose where to move this note</div></div><div class="rn-move-list">${rows}</div><div class="rn-move-actions"><button class="rn-move-cancel" type="button">Cancel</button></div></div>`;

    sheet.addEventListener('click', event => {
      if (event.target === sheet || event.target.closest('.rn-move-cancel')) return closeMovePicker();
      const option = event.target.closest('.rn-move-option');
      if (option) moveNoteToFolder(note.id, option.dataset.folderId || UNCATEGORIZED_FOLDER);
    });

    document.body.appendChild(sheet);
  }

  function ensureAddToReaderButton(menu, noteId) {
    if (document.getElementById(ADD_READER_BUTTON_ID)) return;

    const button = document.createElement('button');
    button.id = ADD_READER_BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Add to Reader';
    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      addNoteToReader(noteId || noteIdFromMenu(menu));
    };

    const deleteButton = Array.from(menu.querySelectorAll('button')).find(btn => String(btn.textContent || '').trim().toLowerCase().includes('delete'));
    if (deleteButton) menu.insertBefore(button, deleteButton);
    else menu.appendChild(button);
  }

  function compactMenu(menu) {
    document.getElementById('rnFormatNovelMenuBtn')?.remove();
    const noteId = noteIdFromMenu(menu) || noteIdFromDetailPage();

    Array.from(menu.querySelectorAll('button')).forEach(button => {
      const label = String(button.textContent || '').trim().toLowerCase();
      if (['format novel', 'open in reader', 'duplicate', 'share text'].includes(label)) return button.remove();
      if (label !== 'move to folder') return;

      button.removeAttribute('onclick');
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        showMoveFolderPicker(noteId || noteIdFromMenu(menu));
      };
    });

    ensureAddToReaderButton(menu, noteId);
  }

  function isMoreButton(element) {
    const button = element?.closest?.('#readerNotesPage.active button');
    if (!button) return false;
    return ['⋯', '...', '•••'].includes(String(button.textContent || '').trim());
  }

  function bindMenuToggle() {
    if (document.body.dataset.readerNotesMenuToggleBoundV10) return;
    document.body.dataset.readerNotesMenuToggleBoundV10 = '1';

    document.addEventListener('click', event => {
      const menu = document.getElementById('rnMenu');
      if (isMoreButton(event.target) && menu) {
        event.preventDefault();
        event.stopImmediatePropagation();
        menu.remove();
        return;
      }
      if (menu && !event.target.closest('#rnMenu') && !isMoreButton(event.target)) menu.remove();
      setTimeout(mount, 0);
    }, true);
  }

  function mount() {
    mountEditorButton();
    const menu = document.getElementById('rnMenu');
    if (menu) compactMenu(menu);
  }

  bindMenuToggle();
  document.addEventListener('focusin', () => setTimeout(mount, 0), true);
  document.addEventListener('click', () => setTimeout(mount, 0), true);
  setInterval(mount, 1200);
  mount();

  window.showReaderNoteMoveFolderPicker = showMoveFolderPicker;
  window.addReaderNoteToReader = addNoteToReader;
  window.WordJarReaderNotesFormatNovelButton = { mount, apply: applyToEditor, move: showMoveFolderPicker, addToReader: addNoteToReader };
})();
