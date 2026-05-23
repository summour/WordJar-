// WordJar Reader Note Detail Route Override V1
// Removes the old Note Detail route by rendering the learning detail page directly.

(function installReaderNoteDetailRouteOverride() {
  if (window.__wordjarReaderNoteDetailRouteOverrideInstalled) return;
  window.__wordjarReaderNoteDetailRouteOverrideInstalled = true;

  const DEFAULT_FOLDER = 'uncategorized';
  const state = { originalHandleRow: null };

  function esc(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(value);
    if (typeof escHTML === 'function') return escHTML(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function ensureData() {
    window.D = window.D || {};
    D.reader = D.reader || {};
    if (!Array.isArray(D.readerNotes)) D.readerNotes = [];
    if (!Array.isArray(D.readerNoteFolders)) D.readerNoteFolders = [];
  }

  function plainFromHTML(html) {
    const box = document.createElement('div');
    box.innerHTML = String(html || '');
    return (box.textContent || '').replace(/\u00a0/g, ' ').trim();
  }

  function noteText(note) {
    return String(note?.text || plainFromHTML(note?.html || '') || '').trim();
  }

  function safeHTML(note) {
    if (note?.html) return String(note.html || '');
    return esc(noteText(note)).replace(/\n/g, '<br>');
  }

  function noteById(id) {
    ensureData();
    return D.readerNotes.find(note => String(note.id) === String(id));
  }

  function folderName(id) {
    if (!id || id === DEFAULT_FOLDER) return 'Notes';
    return D.readerNoteFolders.find(folder => String(folder.id) === String(id))?.name || 'Folder';
  }

  function wordCount(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  function dateObj(value) {
    const date = new Date(String(value || '').replace(' ', 'T'));
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function sameDay(a, b) {
    return a && b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function shortDate(value) {
    const date = dateObj(value);
    if (!date) return '';
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (sameDay(date, today)) return `Today · ${time}`;
    if (sameDay(date, yesterday)) return `Yesterday · ${time}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
  }

  function readerNotesPage() {
    let page = document.getElementById('readerNotesPage');
    if (!page) {
      page = document.createElement('div');
      page.id = 'readerNotesPage';
      page.className = 'rn-page';
      document.body.appendChild(page);
    }
    page.classList.add('active');
    document.body.style.overflow = 'hidden';
    return page;
  }

  function renderLearningDetail(noteId) {
    const note = noteById(noteId);
    if (!note) {
      window.renderReaderNotesListIOS?.();
      return;
    }

    const page = readerNotesPage();
    page.dataset.learningNoteId = note.id;
    page.innerHTML = `
      <div class="rn-top">
        <button class="rn-icon" type="button" onclick="renderReaderNotesListIOS()">‹</button>
        <div class="rn-right">
          <button class="rn-btn rn-aa-btn" type="button" onclick="openReaderNoteCustomSheet('${esc(note.id)}')">Aa</button>
          <button class="rn-icon" type="button" onclick="showReaderNoteManageMenu('${esc(note.id)}')">⋯</button>
        </div>
      </div>
      <div class="rn-content rn-learning-core" data-note-id="${esc(note.id)}">
        <div class="rn-detail-title">${esc(note.title || 'Untitled note')}</div>
        <div class="rn-meta">${esc(shortDate(note.updatedAt || note.createdAt))} · ${wordCount(noteText(note))} words</div>
        <div class="rn-meta">Folder: ${esc(folderName(note.folderId || DEFAULT_FOLDER))}</div>
        <div class="rn-body">${safeHTML(note)}</div>
      </div>
      <div class="rn-toolbar">
        <button class="rn-btn primary" type="button" onclick="editReaderNoteIOS('${esc(note.id)}')">Edit Note</button>
      </div>
    `;

    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('wordjar:note-detail-rendered', {
        detail: { noteId: note.id }
      }));
    }, 0);
  }

  function overrideHandleRow() {
    if (window.__wordjarReaderNoteRowRouteOverridden) return;
    if (typeof window.handleReaderNoteRow !== 'function') return;

    state.originalHandleRow = window.handleReaderNoteRow;
    window.__wordjarReaderNoteRowRouteOverridden = true;
    window.handleReaderNoteRow = function handleReaderNoteRowLearningRoute(id) {
      const isSelecting = !!document.querySelector('#readerNotesPage .rn-list.rn-selecting');
      if (isSelecting) {
        return state.originalHandleRow.apply(this, arguments);
      }
      renderLearningDetail(id);
    };
  }

  function removeOldDetailButton() {
    document.querySelectorAll('#readerNotesPage button').forEach(button => {
      if (/open in reader|open legacy reader/i.test(button.textContent || '')) {
        button.remove();
      }
    });
  }

  function boot() {
    overrideHandleRow();
    removeOldDetailButton();
  }

  window.renderReaderNoteLearningDetail = renderLearningDetail;

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 350);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
  document.addEventListener('wordjar:note-detail-rendered', () => setTimeout(boot, 0));
})();